import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { SessionGate } from "@/components/pos/SessionGate";
import { StationPairScreen } from "@/components/pos/StationPairScreen";
import { SummexMark } from "@/components/brand/SummexMark";
import { isVenueEntityId } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";
import { resolvePrimedLocation } from "@/lib/offline/location-snapshot";
import { rememberLastPosPath } from "@/lib/offline/register-sw";
import { parseStationQuery } from "@/lib/pos/device-roles";
import {
  normalizeClaimCode,
  readStationPair,
  type StationPairRecord,
} from "@/lib/pos/station-pair";
import { writePairedDeviceId } from "@/lib/pos/location-devices";

export const Route = createFileRoute("/station")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { station?: "order" | "ods" | "host"; loc?: string; pair?: string } => {
    const out: { station?: "order" | "ods" | "host"; loc?: string; pair?: string } = {};
    const station = parseStationQuery(typeof s.station === "string" ? s.station : undefined);
    if (station) out.station = station;
    if (typeof s.loc === "string" && s.loc) out.loc = s.loc;
    if (typeof s.pair === "string" && s.pair) out.pair = normalizeClaimCode(s.pair);
    return out;
  },
  component: StationPage,
});

function StationPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/station" });
  const [pair, setPair] = useState<StationPairRecord | null>(() => readStationPair());
  const [entity, setEntity] = useState<VenueEntityId | null>(null);
  const [ready, setReady] = useState(false);

  const onPaired = (row: StationPairRecord) => {
    if (row.deviceId) writePairedDeviceId(row.locationId, row.deviceId);
    setPair(row);
    void navigate({
      to: "/station",
      search: { station: row.station, loc: row.locationId },
      replace: true,
    });
  };

  useEffect(() => {
    let cancelled = false;
    rememberLastPosPath();
    const stored = readStationPair();
    if (stored) setPair(stored);

    const loc = search.loc || stored?.locationId;
    if (loc) {
      void resolvePrimedLocation().then((pack) => {
        if (cancelled) return;
        const v = pack?.venueType || stored?.venueType || "food_hall";
        setEntity(isVenueEntityId(v) ? v : stored?.venueType ?? "food_hall");
        setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }

    if (search.pair) {
      setReady(true);
      return;
    }

    setReady(true);
    return () => {
      cancelled = true;
    };
  }, [search.loc, search.pair]);

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

  const loc = search.loc || pair?.locationId;
  if (!loc) {
    return <StationPairScreen initialCode={search.pair || ""} onPaired={onPaired} />;
  }

  const entityId = entity || pair?.venueType || "food_hall";

  return (
    <SessionGate allowPrimedStation>
      <PosApp entityId={entityId} />
    </SessionGate>
  );
}
