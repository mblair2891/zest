/**
 * Idempotent partner-demo seed. Server-only.
 *
 * Tagged is_partner_demo (not is_demo). Not a public demo tenant.
 * Factory reset reseeds this after Admin bootstrap. Never touches Platform Admin.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { PLATFORM_ADMIN_EMAIL } from "@/lib/platform/brand";
import { defaultPackagesForMode } from "@/lib/pos/packages";
import { hashPin } from "@/lib/pos/pin";
import { LAUNDRY_EMPLOYEES, laundryLocationDevices } from "@/lib/pos/laundry-seed";
import {
  PARTNER_DEMO_EMAILS,
  PARTNER_DEMO_LOCATION_ID,
  PARTNER_DEMO_LOCATION_NAME,
  PARTNER_DEMO_ORG_ID,
  PARTNER_DEMO_ORG_NAME,
  PARTNER_DEMO_SLUG,
  PARTNER_DEMO_USERS,
  PARTNER_DIAMOND_ID,
  PARTNER_STEAM_ID,
  type PartnerDemoUserSpec,
} from "./partner-demo";

/** Shared partner password. Must-change is OFF (not in platform_admin). */
export const PARTNER_DEMO_PASSWORD = "PartnerDemo1!";

const LEGACY_ADMIN_EMAIL = "admin@zest.local";

