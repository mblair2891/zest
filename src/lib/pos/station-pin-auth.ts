/**
 * Station PIN identity is the paired venue. Not platform Admin, not
 * Operating as, not a single selling entity.
 */
export const STATION_PIN_UNPAIRED =
  "This tablet is not paired. Scan the Devices QR or enter the code.";
export const STATION_PIN_WRONG_VENUE = "This tablet is paired to a different venue.";
export const STATION_PIN_INVALID = "Invalid PIN";

const VENUE_TYPE_IDS = new Set([
  "restaurant",
  "food_hall",
  "truck_pod",
  "ghost_kitchen",
  "catering",
  "bar_lounge",
  "cafe",
  "qsr",
  "saas",
]);

/** Location id used to hash/verify a floor PIN. Never a venue-type slug. */
export function stationPinAuthLocationId(opts: {
  pairLocationId?: string | null;
  tenantLocationId?: string | null;
  activeEntityId?: string | null;
}): string {
  const pair = String(opts.pairLocationId || "").trim();
  if (pair) return pair;
  const tenant = String(opts.tenantLocationId || "").trim();
  if (tenant && tenant !== "loc" && tenant !== "loc_local" && !VENUE_TYPE_IDS.has(tenant)) {
    return tenant;
  }
  return tenant || "loc";
}

export type StationPinVerifyOk = {
  ok: true;
  employee: {
    id: string;
    name: string;
    role: string;
    operatorId: string | null;
    active: boolean;
    pinHash: string;
  };
};

export type StationPinVerifyFail = {
  ok: false;
  error: string;
  code: "unpaired" | "wrong_venue" | "invalid";
};

export type StationPinVerifyResult = StationPinVerifyOk | StationPinVerifyFail;
