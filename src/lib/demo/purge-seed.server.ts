/**
 * One-shot wipe of seeded demo tenants. Never deletes Platform Admin.
 * Does not touch real CRM / customer orgs (is_demo and is_partner_demo false).
 */
import { getSql } from "@/lib/db";
import { PLATFORM_ADMIN_EMAIL } from "@/lib/platform/brand";
import { PARTNER_DEMO_EMAILS } from "./partner-demo";
import { FLOOR_TEST_LOCATION_ID, FLOOR_TEST_ORG_ID } from "./floor-test";

/** Real test peer venue — never treated as demo, never wiped here. */
const REAL_LAUNDRY_ORG_ID = "org_the_laundry";
const REAL_LAUNDRY_LOCATION_ID = "loc_the_laundry";
const REAL_LAUNDRY_SLUG = "the-laundry";

const LEGACY_ADMIN_EMAIL = "admin@zest.local";
const DEMO_ORG_IDS = ["org_partner_laundry", "org_floor_test"] as const;
const DEMO_LOC_IDS = ["loc_partner_laundry", "loc_floor_test"] as const;
const DEMO_STAFF_IDS = [
  "emp_ft_0000",
  "emp_ft_1111",
  "emp_ft_2222",
  "emp_ft_3333",
  "emp_ft_4444",
  "emp_ft_5555",
  "emp_ft_6666",
] as const;
const DEMO_DEVICE_IDS = [
  "dev_ft_server",
  "dev_ft_host",
  "dev_ft_kds_kitchen",
  "dev_ft_kds_bar",
  "dev_ft_kiosk",
  "dev_ft_cashier",
] as const;

const globalRef = globalThis as typeof globalThis & {
  __summexDemoPurge__?: Promise<{ removed: number }>;
};

function isAdminEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e === PLATFORM_ADMIN_EMAIL.toLowerCase() || e === LEGACY_ADMIN_EMAIL;
}

async function trySql(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    /* table/column may not exist yet */
  }
}

export async function purgeSeededDemoData(): Promise<{ removed: number }> {
  globalRef.__summexDemoPurge__ ??= (async () => {
    try {
      return await purgeOnce();
    } catch (err) {
      globalRef.__summexDemoPurge__ = undefined;
      const msg = err instanceof Error ? err.message : String(err);
      if (/database not ready|does not exist|ENOENT|ECONNREFUSED/i.test(msg)) {
        return { removed: 0 };
      }
      throw err;
    }
  })();
  return globalRef.__summexDemoPurge__;
}

async function purgeOnce(): Promise<{ removed: number }> {
  const sql = await getSql();

  const tagged = await sql<{ id: string }>`
    select id from organizations
    where id <> ${REAL_LAUNDRY_ORG_ID}
      and slug <> ${REAL_LAUNDRY_SLUG}
      and (
        coalesce(is_demo, false) = true
        or coalesce(is_partner_demo, false) = true
        or id = ${FLOOR_TEST_ORG_ID}
        or id = ${"org_partner_laundry"}
        or slug = ${"the-laundry-partner"}
        or slug = ${"test-location-floor"}
        or lower(name) = ${"the laundry group"}
        or lower(name) = ${"test org"}
      )
  `.catch(() => [] as { id: string }[]);

  const locTagged = await sql<{ id: string; org_id: string }>`
    select id, org_id from locations
    where id <> ${REAL_LAUNDRY_LOCATION_ID}
      and org_id <> ${REAL_LAUNDRY_ORG_ID}
      and (
        coalesce(is_demo, false) = true
        or coalesce(is_partner_demo, false) = true
        or id = ${FLOOR_TEST_LOCATION_ID}
        or id = ${"loc_partner_laundry"}
        or lower(name) = ${"test location"}
      )
  `.catch(() => [] as { id: string; org_id: string }[]);

  const orgIds = new Set<string>([
    ...tagged.map((r) => r.id),
    ...locTagged.map((r) => r.org_id),
    ...DEMO_ORG_IDS,
  ]);
  orgIds.delete(REAL_LAUNDRY_ORG_ID);
  const locIds = new Set<string>([...locTagged.map((r) => r.id), ...DEMO_LOC_IDS]);
  locIds.delete(REAL_LAUNDRY_LOCATION_ID);
  const removed = orgIds.size;

  for (const locId of locIds) {
    await trySql(() => sql`delete from location_staff where location_id = ${locId}`);
    await trySql(() => sql`delete from location_devices where location_id = ${locId}`);
    await trySql(() => sql`delete from location_shifts where location_id = ${locId}`);
    await trySql(() => sql`delete from operators where location_id = ${locId}`);
    await trySql(() => sql`delete from waitlist_entries where location_id = ${locId}`);
    await trySql(() => sql`delete from reservations where location_id = ${locId}`);
    await trySql(() => sql`delete from active_contexts where location_id = ${locId}`);
    await trySql(() => sql`delete from locations where id = ${locId}`);
  }

  for (const id of DEMO_STAFF_IDS) {
    await trySql(() => sql`delete from location_staff where id = ${id}`);
  }
  for (const id of DEMO_DEVICE_IDS) {
    await trySql(() => sql`delete from location_devices where id = ${id}`);
  }

  for (const orgId of orgIds) {
    await trySql(() => sql`delete from operators where org_id = ${orgId}`);
    await trySql(() => sql`delete from org_subscriptions where org_id = ${orgId}`);
    await trySql(() => sql`delete from invites where org_id = ${orgId}`);
    await trySql(() => sql`delete from memberships where org_id = ${orgId}`);
    await trySql(() => sql`delete from onboarding_runs where org_id = ${orgId}`);
    await trySql(() => sql`delete from locations where org_id = ${orgId}`);
    await trySql(() => sql`delete from organizations where id = ${orgId}`);
  }

  const emails = [...PARTNER_DEMO_EMAILS];
  const extra = await sql<{ email: string }>`
    select email from "user"
    where email ilike ${"%@demo.summex.app"}
  `.catch(() => [] as { email: string }[]);
  for (const row of extra) emails.push(row.email);

  for (const email of emails) {
    const e = email.trim().toLowerCase();
    if (!e || isAdminEmail(e)) continue;
    const users = await sql<{ id: string }>`
      select id from "user" where lower(email) = ${e} limit 1
    `.catch(() => [] as { id: string }[]);
    const id = users[0]?.id;
    if (!id) continue;
    const admin = await sql<{ n: number }>`
      select 1 as n from platform_admin where user_id = ${id} limit 1
    `.catch(() => [] as { n: number }[]);
    if (admin[0]) continue;
    await trySql(() => sql`delete from "session" where "userId" = ${id}`);
    await trySql(() => sql`delete from "account" where "userId" = ${id}`);
    await trySql(() => sql`delete from memberships where user_id = ${id}`);
    await trySql(() => sql`delete from "user" where id = ${id}`);
  }

  return { removed };
}

export function resetDemoPurgeLatch(): void {
  globalRef.__summexDemoPurge__ = undefined;
}
