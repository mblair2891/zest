import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { SessionGate } from "@/components/pos/SessionGate";
import { SummexMark } from "@/components/brand/SummexMark";
import { isVenueEntityId } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";
import { resolvePrimedLocation } from "@/lib/offline/location-snapshot";
import { rememberLastPosPath } from "@/lib/offline/register-sw";
import { parseStationQuery } from "@/lib/pos/device-roles";

export const Route = createFileRoute("/station")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { station?: "order" | "ods" | "host"; loc?: string } => {
    const out: { station?: "order" | "ods" | "host"; loc?: string } = {};
    const station = parseStationQuery(typeof s.station === "string" ? s.station : undefined);
    if (station) out.station = station;
    if (typeof s.loc === "string" && s.loc) out.loc = s.loc;
    return out;
  },
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
          First install requires internet: open this location from the control
          plane so the station can prime. After that, cold start is PIN-only —
          never a password login.
        </p>
      </div>
    );
  }

  return (
    <SessionGate allowPrimedStation>
      <PosApp entityId={entity} />
    </SessionGate>
  );
}
