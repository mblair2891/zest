import { usePosStore } from "@/lib/pos/store";
import { useOpsStore } from "@/lib/pos/ops-store";
import { parseLaborRules } from "@/lib/labor/rules";
import {
  allocatedSharedCostCents,
  laborBasisLabel,
  salesForLaborBasis,
} from "@/lib/labor/revenue-basis";
import { metricsFromPosStore } from "@/lib/reports/from-store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { isProspectDemo } from "@/lib/demo/session";
import { daypartOf, typeWeight, useOpsLearnStore } from "./learn-store";
import type { OpsFeatureSnapshot, OpsRecommendation, OpsRecType } from "./types";
import { buildStaffingSnapshot, decideStaffing } from "./staffing";

export function captureOpsFeatures(): OpsFeatureSnapshot {
  const s = usePosStore.getState();
  const m = metricsFromPosStore({ range: "shift" });
  const clocked = s.employees.filter((e) => e.active && e.clockedIn);
  const sales = s.shift.cashSalesCents + s.shift.cardSalesCents + s.shift.giftSalesCents;
  const idleTables = s.tables.filter((t) => t.status === "available").length;
  const laborPct =
    sales > 0 ? Math.round(((clocked.length * 1800) / Math.max(sales, 1)) * 10000) / 100 : clocked.length > 2 ? 80 : null;
  const staffing = captureStaffingSnap();
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
    laborPct: staffing?.laborPct ?? laborPct,
    salesLast30mCents: staffing?.salesLast30mCents,
    baseline30mCents: staffing?.baseline30mCents,
    idleMinutes: staffing?.idleMinutes,
    odsOpen: staffing?.odsOpen,
    waitlistQuotedAvg: staffing?.waitlistQuotedAvg,
    reservationsSoon: staffing?.reservationsSoon,
    splhCents: staffing?.splhCents,
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
    id: extra?.targetRole ? `orec_${type}_${extra.targetRole}` : `orec_${type}`,
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
    staffingKind: extra?.staffingKind,
    targetRole: extra?.targetRole,
    reasons: extra?.reasons,
    candidateEmployeeIds: extra?.candidateEmployeeIds,
  };
}

function captureStaffingSnap() {
  const s = usePosStore.getState();
  const ops = useOpsStore.getState();
  const emp = s.employees.find((e) => e.id === s.currentEmployeeId);
  const entityId = emp?.operatorId || HOST_SCOPE;
  const rules = parseLaborRules(ops.laborByEntity?.[entityId] ?? ops.labor);
  const cfg = rules.staffingRecs;
  if (!cfg.enabled) return null;
  const entityName =
    entityId === HOST_SCOPE
      ? s.settings.name || "Host"
      : s.vendors.find((v) => v.id === entityId)?.name || entityId;
  const sales = salesForLaborBasis({
    orders: s.orders,
    entityId,
    basis: rules.revenueBasis,
    categoryIds: rules.revenueCategoryIds,
    menuItems: s.menuItems,
  });
  const last30 = salesForLaborBasis({
    orders: s.orders,
    entityId,
    basis: rules.revenueBasis,
    categoryIds: rules.revenueCategoryIds,
    menuItems: s.menuItems,
    from: Date.now() - 30 * 60_000,
    to: Date.now(),
  });
  const extraLabor = allocatedSharedCostCents(
    s.settings.sharedVenueCostsCents ?? 0,
    rules.sharedCostAllocationPct,
  );
  return buildStaffingSnapshot({
    cfg,
    employees: s.employees.filter((e) => (e.operatorId || HOST_SCOPE) === entityId || !e.operatorId),
    punches: ops.punches,
    orders: s.orders,
    tables: s.tables,
    tickets: s.tickets,
    waitlist: s.waitlist,
    reservations: s.reservations,
    lastTicketByEmployee: ops.lastTicketByEmployee,
    shiftSalesCents: sales,
    shiftOpenedAt: s.shift.openedAt,
    extraLaborCents: extraLabor,
    salesLast30mCents: last30,
    basisLabel: laborBasisLabel(entityName, rules.revenueBasis),
  });
}

function buildStaffingOpsRecs(
  features: OpsFeatureSnapshot,
  scopedEvents: ReturnType<typeof useOpsLearnStore.getState>["events"],
  op: string | null,
  demo: boolean,
): OpsRecommendation[] {
  const snap = captureStaffingSnap();
  const cfg = parseLaborRules(useOpsStore.getState().labor).staffingRecs;
  if (!cfg.enabled) return [];
  if (!snap) return [];
  const decisions = decideStaffing(cfg, snap);
  if (!decisions.length && demo && features.laborHeadcount >= 3 && !snap.inNoCut.locked) {
    decisions.push({
      kind: "recommend_cut",
      role: "server",
      reasons: ["Demo: several people on the clock vs light floor activity"],
      severity: "watch",
      message: "Cut one server — labor looks heavy for current sales.",
      suggestedAction:
        "Accept notifies them to close out when ready. It does not clock anyone out. Manager decides.",
    });
  }
  const out: OpsRecommendation[] = [];
  for (const d of decisions) {
    const recType: OpsRecType =
      d.kind === "recommend_cut" ? "recommend_cut" : d.kind === "recommend_add" ? "recommend_add" : "recommend_hold";
    const w = typeWeight(scopedEvents, recType, features, op);
    const legacy = typeWeight(scopedEvents, d.kind === "recommend_cut" ? "labor_high" : "labor_low", features, op);
    const weight = Math.max(w.weight, legacy.weight);
    const conf = (d.severity === "urgent" ? 0.78 : d.severity === "watch" ? 0.64 : 0.5) * weight;
    if (conf < 0.25 && !demo) continue;
    const candidates = snap.clocked
      .filter((c) => c.role === d.role)
      .sort((a, b) => b.idleMinutes - a.idleMinutes)
      .map((c) => c.id);
    out.push(
      rec(
        recType,
        "Staffing",
        d.severity,
        snap.basisLabel ? `${d.message} (${snap.basisLabel})` : d.message,
        d.suggestedAction,
        conf,
        {
        applyView: "labor",
        operatorId: op,
        basedOnPastDecisions: w.accepts + legacy.accepts > 0,
        dismissedBefore: w.dismisses + legacy.dismisses >= 2,
        staffingKind: d.kind,
        targetRole: d.role,
        reasons: d.reasons,
        candidateEmployeeIds: candidates,
      }),
    );
  }
  return out;
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

  out.push(...buildStaffingOpsRecs(features, scopedEvents, op, demo));

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
