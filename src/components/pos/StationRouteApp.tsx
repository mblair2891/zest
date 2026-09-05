import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { SessionGate } from "@/components/pos/SessionGate";
import { StationPairScreen } from "@/components/pos/StationPairScreen";
import { SummexMark } from "@/components/brand/SummexMark";
import { isVenueEntityId } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";
import { resolvePrimedLocation } from "@/lib/offline/location-snapshot";
import { rememberLastPosPath } from "@/lib/offline/register-sw";
import type { DeviceRole } from "@/lib/pos/device-roles";
import {
  normalizeClaimCode,
  readStationPair,
  type StationPairRecord,
} from "@/lib/pos/station-pair";
import { writePairedDeviceId } from "@/lib/pos/location-devices";

export type StationSearch = {
  station?: DeviceRole;
  loc?: string;
  pair?: string;
};

/** Shared shell for `/station?station=` and `/station/:role`. Never the sales `/`. */
export function StationRouteApp({
  roleFromPath,
  search,
}: {
  roleFromPath?: DeviceRole | null;
  search: StationSearch;
}) {
  const navigate = useNavigate();
  const [pair, setPair] = useState<StationPairRecord | null>(() => readStationPair());
  const [entity, setEntity] = useState<VenueEntityId | null>(null);
  const [ready, setReady] = useState(false);

  const onPaired = (row: StationPairRecord) => {
    if (row.deviceId) writePairedDeviceId(row.locationId, row.deviceId);
    setPair(row);
    void navigate({
      to: "/station/$role",
      params: { role: row.station },
      search: { loc: row.locationId },
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
    return (
      <StationPairScreen
        initialCode={search.pair ? normalizeClaimCode(search.pair) : ""}
        onPaired={onPaired}
      />
    );
  }

  const entityId = entity || pair?.venueType || "food_hall";

  return (
    <SessionGate allowPrimedStation>
      <div data-station-role={roleFromPath || search.station || pair?.station || ""}>
        <PosApp entityId={entityId} />
      </div>
    </SessionGate>
  );
}
