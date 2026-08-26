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

/** Delete is_demo, is_partner_demo, and floor-test seed. Never touches platform_admin or live tenants. */
export async function purgeDemoTenants(): Promise<{ removed: number }> {
  const { purgeSeededDemoData } = await import("./purge-seed.server");
  return purgeSeededDemoData();
}

export async function resetDemoVenues(userId: string): Promise<{ ok: true; removed: number }> {
  if (!(await isPlatformAdmin(userId))) {
    throw new Error("Only platform admin can purge demo tenants");
  }
  const { removed } = await purgeDemoTenants();
  return { ok: true, removed };
}
