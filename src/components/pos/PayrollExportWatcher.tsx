import { useEffect, useRef } from "react";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  autoExportDueAt,
  computePayPeriod,
  parseLaborRules,
} from "@/lib/labor/rules";
import { hrPayrollExportFn } from "@/lib/hr/api";
import { isProspectDemo } from "@/lib/demo/session";

/** Fires scheduled hours export when auto payroll is on. Never pays anyone. */
export function PayrollExportWatcher() {
  const last = useRef("");
  const locId = usePosStore((s) => s.tenantLocationId);
  const orgId = useSaasStore((s) => s.org.id);
  const labor = useOpsStore((s) => s.labor);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const settings = usePosStore((s) => s.settings);

  useEffect(() => {
    const tick = () => {
      if (isProspectDemo() || !orgId || !locId) return;
      const rules = parseLaborRules(labor);
      if (!rules.autoPayroll) return;
      const period = computePayPeriod(Date.now(), rules);
      const due = autoExportDueAt(period, rules);
      const now = Date.now();
      if (now < due || now > due + 30 * 60_000) return;
      const key = period.startIso;
      if (last.current === key) return;
      const pending = useOpsStore
        .getState()
        .punches.filter(
          (p) =>
            p.status === "pending_review" &&
            (p.clockOutAt ?? 0) >= period.start &&
            (p.clockOutAt ?? 0) <= period.end,
        ).length;
      if (rules.requireAllApprovedToExport && pending > 0) return;
      if (rules.sendMode === "manual") return;
      last.current = key;
      const employerId = emp?.operatorId || HOST_SCOPE;
      const push = rules.sendMode === "automatic";
      void hrPayrollExportFn({
        data: {
          orgId,
          locationId: locId,
          employerId,
          employerName: settings.name || "Host",
          periodStart: period.startIso,
          periodEnd: period.endIso,
          push,
        },
      }).catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [labor, orgId, locId, emp?.operatorId, settings.name]);

  return null;
}
