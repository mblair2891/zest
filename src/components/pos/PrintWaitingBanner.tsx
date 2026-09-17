import { useEffect, useState } from "react";
import { pendingKitchenPrintFn } from "@/lib/print/api";
import { waitingKitchenPrintBanner } from "@/lib/print/station-print-queue";
import { readStationPair } from "@/lib/pos/station-pair";
import { usePosStore } from "@/lib/pos/store";

const POLL_MS = 5_000;

export function PrintWaitingBanner() {
  const locationId = usePosStore((s) => s.tenantLocationId);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      const pair = readStationPair();
      const loc = locationId || pair?.locationId || "";
      const deviceId = pair?.deviceId || "";
      if (!loc) {
        if (!cancelled) setWaiting(0);
        return;
      }
      void pendingKitchenPrintFn({ data: { locationId: loc, deviceId } })
        .then((res) => {
          if (!cancelled) setWaiting(Math.max(0, Number(res.waiting) || 0));
        })
        .catch(() => {
          if (!cancelled) setWaiting(0);
        });
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [locationId]);

  if (waiting < 1) return null;

  return (
    <div
      data-print-waiting
      className="shrink-0 border-b border-warn/40 bg-warn/15 px-3 py-1.5 text-center text-[11px] font-semibold text-warn"
      role="status"
    >
      {waitingKitchenPrintBanner(waiting)}
    </div>
  );
}
