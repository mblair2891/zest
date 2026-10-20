import { useEffect, useRef } from "react";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  autoExportDueAt,
  computePayPeriod,
  laborRulesAt,
  parseLaborRules,
  recordedInPeriod,
} from "@/lib/labor/rules";
import { hrPayrollExportFn } from "@/lib/hr/api";
import { isProspectDemo } from "@/lib/demo/session";

/** Fires scheduled hours export when auto payroll is on. Never pays anyone. */
export function PayrollExportWatcher() {
  const last = useRef<Record<string, string>>({});
  const locId = usePosStore((s) => s.tenantLocationId);
  const orgId = useSaasStore((s) => s.org.id);
  const labor = useOpsStore((s) => s.labor);
  const laborByEntity = useOpsStore((s) => s.laborByEntity);
  const vendors = usePosStore((s) => s.vendors);
  const settings = usePosStore((s) => s.settings);

  useEffect(() => {
    const tick = () => {
      if (isProspectDemo() || !orgId || !locId) return;
      useOpsStore.getState().scanMissedPunches();
      useOpsStore.getState().promoteDuePayPeriods();
      const peer = Boolean(settings.peerVenue || settings.operatingModel === "peer_venue");
      const ids = [
        ...(peer ? [] : [HOST_SCOPE]),
        ...vendors.map((v) => v.id),
      ];
      if (!ids.length) ids.push(HOST_SCOPE);
      const seen = new Set<string>();
      for (const employerId of ids) {
        if (!employerId || seen.has(employerId)) continue;
        seen.add(employerId);
        const rules = laborRulesAt(
          parseLaborRules(useOpsStore.getState().laborByEntity[employerId] ?? labor),
          Date.now(),
        );
        if (!rules.autoPayroll || rules.sendMode === "manual") continue;
        const period = computePayPeriod(Date.now(), rules);
        const due = autoExportDueAt(period, rules);
        const now = Date.now();
        if (now < due || now > due + 30 * 60_000) continue;
        if (last.current[employerId] === period.startIso) continue;
        const pending = useOpsStore
          .getState()
          .punches.filter(
            (p) =>
              (p.operatorId || HOST_SCOPE) === employerId &&
              p.status === "pending_review" &&
              recordedInPeriod(
                { payPeriodStart: p.payPeriodStart, payPeriodEnd: p.payPeriodEnd, at: p.clockInAt },
                period,
              ),
          ).length;
        if (rules.requireAllApprovedToExport && pending > 0) continue;
        last.current[employerId] = period.startIso;
        const push = rules.sendMode === "automatic";
        const employerName =
          employerId === HOST_SCOPE
            ? settings.name || "Host"
            : vendors.find((v) => v.id === employerId)?.shortName || employerId;
        void hrPayrollExportFn({
          data: {
            orgId,
            locationId: locId,
            employerId,
            employerName,
            periodStart: period.startIso,
            periodEnd: period.endIso,
            push,
          },
        }).catch(() => undefined);
      }
    };
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [labor, laborByEntity, vendors, orgId, locId, settings]);

  return null;
}
