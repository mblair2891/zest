/**
 * Location-contact clear. Empties every piece, keeps rooms, and writes that
 * empty floor into the station snapshot so a refresh stays empty.
 */
import { getSql } from "@/lib/db";
import { parseFloorPlan, type LocationFloorPlan } from "@/lib/saas/location-catalog";
import { clearedFloorSetup } from "@/lib/pos/published-floor";

function readSetup(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

export async function clearLocationFloor(
  userId: string,
  input: { orgId: string; locationId: string; floorPlan: unknown },
): Promise<{ floorPlan: LocationFloorPlan }> {
  const { assertHostOrgWrite } = await import("@/lib/access/assert-host.server");
  await assertHostOrgWrite(userId, input.orgId, input.locationId);
  const sql = await getSql();
  const rows = await sql<{ org_id: string; setup: unknown }>`
    select org_id, setup
    from locations
    where id = ${input.locationId}
    limit 1
  `;
  const row = rows[0];
  if (!row || row.org_id !== input.orgId) {
    const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
    throw new ForbiddenError("Location not found");
  }
  const setup = readSetup(row.setup);
  const stored = parseFloorPlan(setup.floorPlan) ?? { tables: [], sections: [] };
  const incoming = parseFloorPlan(input.floorPlan);
  const sections = incoming?.sections?.length ? incoming.sections : stored.sections;
  const room = incoming?.room ?? stored.room;
  const floorPlan: LocationFloorPlan = {
    tables: [],
    sections,
    ...(room ? { room } : {}),
  };
  const next = clearedFloorSetup(setup, floorPlan);
  await sql`
    update locations
    set setup = ${JSON.stringify(next)}::jsonb
    where id = ${input.locationId}
  `;
  return { floorPlan };
}
