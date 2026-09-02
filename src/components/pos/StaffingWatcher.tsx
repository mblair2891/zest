import { useEffect, useRef } from "react";
import { buildShiftRecommendations } from "@/lib/ops-ai/engine";
import { parseLaborRules } from "@/lib/labor/rules";
import { useOpsStore } from "@/lib/pos/ops-store";
import { useNotifyStore } from "@/lib/pos/notify-store";

/** Pushes staffing recs to manager / host / expo. Never clocks anyone out. */
export function StaffingWatcher() {
  const last = useRef<Record<string, number>>({});

  useEffect(() => {
    const tick = () => {
      const cfg = parseLaborRules(useOpsStore.getState().labor).staffingRecs;
      if (!cfg.enabled) return;
      const pack = buildShiftRecommendations({});
      const staffing = pack.recs.filter(
        (r) => r.type === "recommend_cut" || r.type === "recommend_add" || r.type === "recommend_hold",
      );
      const now = Date.now();
      for (const r of staffing) {
        if (r.severity === "info" && r.type === "recommend_hold") continue;
        const prev = last.current[r.id] ?? 0;
        if (now - prev < 15 * 60_000) continue;
        last.current[r.id] = now;
        const roles = cfg.notifyRoles;
        if (!roles.length) continue;
        useNotifyStore.getState().pushNotice({
          kind: "staffing_rec",
          title: r.staffingKind === "recommend_add" ? "Staffing: add" : r.staffingKind === "recommend_cut" ? "Staffing: cut" : "Staffing: hold",
          body: `${r.message} Recommendations only — manager decides. Never auto clock-out.`,
          audience: roles,
        });
      }
    };
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
