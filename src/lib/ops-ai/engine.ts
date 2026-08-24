import { usePosStore } from "@/lib/pos/store";
import { metricsFromPosStore } from "@/lib/reports/from-store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { isProspectDemo } from "@/lib/demo/session";
import { daypartOf, typeWeight, useOpsLearnStore } from "./learn-store";
import type { OpsFeatureSnapshot, OpsRecommendation, OpsRecType } from "./types";

export function captureOpsFeatures(): OpsFeatureSnapshot {
  const s = usePosStore.getState();
  const m = metricsFromPosStore({ range: "shift" });
  const clocked = s.employees.filter((e) => e.active && e.clockedIn);
  const sales = s.shift.cashSalesCents + s.shift.cardSalesCents + s.shift.giftSalesCents;
  const idleTables = s.tables.filter((t) => t.status === "available").length;
  const laborPct =
    sales > 0 ? Math.round(((clocked.length * 1800) / Math.max(sales, 1)) * 10000) / 100 : clocked.length > 2 ? 80 : null;
  return {
    daypart: daypartOf(),
    laborHeadcount: clocked.length,
    serverCount: clocked.filter((e) => e.role === "server").length,
    kitchenCount: clocked.filter((e) => e.role === "kitchen").length,
    salesCents: sales || m.sales.netCents,
    kitchenAvgSec: m.tickets.kitchenAvgSec,
    waitlistWaiting: s.waitlist.filter((w) => w.status === "waiting" || w.status === "notified").length,
    idleTables,
    openChecks: s.orders.filter((o) => o.status === "open").length,
    laborPct,
  };
}

function rec(
  type: OpsRecType,
  area: string,
  severity: OpsRecommendation["severity"],
  message: string,
  suggestedAction: string,
  confidence: number,
  extra?: Partial<OpsRecommendation>,
): OpsRecommendation {
  return {
    id: `orec_${type}`,
    type,
    area,
    severity,
    message,
    suggestedAction,
    confidence: Math.max(0.15, Math.min(0.98, confidence)),
    applyView: extra?.applyView,
    operatorId: extra?.operatorId,
    basedOnPastDecisions: extra?.basedOnPastDecisions,
    dismissedBefore: extra?.dismissedBefore,
  };
}

export function buildShiftRecommendations(opts?: {
  operatorId?: string | null;
}): { features: OpsFeatureSnapshot; recs: OpsRecommendation[] } {
  const features = captureOpsFeatures();
  const events = useOpsLearnStore.getState().events;
  const op = opts?.operatorId ?? null;
  const scopedEvents = op
    ? events.filter((e) => !e.operatorId || e.operatorId === op)
    : events;
  const demo = isProspectDemo();
  const out: OpsRecommendation[] = [];

  const laborHigh =
    (features.laborPct != null && features.laborPct >= 35 && features.laborHeadcount >= 3) ||
    (features.salesCents < 8000 && features.laborHeadcount >= 4) ||
    (demo && features.laborHeadcount >= 3);

  if (laborHigh) {
    const w = typeWeight(scopedEvents, "labor_high", features, op);
    const conf = 0.62 * w.weight;
    if (conf >= 0.28) {
      out.push(
        rec(
          "labor_high",
          "Labor vs sales",
          "watch",
          features.laborPct
            ? `Labor proxy ${features.laborPct.toFixed(0)}% vs sales with ${features.laborHeadcount} clocked in.`
            : `${features.laborHeadcount} people on the clock vs light sales.`,
          "Consider cutting one server — confirm on the time clock. AI will not clock anyone out.",
          conf,
          {
            applyView: "labor",
            operatorId: op,
            basedOnPastDecisions: w.accepts > 0,
            dismissedBefore: w.dismisses >= 2,
          },
        ),
      );
    }
  }

  if (features.salesCents > 40000 && features.serverCount <= 1 && features.waitlistWaiting >= 4) {
    const w = typeWeight(scopedEvents, "labor_low", features, op);
    out.push(
      rec(
        "labor_low",
        "Labor vs sales",
        "urgent",
        "Sales and waitlist are up with a thin floor.",
        "Call a server or hold seating. Confirm before changing the roster.",
        0.7 * w.weight,
        { applyView: "schedule", basedOnPastDecisions: w.accepts > 0, dismissedBefore: w.dismisses >= 2 },
      ),
    );
  }

  if (features.kitchenAvgSec >= 480 || (demo && features.kitchenAvgSec >= 0 && features.laborHeadcount >= 1)) {
    if (features.kitchenAvgSec >= 360 || features.kitchenCount >= 1) {
      const w = typeWeight(scopedEvents, "kitchen_slow", features, op);
      if (features.kitchenAvgSec >= 480) {
        out.push(
          rec(
            "kitchen_slow",
            "Speed of service",
            "urgent",
            `Kitchen tickets average ${(features.kitchenAvgSec / 60).toFixed(1)} min with ${features.kitchenCount} on the pit.`,
            "Delay waitlist quotes or 86 slow items. Do not auto-cut kitchen staff.",
            0.68 * w.weight,
            { applyView: "kitchen", basedOnPastDecisions: w.accepts > 0, dismissedBefore: w.dismisses >= 2 },
          ),
        );
      }
    }
  }

  if (features.waitlistWaiting >= 4 && features.idleTables >= 3) {
    const w = typeWeight(scopedEvents, "waitlist_idle", features, op);
    out.push(
      rec(
        "waitlist_idle",
        "Guest flow",
        "watch",
        `${features.waitlistWaiting} waiting with ${features.idleTables} idle tables.`,
        "Seat or shorten quotes. Check waitlist reason on the host stand.",
        0.64 * w.weight,
        { applyView: "waitlist", basedOnPastDecisions: w.accepts > 0, dismissedBefore: w.dismisses >= 2 },
      ),
    );
  }

  const s = usePosStore.getState();
  const voids = s.shift.voidsCents ?? 0;
  const sales = features.salesCents;
  if (sales > 0 && voids / sales > 0.05) {
    const w = typeWeight(scopedEvents, "voids_high", features, op);
    out.push(
      rec(
        "voids_high",
        "Revenue quality",
        "watch",
        "Voids are elevated this shift.",
        "Review void audit before the next rush.",
        0.55 * w.weight,
        { applyView: "reports", basedOnPastDecisions: w.accepts > 0 },
      ),
    );
  }

  return {
    features,
    recs: out
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4),
  };
}

export function operatorScopeId(): string | null {
  const emp = usePosStore.getState().getCurrentEmployee();
  if (emp?.role === "vendor_operator") return emp.operatorId ?? HOST_SCOPE;
  return null;
}