const globalRef = globalThis as typeof globalThis & {
  __summexPartnerDemoBoot__?: Promise<{ ok: true } | { ok: false; reason: string }>;
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

async function columnReady(): Promise<boolean> {
  const sql = await getSql();
  try {
    await sql`select is_partner_demo from organizations limit 0`;
    await sql`select is_partner_demo from locations limit 0`;
    return true;
  } catch {
    return false;
  }
}

async function upsertOrg(): Promise<void> {
  const sql = await getSql();
  const now = new Date().toISOString();
  const existing = await sql<{ id: string }>`
    select id from organizations where id = ${PARTNER_DEMO_ORG_ID} limit 1
  `;
  if (!existing[0]) {
    await sql`
      insert into organizations (
        id, name, slug, status, venue_default_type,
        legal_name, dba, billing_email, phone, hq_address,
        is_demo, is_partner_demo
      )
      values (
        ${PARTNER_DEMO_ORG_ID},
        ${PARTNER_DEMO_ORG_NAME},
        ${PARTNER_DEMO_SLUG},
        ${"active"},
        ${"food_hall"},
        ${PARTNER_DEMO_ORG_NAME},
        ${PARTNER_DEMO_LOCATION_NAME},
        ${"laundry.owner@demo.summex.app"},
        ${"(555) 010-0000"},
        ${"The Laundry · partner demo"},
        ${false},
        ${true}
      )
    `;
  }
  await sql`
    update organizations
    set name = ${PARTNER_DEMO_ORG_NAME},
        legal_name = ${PARTNER_DEMO_ORG_NAME},
        dba = ${PARTNER_DEMO_LOCATION_NAME},
        billing_email = ${"laundry.owner@demo.summex.app"},
        is_demo = ${false},
        is_partner_demo = ${true},
        status = ${"active"},
        venue_default_type = ${"food_hall"}
    where id = ${PARTNER_DEMO_ORG_ID}
  `;
  try {
    await sql`
      update organizations
      set host_status = ${"host_ready"},
          timezone = ${"America/Los_Angeles"},
          currency = ${"USD"}
      where id = ${PARTNER_DEMO_ORG_ID}
    `;
  } catch {
    /* 0019 columns */
  }
  const sub = await sql<{ id: string }>`
    select id from org_subscriptions where org_id = ${PARTNER_DEMO_ORG_ID} limit 1
  `;
  const periodEnd = new Date(Date.now() + 365 * 86400000).toISOString();
  if (!sub[0]) {
    await sql`
      insert into org_subscriptions (
        id, org_id, plan_id, status, current_period_end,
        max_locations_override, max_seats_override
      )
      values (
        ${"sub_partner_laundry"},
        ${PARTNER_DEMO_ORG_ID},
        ${"food_hall"},
        ${"active"},
        ${periodEnd},
        ${5},
        ${40}
      )
    `;
  } else {
    await sql`
      update org_subscriptions
      set plan_id = ${"food_hall"},
          status = ${"active"},
          max_locations_override = ${5},
          max_seats_override = ${40},
          updated_at = ${now}
      where org_id = ${PARTNER_DEMO_ORG_ID}
    `;
  }
}

async function upsertLocation(): Promise<void> {
  const sql = await getSql();
  const pkgs = JSON.stringify(defaultPackagesForMode("food_hall"));
  const devices = laundryLocationDevices(PARTNER_DEMO_LOCATION_ID);
  const setup = JSON.stringify({
    tableCount: 10,
    sectionNames: ["Dining", "Bar"],
    floorLater: false,
    menuMode: "categories",
    devices: { pos: 3, kds: 2, handhelds: 2 },
    settlement: { periodType: "weekly", hostCutPercent: 5 },
    hostBrandName: PARTNER_DEMO_LOCATION_NAME,
    timezone: "America/Los_Angeles",
    kioskMode: "combined",
    waitlistEnabled: true,
    reservationCheckIn: true,
    lifecycleStatus: "live",
    locationDevices: devices,
  });
  const existing = await sql<{ id: string }>`
    select id from locations where id = ${PARTNER_DEMO_LOCATION_ID} limit 1
  `;
  if (!existing[0]) {
    await sql`
      insert into locations (
        id, org_id, name, venue_type, timezone, status, enabled_packages,
        address, host_brand_name, operating_model, setup,
        is_demo, is_partner_demo, lifecycle_status
      )
      values (
        ${PARTNER_DEMO_LOCATION_ID},
        ${PARTNER_DEMO_ORG_ID},
        ${PARTNER_DEMO_LOCATION_NAME},
        ${"food_hall"},
        ${"America/Los_Angeles"},
        ${"active"},
        ${pkgs}::jsonb,
        ${"The Laundry · partner demo"},
        ${PARTNER_DEMO_LOCATION_NAME},
        ${"host_operators"},
        ${setup}::jsonb,
        ${false},
        ${true},
        ${"live"}
      )
    `;
  } else {
    await sql`
      update locations
      set name = ${PARTNER_DEMO_LOCATION_NAME},
          venue_type = ${"food_hall"},
          operating_model = ${"host_operators"},
          host_brand_name = ${PARTNER_DEMO_LOCATION_NAME},
          enabled_packages = ${pkgs}::jsonb,
          setup = ${setup}::jsonb,
          is_demo = ${false},
          is_partner_demo = ${true},
          status = ${"active"},
          lifecycle_status = ${"live"},
          org_id = ${PARTNER_DEMO_ORG_ID}
      where id = ${PARTNER_DEMO_LOCATION_ID}
    `;
  }
  for (const d of devices) {
    try {
      await sql`
        insert into location_devices (
          id, location_id, label, type, status, serial, claim_code,
          assigned_operator_id, assigned_function, last_seen_at
        )
        values (
          ${d.id}, ${PARTNER_DEMO_LOCATION_ID}, ${d.label}, ${d.type}, ${d.status},
          ${d.serial ?? null}, ${d.claimCode ?? null},
          ${d.assignment.operatorId}, ${d.assignment.function},
          ${new Date(d.lastSeenAt).toISOString()}
        )
        on conflict (id) do update set
          label = excluded.label,
          type = excluded.type,
          status = excluded.status,
          serial = excluded.serial,
          assigned_operator_id = excluded.assigned_operator_id,
          assigned_function = excluded.assigned_function,
          last_seen_at = excluded.last_seen_at
      `;
    } catch {
      /* 0012 may not have applied yet */
    }
  }
}

async function upsertOperators(): Promise<void> {
  const sql = await getSql();
  const ops: Array<{
    id: string;
    legal: string;
    dba: string;
    email: string;
    kind: "bar" | "kitchen";
    stations: string;
  }> = [
    {
      id: PARTNER_STEAM_ID,
      legal: "Steam Distillery",
      dba: "Steam Distillery",
      email: "steam.owner@demo.summex.app",
      kind: "bar",
      stations: JSON.stringify(["bar"]),
    },
    {
      id: PARTNER_DIAMOND_ID,
      legal: "Diamond House BBQ",
      dba: "Diamond House BBQ",
      email: "diamond.owner@demo.summex.app",
      kind: "kitchen",
      stations: JSON.stringify(["kitchen"]),
    },
  ];
  for (const op of ops) {
    const hit = await sql<{ id: string }>`select id from operators where id = ${op.id} limit 1`;
    if (!hit[0]) {
      await sql`
        insert into operators (
          id, org_id, location_id, legal_name, dba, contact_email,
          station_types, station_kind, poc_name, onboard_status
        )
        values (
          ${op.id},
          ${PARTNER_DEMO_ORG_ID},
          ${PARTNER_DEMO_LOCATION_ID},
          ${op.legal},
          ${op.dba},
          ${op.email},
          ${op.stations}::jsonb,
          ${op.kind},
          ${op.legal},
          ${"complete"}
        )
      `;
    } else {
      await sql`
        update operators
        set org_id = ${PARTNER_DEMO_ORG_ID},
            location_id = ${PARTNER_DEMO_LOCATION_ID},
            legal_name = ${op.legal},
            dba = ${op.dba},
            contact_email = ${op.email},
            station_types = ${op.stations}::jsonb,
            station_kind = ${op.kind},
            poc_name = ${op.legal},
            onboard_status = ${"complete"}
        where id = ${op.id}
      `;
    }
  }
}

async function isProtectedAdmin(userId: string, email: string): Promise<boolean> {
  const sql = await getSql();
  const e = email.trim().toLowerCase();
  if (e === PLATFORM_ADMIN_EMAIL.toLowerCase() || e === LEGACY_ADMIN_EMAIL) return true;
  const flagged = await sql<{ n: number }>`
    select 1 as n from platform_admin where user_id = ${userId} limit 1
  `;
  return Boolean(flagged[0]);
}

async function upsertUser(
  spec: PartnerDemoUserSpec,
  passwordHash: string,
): Promise<string | null> {
  const sql = await getSql();
  const email = spec.email.toLowerCase();
  const now = new Date().toISOString();
  const existing = await sql<{ id: string; email: string }>`
    select id, email from "user" where email = ${email} limit 1
  `;
  let userId = existing[0]?.id;
  if (userId && (await isProtectedAdmin(userId, email))) {
    return null;
  }
  if (!userId) {
    userId = `usr_pd_${spec.username.replace(/\./g, "_")}`;
    const idTaken = await sql<{ id: string }>`select id from "user" where id = ${userId} limit 1`;
    if (idTaken[0]) userId = randomUUID();
    await sql`
      insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
      values (
        ${userId},
        ${spec.name},
        ${email},
        ${true},
        ${null},
        ${now},
        ${now}
      )
    `;
  } else {
    await sql`
      update "user"
      set name = ${spec.name}, "emailVerified" = ${true}, "updatedAt" = ${now}
      where id = ${userId}
    `;
  }
  const accounts = await sql<{ id: string }>`
    select id from "account"
    where "userId" = ${userId} and "providerId" = ${"credential"}
    limit 1
  `;
  if (accounts[0]) {
    await sql`
      update "account"
      set password = ${passwordHash}, "updatedAt" = ${now}
      where id = ${accounts[0].id}
    `;
  } else {
    await sql`
      insert into "account" (
        id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
      )
      values (
        ${randomUUID()},
        ${userId},
        ${"credential"},
        ${userId},
        ${passwordHash},
        ${now},
        ${now}
      )
    `;
  }
  const mems = await sql<{ id: string }>`
    select id from memberships
    where user_id = ${userId} and org_id = ${PARTNER_DEMO_ORG_ID}
    limit 1
  `;
  const locationId = spec.operatorId ? PARTNER_DEMO_LOCATION_ID : null;
  if (mems[0]) {
    await sql`
      update memberships
      set role = ${spec.role},
          status = ${"active"},
          operator_id = ${spec.operatorId},
          location_id = ${locationId}
      where id = ${mems[0].id}
    `;
  } else {
    await sql`
      insert into memberships (id, user_id, org_id, location_id, role, status, operator_id)
      values (
        ${randomUUID()},
        ${userId},
        ${PARTNER_DEMO_ORG_ID},
        ${locationId},
        ${spec.role},
        ${"active"},
        ${spec.operatorId}
      )
    `;
  }
  return userId;
}

async function upsertFloorStaff(): Promise<void> {
  const sql = await getSql();
  for (const emp of LAUNDRY_EMPLOYEES) {
    const pin = emp.pin?.replace(/\D/g, "").slice(0, 4) ?? "";
    const pinHash = pin.length === 4 ? hashPin(pin, PARTNER_DEMO_LOCATION_ID) : null;
    const opId = emp.operatorId ?? null;
    const hit = await sql<{ id: string }>`
      select id from location_staff where id = ${emp.id} limit 1
    `;
    if (!hit[0]) {
      await sql`
        insert into location_staff (
          id, location_id, operator_id, name, role, pin_hash, active
        )
        values (
          ${emp.id},
          ${PARTNER_DEMO_LOCATION_ID},
          ${opId},
          ${emp.name},
          ${emp.role},
          ${pinHash},
          ${true}
        )
      `;
    } else {
      await sql`
        update location_staff
        set location_id = ${PARTNER_DEMO_LOCATION_ID},
            operator_id = ${opId},
            name = ${emp.name},
            role = ${emp.role},
            pin_hash = ${pinHash},
            active = ${true}
        where id = ${emp.id}
      `;
    }
  }
}

async function seedOnce(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!(await columnReady())) {
    return { ok: false, reason: "is_partner_demo column missing" };
  }
  await upsertOrg();
  await upsertLocation();
  await upsertOperators();
  const passwordHash = await hashPassword(PARTNER_DEMO_PASSWORD);
  for (const spec of PARTNER_DEMO_USERS) {
    await upsertUser(spec, passwordHash);
  }
  await upsertFloorStaff();
  return { ok: true };
}

