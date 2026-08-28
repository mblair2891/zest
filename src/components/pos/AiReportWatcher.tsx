import { useEffect } from "react";
import { usePosStore } from "@/lib/pos/store";
import { metricsFromPosStore } from "@/lib/reports/from-store";
import { analyzeLocationPerformanceFn, deliverAiReportFn } from "@/lib/reports/api";
import { guidedInsights } from "@/lib/reports/rules";
import { scheduleFireKey, useAiReportStore } from "@/lib/reports/schedule-store";
import { uid } from "@/lib/utils";
import { isProspectDemo } from "@/lib/demo/session";

function insightsText(summary: string, findings: { observation: string }[]) {
  return [summary, "", ...findings.map((f) => `• ${f.observation}`)].join("\n");
}

export function AiReportWatcher() {
  const locId = usePosStore((s) => s.tenantLocationId);
  const schedule = usePosStore((s) => s.settings.aiReportSchedule ?? "off");
  const email = usePosStore((s) => s.settings.aiReportEmail ?? "");
  const name = usePosStore((s) => s.settings.name);

  useEffect(() => {
    if (schedule !== "daily" && schedule !== "weekly") return;
    const tick = async () => {
      const key = scheduleFireKey(schedule);
      if (useAiReportStore.getState().lastFiredKey === key) return;
      const metrics = metricsFromPosStore({
        range: schedule === "daily" ? "today" : "7d",
      });
      let insights;
      try {
        insights = await analyzeLocationPerformanceFn({
          data: { metrics, isDemo: isProspectDemo() || metrics.isDemo },
        });
      } catch {
        insights = guidedInsights(metrics);
      }
      let delivered: "inbox" | "email" | "outbox" = "inbox";
      if (email && locId && !isProspectDemo()) {
        try {
          const res = await deliverAiReportFn({
            data: {
              to: email,
              subject: `Summex AI ops · ${name} · ${key}`,
              text: insightsText(insights.summary, insights.findings),
              locationId: locId,
            },
          });
          if (res.status === "sent") delivered = "email";
          else if (res.status === "logged_only") delivered = "outbox";
        } catch {
          delivered = "inbox";
        }
      }
      useAiReportStore.getState().push({
        id: uid("air"),
        at: Date.now(),
        range: metrics.range,
        from: metrics.from,
        to: metrics.to,
        locationId: locId || metrics.locationId,
        locationName: name,
        operatorId: metrics.operatorId ?? null,
        insights,
        delivered,
      });
      useAiReportStore.getState().markFired(key);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 60_000);
    return () => window.clearInterval(id);
  }, [schedule, email, locId, name]);

  return null;
}
