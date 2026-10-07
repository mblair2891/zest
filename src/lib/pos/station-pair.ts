/**
 * Persistent station pairing for the generic Play APK.
 * Survives app updates. Not wiped by POS persist or demo reset.
 */
import { isVenueEntityId } from "./entities";
import type { VenueEntityId } from "./types";
import { absolutePlatformHref } from "@/lib/platform/hosts";
import {
  encodePairQuery,
  normalizePairToken,
  parsePairScan,
  type PairDeviceRole,
} from "./station-pair-payload";

export {
  PAIR_TTL_MS,
  STATION_PAIR_INVALID,
  claimExpired,
  formatClaimExpiry,
  nextClaimExpiry,
  parsePairScan,
  type PairDeviceRole,
  type StationPairPayload,
} from "./station-pair-payload";

export type DeviceRole = "order" | "ods" | "host" | "kiosk";

export const STATION_PAIR_KEY = "summex-station-pair-v1";
const STATION_PIN_KEY = "summex-station-pin-v1";

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
    stationRaw === "order" || stationRaw === "ods" || stationRaw === "host" || stationRaw === "kiosk"
      ? stationRaw
      : null;
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

export function rememberStationPin(pin: string): void {
  if (typeof window === "undefined") return;
  const digits = String(pin ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length < 4) return;
  try {
    sessionStorage.setItem(STATION_PIN_KEY, digits);
  } catch {
    /* private mode */
  }
}

export function clearStationPin(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STATION_PIN_KEY);
  } catch {
    /* ignore */
  }
}

/** Device id plus the PIN entered on this paired tablet. Omitted when the pad is locked. */
export function stationFloorFields(): { stationDeviceId: string; stationPin: string } | null {
  if (typeof window === "undefined") return null;
  const pair = readStationPair();
  let pin = "";
  try {
    pin = sessionStorage.getItem(STATION_PIN_KEY) || "";
  } catch {
    pin = "";
  }
  if (!pair?.deviceId || !pair.locationId || pin.length < 4) return null;
  return { stationDeviceId: pair.deviceId, stationPin: pin };
}

export function clearStationPair(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STATION_PAIR_KEY);
  } catch {
    /* ignore */
  }
  clearStationPin();
}

/** Drop local pair + publish/role so this tablet returns to the pair-code field. */
export function ejectDeletedStationPair(): void {
  const loc = readStationPair()?.locationId;
  clearStationPair();
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("summex-station-publish-state-v1");
    localStorage.removeItem("summex-station-role-state-v1");
  } catch {
    /* ignore */
  }
  if (loc) {
    void import("@/lib/offline/idb")
      .then((m) => m.idbClearLocation(loc))
      .catch(() => undefined);
  }
}

/** Pairing must survive APK updates and demo reset. Never bulk-delete this key. */
export function isDurableStationStorageKey(key: string): boolean {
  return (
    key === STATION_PAIR_KEY ||
    key === "summex-station-publish-state-v1" ||
    key === "summex-station-role-state-v1" ||
    key === "summex-tenant-pos-v1"
  );
}

export function normalizeClaimCode(raw: string): string {
  return normalizePairToken(raw);
}

export function stationPairPath(
  code: string,
  extras?: { venue?: string; role?: PairDeviceRole },
): string {
  return encodePairQuery({ token: code, venue: extras?.venue, role: extras?.role });
}

export function stationPairHref(
  code: string,
  origin?: string,
  extras?: { venue?: string; role?: PairDeviceRole },
): string {
  const path = stationPairPath(code, extras);
  if (origin) return `${origin.replace(/\/$/, "")}${path}`;
  return absolutePlatformHref(path);
}

export function pairQrImageSrc(
  code: string,
  origin?: string,
  extras?: { venue?: string; role?: PairDeviceRole },
): string {
  const url = stationPairHref(code, origin, extras);
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(url)}`;
}

export function pairPayloadFromScan(raw: string) {
  return parsePairScan(raw);
}
