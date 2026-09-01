import { useEffect } from "react";
import { isProspectDemo } from "@/lib/demo/session";
import { computePayPeriod, parseLaborRules } from "@/lib/labor/rules";
import { fireKeyFor, parseOpsJobsConfig, shouldFireCadence } from "@/lib/ops-jobs/config";
import { executeOpsJob } from "@/lib/ops-jobs/run";
import { useOpsJobsStore } from "@/lib/ops-jobs/store";
import { JOB_CADENCES, type JobCadence } from "@/lib/ops-jobs/types";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";

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
          const labor = parseLaborRules(useOpsStore.getState().labor);
          const period = computePayPeriod(now.getTime(), labor);
          if (now.getTime() < period.end) continue;
          if (now.getHours() !== cfg.cadences.pay_period.hour) continue;
          const key = fireKeyFor("pay_period", now, `:${period.startIso}`);
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
    const id = window.setInterval(() => void tick(), 60_000);
    return () => window.clearInterval(id);
  }, [locId]);

  return null;
}
