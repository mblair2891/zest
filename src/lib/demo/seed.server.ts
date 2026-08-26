import { getSql } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/saas/tenancy.server";

export type DemoRecord = {
  type: string;
  orgId: string;
  locationId: string;
  name: string;
  sharePath: string;
};

/** Demo venues are no longer seeded. Always returns an empty list. */
export async function seedDemoVenues(): Promise<DemoRecord[]> {
  await purgeDemoTenants();
  return [];
}

export async function listDemoVenues(): Promise<DemoRecord[]> {
  return [];
}

/** Delete is_demo orgs/locations. Never touches platform_admin, live tenants, or partner-demo. */
export async function purgeDemoTenants(): Promise<{ removed: number }> {
  const sql = await getSql();
  const before = await sql<{ n: number }>`
    select count(*)::int as n from organizations where coalesce(is_demo, false) = true
  `;
  await sql`
    delete from locations
    where coalesce(is_partner_demo, false) = false
      and (
        coalesce(is_demo, false) = true
        or id like ${"loc_demo_%"}
        or id = ${"loc_hall"}
      )
  `;
  await sql`
    delete from organizations
    where coalesce(is_partner_demo, false) = false
      and (
        coalesce(is_demo, false) = true
        or id like ${"org_demo%"}
        or slug like ${"demo-%"}
      )
  `;
  return { removed: Number(before[0]?.n ?? 0) };
}

export async function resetDemoVenues(userId: string): Promise<{ ok: true; removed: number }> {
  if (!(await isPlatformAdmin(userId))) {
    throw new Error("Only platform admin can purge demo tenants");
  }
  const { removed } = await purgeDemoTenants();
  return { ok: true, removed };
}
