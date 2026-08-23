import { getSql } from "@/lib/db";
import { defaultPackagesForMode } from "@/lib/pos/packages";
import { isPlatformAdmin } from "@/lib/saas/tenancy.server";
import { DEMO_CATALOG, demoLocationId, demoOrgId } from "./catalog";

export type DemoRecord = {
  type: string;
  orgId: string;
  locationId: string;
  name: string;
  sharePath: string;
};

export async function seedDemoVenues(): Promise<DemoRecord[]> {
  const sql = await getSql();
  const out: DemoRecord[] = [];
  for (const entry of DEMO_CATALOG) {
    const orgId = demoOrgId(entry.type);
    const locId = demoLocationId(entry.type);
    const slug = `demo-${entry.type.replaceAll("_", "-")}`;
    const pkgs = JSON.stringify(defaultPackagesForMode(entry.type));
    const model = entry.type === "food_hall" ? "host_operators" : "single";
    await sql`
      insert into organizations (
        id, name, slug, status, venue_default_type, is_demo, legal_name, dba
      )
      values (
        ${orgId},
        ${`${entry.hostName} (demo)`},
        ${slug},
        ${"active"},
        ${entry.type},
        ${true},
        ${entry.hostName},
        ${"DEMO"}
      )
      on conflict (id) do update set
        name = excluded.name,
        is_demo = true,
        venue_default_type = excluded.venue_default_type
    `;
    await sql`
      insert into locations (
        id, org_id, name, venue_type, timezone, status, enabled_packages,
        address, host_brand_name, operating_model, is_demo
      )
      values (
        ${locId},
        ${orgId},
        ${entry.hostName},
        ${entry.type},
        ${"America/Los_Angeles"},
        ${"active"},
        ${pkgs}::jsonb,
        ${`DEMO · ${entry.hostName}`},
        ${entry.hostName},
        ${model},
        ${true}
      )
      on conflict (id) do update set
        name = excluded.name,
        is_demo = true,
        org_id = excluded.org_id,
        venue_type = excluded.venue_type
    `;
    out.push({
      type: entry.type,
      orgId,
      locationId: locId,
      name: entry.hostName,
      sharePath: entry.sharePath,
    });
  }
  return out;
}

export async function listDemoVenues(): Promise<DemoRecord[]> {
  const sql = await getSql();
  const rows = await sql<{
    type: string;
    org_id: string;
    location_id: string;
    name: string;
  }>`
    select l.venue_type as type, o.id as org_id, l.id as location_id, l.name
    from organizations o
    join locations l on l.org_id = o.id
    where o.is_demo = true
    order by l.venue_type
  `;
  if (rows.length < DEMO_CATALOG.length) {
    return seedDemoVenues();
  }
  return rows.map((r) => ({
    type: r.type,
    orgId: r.org_id,
    locationId: r.location_id,
    name: r.name,
    sharePath: `/demo/${r.type}`,
  }));
}

export async function resetDemoVenues(userId: string): Promise<{ ok: true; removed: number }> {
  if (!(await isPlatformAdmin(userId))) {
    throw new Error("Only platform admin can reset demos");
  }
  const sql = await getSql();
  const before = await sql<{ n: number }>`
    select count(*)::int as n from organizations where is_demo = true
  `;
  await sql`delete from organizations where is_demo = true`;
  await seedDemoVenues();
  return { ok: true, removed: Number(before[0]?.n ?? 0) };
}