export async function ensurePartnerDemoSeed(): Promise<{ ok: true } | { ok: false; reason: string }> {
  return { ok: false, reason: "partner demo seed retired" };
}

/** Drop the tagged partner-demo org + its logins. Never deletes Platform Admin. */
export async function purgePartnerDemoSeed(): Promise<{ removed: number }> {
  const sql = await getSql();
  if (!(await columnReady())) return { removed: 0 };
  const before = await sql<{ n: number }>`
    select count(*)::int as n from organizations where coalesce(is_partner_demo, false) = true
  `;
  await sql`delete from locations where coalesce(is_partner_demo, false) = true`;
  await sql`delete from organizations where coalesce(is_partner_demo, false) = true`;
  for (const email of PARTNER_DEMO_EMAILS) {
    const rows = await sql<{ id: string }>`
      select id from "user" where email = ${email} limit 1
    `;
    const id = rows[0]?.id;
    if (!id) continue;
    if (await isProtectedAdmin(id, email)) continue;
    await sql`delete from "user" where id = ${id}`;
  }
  globalRef.__summexPartnerDemoBoot__ = undefined;
  return { removed: Number(before[0]?.n ?? 0) };
}

/** Force a re-run (factory reset). */
export async function reseedPartnerDemo(): Promise<{ ok: true } | { ok: false; reason: string }> {
  globalRef.__summexPartnerDemoBoot__ = undefined;
  return ensurePartnerDemoSeed();
}
