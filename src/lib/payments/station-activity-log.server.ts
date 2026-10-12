/**
 * Location log of card-reader connects, entity matches, and Finix key status.
 * The password and the username are not written.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import {
  isStationActivityAction,
  sanitizeActivityResult,
  stationActivityLogText,
  type StationActivityAction,
  type StationActivityEntry,
  type StationActivityPresence,
} from "./station-activity-log";

const PREVIEW_LIMIT = 20;
const FULL_LIMIT = 500;

export type StationActivityInput = {
  locationId: string;
  stationName: string;
  action: StationActivityAction;
  environment: string;
  usernamePresent: StationActivityPresence;
  passwordPresent: StationActivityPresence;
  merchantId: string;
  deviceId: string;
  checkEntity: string;
  readerEntity: string;
  result: string;
};

type ActivityRow = {
  id: string;
  at: Date | string;
  station_name: string;
  action: string;
  environment: string;
  username_present: string;
  password_present: string;
  merchant_id: string;
  device_id: string;
  check_entity: string;
  reader_entity: string;
  result: string;
};

function presence(raw: string): StationActivityPresence {
  const value = raw.trim().toLowerCase();
  if (value === "yes" || value === "no") return value;
  return "";
}

function atIso(value: Date | string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return String(value);
}

function mapRow(row: ActivityRow): StationActivityEntry | null {
  if (!isStationActivityAction(row.action)) return null;
  return {
    id: row.id,
    at: atIso(row.at),
    stationName: row.station_name,
    action: row.action,
    environment: row.environment,
    usernamePresent: presence(row.username_present),
    passwordPresent: presence(row.password_present),
    merchantId: row.merchant_id,
    deviceId: row.device_id,
    checkEntity: row.check_entity,
    readerEntity: row.reader_entity,
    result: row.result,
  };
}

async function orgForLocation(locationId: string): Promise<string> {
  const sql = await getSql();
  const rows = await sql<{ org_id: string }>`
    select org_id from locations where id = ${locationId} limit 1
  `;
  const orgId = rows[0]?.org_id;
  if (!orgId) throw new ForbiddenError("Location not found");
  return orgId;
}

export async function recordStationActivity(
  userId: string,
  input: StationActivityInput,
): Promise<{ ok: true }> {
  const orgId = await orgForLocation(input.locationId);
  await requireMembership(userId, orgId, undefined, input.locationId);
  const sql = await getSql();
  await sql`
    insert into station_activity_log (
      id, location_id, station_name, action, environment,
      username_present, password_present, merchant_id, device_id,
      check_entity, reader_entity, result
    ) values (
      ${newId("sal")},
      ${input.locationId},
      ${input.stationName.slice(0, 80) || "Station"},
      ${input.action},
      ${input.environment.slice(0, 8)},
      ${input.usernamePresent},
      ${input.passwordPresent},
      ${input.merchantId.slice(0, 80)},
      ${input.deviceId.slice(0, 80)},
      ${input.checkEntity.slice(0, 120)},
      ${input.readerEntity.slice(0, 120)},
      ${sanitizeActivityResult(input.result)}
    )
  `;
  return { ok: true };
}

export async function listStationActivity(
  userId: string,
  locationId: string,
  full: boolean,
): Promise<{ entries: StationActivityEntry[]; text: string }> {
  const orgId = await orgForLocation(locationId);
  await requireMembership(userId, orgId, undefined, locationId);
  const sql = await getSql();
  const limit = full ? FULL_LIMIT : PREVIEW_LIMIT;
  const rows = await sql<ActivityRow>`
    select
      id, at, station_name, action, environment,
      username_present, password_present, merchant_id, device_id,
      check_entity, reader_entity, result
    from station_activity_log
    where location_id = ${locationId}
    order by at desc
    limit ${limit}
  `;
  const entries = rows.flatMap((row) => {
    const entry = mapRow(row);
    return entry ? [entry] : [];
  });
  return { entries, text: stationActivityLogText(entries) };
}
