import { useEffect } from "react";
import { isProspectDemo } from "@/lib/demo/session";
import { computePayPeriod, laborRulesAt, parseLaborRules } from "@/lib/labor/rules";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { fireKeyFor, parseOpsJobsConfig, shouldFireCadence } from "@/lib/ops-jobs/config";
import { executeOpsJob } from "@/lib/ops-jobs/run";
import { useOpsJobsStore } from "@/lib/ops-jobs/store";
import { JOB_CADENCES, type JobCadence } from "@/lib/ops-jobs/types";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import { runRegCalendarTickFn } from "@/lib/saas/reg-bulletins-api";

/**
 * Fires scheduled AI ops jobs while a station is open.
 * Missing xAI key → skipped report, no invented insights.
 * Never auto clock-out.
 */
export function OpsJobsWatcher() {
  const locId = usePosStore((s) => s.tenantLocationId);

  useEffect(() => {
    if (isProspectDemo()) return;
    const tick = async () => {
      const cfg = parseOpsJobsConfig(usePosStore.getState().settings.opsJobs);
      if (!cfg.enabled) return;
      const last = useOpsJobsStore.getState().lastFired;
      const now = new Date();
      for (const cadence of JOB_CADENCES) {
        if (cadence === "pay_period") {
          const ops = useOpsStore.getState();
          const pos = usePosStore.getState();
          const base = parseLaborRules(ops.labor);
          const peer = Boolean(pos.settings.peerVenue || pos.settings.operatingModel === "peer_venue");
          const ids = [...(peer ? [] : [HOST_SCOPE]), ...pos.vendors.map((v) => v.id)];
          if (!ids.length) ids.push(HOST_SCOPE);
          const due = ids.some((id) => {
            const rules = laborRulesAt(parseLaborRules(ops.laborByEntity[id] ?? base), now.getTime());
            const period = computePayPeriod(now.getTime(), rules);
            return now.getTime() >= period.end;
          });
          if (!due) continue;
          if (now.getHours() !== cfg.cadences.pay_period.hour) continue;
          const key = fireKeyFor("pay_period", now, ":entities");
          if (last.pay_period === key) continue;
          if (!cfg.cadences.pay_period.enabled) continue;
          await executeOpsJob("pay_period", { fireKey: key });
          continue;
        }
        const { fire } = shouldFireCadence(cadence as JobCadence, cfg, last, now);
        if (!fire) continue;
        await executeOpsJob(cadence as JobCadence);
      }
    };
    void tick();
    const calKey = `regcal:${new Date().toISOString().slice(0, 10)}`;
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem("summex-reg-cal-tick") !== calKey) {
        window.localStorage.setItem("summex-reg-cal-tick", calKey);
        void runRegCalendarTickFn({ data: {} }).catch(() => undefined);
      }
    } catch {
      /* private */
    }
    const id = window.setInterval(() => void tick(), 60_000);
    return () => window.clearInterval(id);
  }, [locId]);

  return null;
}
