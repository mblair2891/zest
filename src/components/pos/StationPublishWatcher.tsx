import { useEffect } from "react";
import { getStationPublishFn } from "@/lib/access/api";
import { readStationPair } from "@/lib/pos/station-pair";
import {
  applyPendingIfIdle,
  readPublishState,
  stashOrApplyPublish,
} from "@/lib/pos/station-publish";
import { usePosStore } from "@/lib/pos/store";
import { isStationPinPath } from "@/lib/pos/device-roles";

/** Idle PIN pad pulls a new publish. Logged-in staff keep the last snapshot. */
export function StationPublishWatcher() {
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const locationId = usePosStore((s) => s.tenantLocationId);

  useEffect(() => {
    if (!currentEmployeeId) applyPendingIfIdle();
  }, [currentEmployeeId]);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (!isStationPinPath() && typeof window !== "undefined" && !window.location.pathname.startsWith("/station")) {
        return;
      }
      const pair = readStationPair();
      const deviceId = pair?.deviceId || "";
      if (!deviceId) return;
      const since = readPublishState()?.appliedVersion ?? 0;
      void getStationPublishFn({
        data: { locationId, deviceId, sinceVersion: since },
      })
        .then((res) => {
          if (cancelled || res.upToDate || !res.publish) return;
          stashOrApplyPublish(res.publish);
        })
        .catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [locationId, currentEmployeeId]);

  return null;
}
