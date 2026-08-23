import { useLayoutEffect, useState } from "react";
import { PosApp } from "@/components/pos/PosApp";
import { demoEntry } from "@/lib/demo/catalog";
import { scriptFor } from "@/lib/demo/scripts";
import { enterDemoSession, exitDemoSession } from "@/lib/demo/session";
import type { VenueEntityId } from "@/lib/pos/types";
import { DemoBanner, DemoPlayer } from "./DemoPlayer";

export function DemoVenueShell({
  type,
  startTour = false,
  hideTourCta = false,
}: {
  type: VenueEntityId;
  startTour?: boolean;
  hideTourCta?: boolean;
}) {
  const [tour, setTour] = useState(startTour);
  const entry = demoEntry(type);

  useLayoutEffect(() => {
    enterDemoSession(type);
    return () => exitDemoSession();
  }, [type]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-[var(--grok-banner-h,0px)] z-50">
        <div className="pointer-events-auto">
          <DemoBanner
            label={entry?.hostName ?? type}
            onStartTour={
              hideTourCta || tour ? undefined : () => setTour(true)
            }
          />
        </div>
      </div>
      <PosApp entityId={type} />
      {tour && (
        <DemoPlayer
          script={scriptFor(type)}
          autoPlay={startTour}
          onExit={() => setTour(false)}
        />
      )}
    </div>
  );
}
