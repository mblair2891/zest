/**
 * Persistent station pairing for the generic Play APK.
 * Survives app updates. Not wiped by POS persist or demo reset.
 */
import { isVenueEntityId } from "./entities";
import type { VenueEntityId } from "./types";

export type DeviceRole = "order" | "ods" | "host";

export const STATION_PAIR_KEY = "summex-station-pair-v1";

export type StationPairRecord = {
  locationId: string;
  orgId: string;
  locationName: string;
  orgName: string;
  venueType: VenueEntityId;
  station: DeviceRole;
  deviceId: string;
  claimCode: string;
};

function asRecord(raw: unknown): StationPairRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const locationId = String(o.locationId ?? "").trim();
  const stationRaw = String(o.station ?? "");
  const station: DeviceRole | null =
    stationRaw === "order" || stationRaw === "ods" || stationRaw === "host" ? stationRaw : null;
  const venueRaw = String(o.venueType ?? "food_hall");
  const venueType = isVenueEntityId(venueRaw) ? venueRaw : "food_hall";
  if (!locationId || !station) return null;
  return {
    locationId,
    orgId: String(o.orgId ?? "").trim(),
    locationName: String(o.locationName ?? "Location").trim() || "Location",
    orgName: String(o.orgName ?? "").trim(),
    venueType,
    station,
    deviceId: String(o.deviceId ?? "").trim(),
    claimCode: String(o.claimCode ?? "")
      .replace(/[\s-]/g, "")
      .toUpperCase(),
  };
}

export function readStationPair(): StationPairRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATION_PAIR_KEY);
    if (!raw) return null;
    return asRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeStationPair(row: StationPairRecord): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATION_PAIR_KEY, JSON.stringify(row));
  } catch {
    /* private mode */
  }
}

export function clearStationPair(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STATION_PAIR_KEY);
  } catch {
    /* ignore */
  }
}

/** Pairing must survive APK updates and demo reset. Never bulk-delete this key. */
export function isDurableStationStorageKey(key: string): boolean {
  return key === STATION_PAIR_KEY || key === "summex-station-publish-state-v1";
}

export function normalizeClaimCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase().slice(0, 12);
}

export function stationPairPath(code: string): string {
  return `/station?pair=${encodeURIComponent(normalizeClaimCode(code))}`;
}

export function stationPairHref(code: string, origin?: string): string {
  const path = stationPairPath(code);
  if (origin) return `${origin.replace(/\/$/, "")}${path}`;
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return `https://summex.app${path}`;
}

export function pairQrImageSrc(code: string, origin?: string): string {
  const url = stationPairHref(code, origin);
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(url)}`;
}
