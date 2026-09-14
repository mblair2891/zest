import { getSql } from "@/lib/db";

export type StationPairState =
  | { ok: true; status: string }
  | { ok: false; revoked: true; reason: "missing" | "deactivated" | "replaced" };

/**
 * Live pair check for a station. Missing / inactive / pending (Replace)
 * all revoke so the WebView returns to the pair-code screen.
 */
export async function readStationPairState(opts: {
  locationId: string;
  deviceId: string;
}): Promise<StationPairState> {
  const locationId = String(opts.locationId ?? "").trim().slice(0, 80);
  const deviceId = String(opts.deviceId ?? "").trim().slice(0, 80);
  if (!locationId || !deviceId) {
    return { ok: false, revoked: true, reason: "missing" };
  }
  const sql = await getSql();
  const rows = await sql<{ id: string; status: string; serial: string | null }>`
    select id, status, serial
    from location_devices
    where location_id = ${locationId}
      and (id = ${deviceId} or serial = ${deviceId})
    limit 1
  `.catch(() => [] as Array<{ id: string; status: string; serial: string | null }>);
  const row = rows[0];
  if (!row) return { ok: false, revoked: true, reason: "missing" };
  if (row.status === "inactive") {
    return { ok: false, revoked: true, reason: "deactivated" };
  }
  if (row.status !== "online") {
    return { ok: false, revoked: true, reason: "replaced" };
  }
  return { ok: true, status: row.status };
}
