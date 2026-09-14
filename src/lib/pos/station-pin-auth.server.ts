import { getSql } from "@/lib/db";
import { hashPin, isFourDigitPin } from "@/lib/pos/pin";
import {
  STATION_PIN_DEACTIVATED,
  STATION_PIN_INVALID,
  STATION_PIN_UNPAIRED,
  STATION_PIN_WRONG_VENUE,
  type StationPinVerifyResult,
} from "./station-pin-auth";

/**
 * Live PIN check against location_staff for the paired device's venue.
 * House order/host devices accept every active PIN at that location —
 * including peer-entity staff (e.g. Copper Bar bartender on a house tablet).
 */
export async function verifyStationPin(opts: {
  pin: string;
  deviceId: string;
  locationId: string;
}): Promise<StationPinVerifyResult> {
  const pin = String(opts.pin ?? "").replace(/\D/g, "");
  const deviceId = String(opts.deviceId ?? "").trim().slice(0, 80);
  const claimedLoc = String(opts.locationId ?? "").trim().slice(0, 80);
  if (!deviceId) {
    return { ok: false, error: STATION_PIN_UNPAIRED, code: "unpaired" };
  }
  if (!isFourDigitPin(pin) && !/^\d{4,8}$/.test(pin)) {
    return { ok: false, error: STATION_PIN_INVALID, code: "invalid" };
  }

  const sql = await getSql();
  const devices = await sql<{
    id: string;
    location_id: string;
    status: string;
  }>`
    select id, location_id, status
    from location_devices
    where (id = ${deviceId} or serial = ${deviceId})
    limit 2
  `.catch(() => [] as Array<{ id: string; location_id: string; status: string }>);

  if (!devices.length) {
    return { ok: false, error: STATION_PIN_UNPAIRED, code: "unpaired" };
  }
  const device = devices.find((d) => d.location_id === claimedLoc) ?? devices[0]!;
  if (device.status !== "online") {
    return { ok: false, error: STATION_PIN_DEACTIVATED, code: "deactivated" };
  }
  if (claimedLoc && device.location_id !== claimedLoc) {
    return { ok: false, error: STATION_PIN_WRONG_VENUE, code: "wrong_venue" };
  }

  const loc = device.location_id;
  const pinHash = hashPin(pin, loc);
  const rows = await sql<{
    id: string;
    name: string;
    role: string;
    operator_id: string | null;
    active: boolean;
    pin_hash: string | null;
    pin_display: string | null;
  }>`
    select id, name, role, operator_id, active, pin_hash, pin_display
    from location_staff
    where location_id = ${loc}
      and coalesce(active, true) = true
      and (
        pin_hash = ${pinHash}
        or pin_display = ${pin}
      )
    order by created_at asc
  `.catch(async () => {
    return sql<{
      id: string;
      name: string;
      role: string;
      operator_id: string | null;
      active: boolean;
      pin_hash: string | null;
      pin_display: string | null;
    }>`
      select id, name, role, operator_id, active, pin_hash, null as pin_display
      from location_staff
      where location_id = ${loc}
        and coalesce(active, true) = true
        and pin_hash = ${pinHash}
      order by created_at asc
    `.catch(() => []);
  });

  const hit = rows[0];
  if (!hit) {
    return { ok: false, error: STATION_PIN_INVALID, code: "invalid" };
  }

  if (hit.pin_hash !== pinHash) {
    try {
      await sql`
        update location_staff
        set pin_hash = ${pinHash}
        where id = ${hit.id} and location_id = ${loc}
      `;
    } catch {
      /* optional backfill */
    }
  }

  return {
    ok: true,
    employee: {
      id: hit.id,
      name: hit.name,
      role: hit.role,
      operatorId: hit.operator_id,
      active: hit.active !== false,
      pinHash,
    },
  };
}
