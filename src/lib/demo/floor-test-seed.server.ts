/**
 * Idempotent floor-test seed: hashed PINs + device configs.
 * Not is_demo. Factory reset wipes then reseeds. Never touches Platform Admin.
 */
import { getSql } from "@/lib/db";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { hashPin } from "@/lib/pos/pin";
import { defaultPackagesForMode } from "@/lib/pos/packages";
import { parseLocationDevices, type LocationDevice } from "@/lib/pos/location-devices";
import type { Employee, EmployeeRole } from "@/lib/pos/types";
import {
  FLOOR_TEST_DEVICES,
  FLOOR_TEST_LOCATION_ID,
  FLOOR_TEST_LOCATION_NAME,
  FLOOR_TEST_ORG_ID,
  FLOOR_TEST_ORG_NAME,
  FLOOR_TEST_SLUG,
  FLOOR_TEST_STAFF,
  type FloorTestInfo,
} from "./floor-test";

const globalRef = globalThis as typeof globalThis & {
  __summexFloorTestBoot__?: Promise<FloorTestInfo | { ok: false; reason: string }>;
};

function dbNotReady(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /database not ready/i.test(msg) ||
    /relation .* does not exist/i.test(msg) ||
    /does not exist/i.test(msg) ||
    /column .* does not exist/i.test(msg) ||
    /ENOENT|pglite/i.test(msg) ||
    /ECONNREFUSED|ENOTFOUND|connection refused|timeout/i.test(msg)
  );
}

export function floorTestDevicesFor(locationId: string): LocationDevice[] {
  const now = Date.now();
  return FLOOR_TEST_DEVICES.map((d) => ({
    id: d.id,
    locationId,
    label: d.label,
    type: d.type,
    status: "online" as const,
    lastSeenAt: now,
    serial: d.serial,
    assignment: { operatorId: HOST_SCOPE, function: d.function },
  }));
}

export function floorTestEmployeesFor(locationId: string): Employee[] {
  return FLOOR_TEST_STAFF.map((s) => ({
    id: s.id,
    name: s.name,
    pin: "",
    pinHash: hashPin(s.pin, locationId),
    role: s.role,
    color: s.color,
    clockedIn: false,
    tipsEarned: 0,
    salesTotal: 0,
    active: true,
    homeSectionIds: [],
  }));
}

type LocPick = {
  id: string;
  org_id: string;
  name: string;
  venue_type: string;
  org_name: string;
};

async function pickTarget(): Promise<{ loc: LocPick; created: boolean }> {
  const sql = await getSql();
  const dedicated = await sql<LocPick>`
    select l.id, l.org_id, l.name, l.venue_type, o.name as org_name
    from locations l
    join organizations o on o.id = l.org_id
    where l.id = ${FLOOR_TEST_LOCATION_ID}
    limit 1
  `;
  if (dedicated[0]) return { loc: dedicated[0], created: false };

  const real = await sql<LocPick>`
    select l.id, l.org_id, l.name, l.venue_type, o.name as org_name
    from locations l
    join organizations o on o.id = l.org_id
    where coalesce(l.is_demo, false) = false
    order by l.created_at asc
  `;
  if (real.length === 1 && real[0]) return { loc: real[0], created: false };

  await upsertTestOrg();
  await insertTestLocation();
  const created = await sql<LocPick>`
    select l.id, l.org_id, l.name, l.venue_type, o.name as org_name
    from locations l
    join organizations o on o.id = l.org_id
    where l.id = ${FLOOR_TEST_LOCATION_ID}
    limit 1
  `;
  if (!created[0]) throw new Error("Could not create Test Location");
  return { loc: created[0], created: true };
}

async function upsertTestOrg(): Promise<void> {
  const sql = await getSql();
  const hit = await sql<{ id: string }>`
    select id from organizations where id = ${FLOOR_TEST_ORG_ID} limit 1
  `;
  if (!hit[0]) {
    await sql`
      insert into organizations (
        id, name, slug, status, venue_default_type,
        legal_name, dba, is_demo
      )
      values (
        ${FLOOR_TEST_ORG_ID},
        ${FLOOR_TEST_ORG_NAME},
        ${FLOOR_TEST_SLUG},
        ${"active"},
        ${"restaurant"},
        ${FLOOR_TEST_ORG_NAME},
        ${FLOOR_TEST_LOCATION_NAME},
        ${false}
      )
    `;
  }
  await sql`
    update organizations
    set name = ${FLOOR_TEST_ORG_NAME},
        is_demo = ${false},
        status = ${"active"}
    where id = ${FLOOR_TEST_ORG_ID}
  `;
}

