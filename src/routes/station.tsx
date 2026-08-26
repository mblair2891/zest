import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { SessionGate } from "@/components/pos/SessionGate";
import { SummexMark } from "@/components/brand/SummexMark";
import { isVenueEntityId } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";
import { resolvePrimedLocation } from "@/lib/offline/location-snapshot";
import { rememberLastPosPath } from "@/lib/offline/register-sw";

export const Route = createFileRoute("/station")({
  ssr: false,
  component: StationPage,
});

function StationPage() {
  const [entity, setEntity] = useState<VenueEntityId | null>(null);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    rememberLastPosPath();
    void resolvePrimedLocation().then((pack) => {
      if (cancelled) return;
      if (!pack) {
        setMissing(true);
        setReady(true);
        return;
      }
      const v = pack.venueType;
      setEntity(isVenueEntityId(v) ? v : "food_hall");
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
        <div className="text-center">
          <SummexMark className="mx-auto mb-3 h-10 w-10" />
          <p className="text-sm">Opening station…</p>
        </div>
      </div>
    );
  }

  if (missing || !entity) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg px-4 pt-[var(--grok-banner-h,0px)] text-center">
        <SummexMark className="h-10 w-10" />
        <p className="text-sm font-medium">This device is not primed yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          First install requires internet: sign in, open the location, wait for
          the floor to load, then Add to Home Screen. After that, cold start
          works with no network.
        </p>
        <Link to="/login" className="text-sm font-medium text-primary underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <SessionGate allowPrimedStation>
      <PosApp entityId={entity} />
    </SessionGate>
  );
}