async function insertTestLocation(): Promise<void> {
  const sql = await getSql();
  const pkgs = JSON.stringify(defaultPackagesForMode("restaurant"));
  const devices = floorTestDevicesFor(FLOOR_TEST_LOCATION_ID);
  const setup = JSON.stringify({
    tableCount: 8,
    sectionNames: ["Dining"],
    floorLater: false,
    menuMode: "starter",
    devices: { pos: 2, kds: 2, handhelds: 0 },
    settlement: { periodType: "weekly", hostCutPercent: 0 },
    hostBrandName: FLOOR_TEST_LOCATION_NAME,
    timezone: "America/Los_Angeles",
    lifecycleStatus: "training",
    floorTestSeed: true,
    locationDevices: devices,
  });
  const existing = await sql<{ id: string }>`
    select id from locations where id = ${FLOOR_TEST_LOCATION_ID} limit 1
  `;
  if (existing[0]) return;
  await sql`
    insert into locations (
      id, org_id, name, venue_type, timezone, status, enabled_packages,
      address, host_brand_name, operating_model, setup,
      is_demo, lifecycle_status
    )
    values (
      ${FLOOR_TEST_LOCATION_ID},
      ${FLOOR_TEST_ORG_ID},
      ${FLOOR_TEST_LOCATION_NAME},
      ${"restaurant"},
      ${"America/Los_Angeles"},
      ${"active"},
      ${pkgs}::jsonb,
      ${"Test Location — floor PIN / device sandbox"},
      ${FLOOR_TEST_LOCATION_NAME},
      ${"single"},
      ${setup}::jsonb,
      ${false},
      ${"training"}
    )
  `;
}

async function upsertStaff(locationId: string): Promise<void> {
  const sql = await getSql();
  for (const s of FLOOR_TEST_STAFF) {
    const pinHash = hashPin(s.pin, locationId);
    await sql`
      insert into location_staff (
        id, location_id, operator_id, name, role, pin_hash, active
      )
      values (
        ${s.id}, ${locationId}, ${null}, ${s.name}, ${s.role}, ${pinHash}, ${true}
      )
      on conflict (id) do update set
        location_id = excluded.location_id,
        name = excluded.name,
        role = excluded.role,
        pin_hash = excluded.pin_hash,
        active = ${true}
    `;
  }
}

async function upsertDevices(locationId: string): Promise<void> {
  const sql = await getSql();
  const devices = floorTestDevicesFor(locationId);
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where id = ${locationId} limit 1
  `;
  const raw = rows[0]?.setup;
  const setup =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  const existing = parseLocationDevices(setup.locationDevices);
  const byId = new Map(existing.map((d) => [d.id, d]));
  for (const d of devices) byId.set(d.id, d);
  setup.locationDevices = [...byId.values()];
  setup.floorTestSeed = true;
  await sql`
    update locations
    set setup = ${JSON.stringify(setup)}::jsonb
    where id = ${locationId}
  `;
  for (const d of devices) {
    try {
      await sql`
        insert into location_devices (
          id, location_id, label, type, status, serial,
          assigned_operator_id, assigned_function, last_seen_at
        )
        values (
          ${d.id}, ${locationId}, ${d.label}, ${d.type}, ${d.status},
          ${d.serial ?? null}, ${d.assignment.operatorId}, ${d.assignment.function},
          ${new Date(d.lastSeenAt).toISOString()}
        )
        on conflict (id) do update set
          location_id = excluded.location_id,
          label = excluded.label,
          type = excluded.type,
          assigned_operator_id = excluded.assigned_operator_id,
          assigned_function = excluded.assigned_function
      `;
    } catch {
      /* 0012 may not have applied */
    }
  }
}

export async function listFloorStaffForLocation(locationId: string): Promise<Employee[]> {
  const sql = await getSql();
  try {
    const rows = await sql<{
      id: string;
      name: string;
      role: string;
      pin_hash: string | null;
      operator_id: string | null;
      active: boolean;
    }>`
      select id, name, role, pin_hash, operator_id, active
      from location_staff
      where location_id = ${locationId} and coalesce(active, true) = true
    `;
    const colors = ["#2C4A6E", "#1F7A4C", "#9A6700", "#5C5C5C", "#A61B1B", "#4A5568"];
    return rows.map((r, i) => ({
      id: r.id,
      name: r.name,
      pin: "",
      pinHash: r.pin_hash ?? undefined,
      role: (r.role as EmployeeRole) || "server",
      color: colors[i % colors.length]!,
      clockedIn: false,
      tipsEarned: 0,
      salesTotal: 0,
      active: r.active !== false,
      homeSectionIds: [],
      operatorId: r.operator_id || undefined,
    }));
  } catch {
    return floorTestEmployeesFor(locationId);
  }
}

async function seedOnce(): Promise<FloorTestInfo> {
  const { loc, created } = await pickTarget();
  await upsertStaff(loc.id);
  await upsertDevices(loc.id);
  return {
    locationId: loc.id,
    locationName: loc.name,
    orgName: loc.org_name,
    venueType: loc.venue_type,
    createdLocation: created,
    staff: FLOOR_TEST_STAFF.map((s) => ({ pin: s.pin, role: s.role, name: s.name })),
    devices: FLOOR_TEST_DEVICES.map((d) => ({ label: d.label, function: d.function })),
  };
}

export async function ensureFloorTestSeed(): Promise<
  FloorTestInfo | { ok: false; reason: string }
> {
  globalRef.__summexFloorTestBoot__ ??= (async () => {
    try {
      return await seedOnce();
    } catch (err) {
      globalRef.__summexFloorTestBoot__ = undefined;
      if (dbNotReady(err)) return { ok: false, reason: "Database not ready" };
      throw err;
    }
  })();
  return globalRef.__summexFloorTestBoot__;
}

export async function reseedFloorTest(): Promise<FloorTestInfo | { ok: false; reason: string }> {
  globalRef.__summexFloorTestBoot__ = undefined;
  return ensureFloorTestSeed();
}

export async function getFloorTestInfo(): Promise<FloorTestInfo | null> {
  const result = await ensureFloorTestSeed();
  if ("ok" in result && result.ok === false) return null;
  return result as FloorTestInfo;
}
