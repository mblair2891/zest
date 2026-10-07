/**
 * Peer-venue entity publish. Writes this entity’s rooms into the stored floor
 * and the station snapshot. Does not use the host settings save.
 */
import { getSql } from "@/lib/db";
import { ForbiddenError } from "@/lib/saas/tenancy.server";
import { parseFloorPlan, type LocationFloorPlan } from "@/lib/saas/location-catalog";
import { isPeerVenueModel } from "@/lib/saas/location-model";
import { mergeEntityFloor } from "@/lib/pos/entity-floor";
import { loadEntityWriteContext, assertEntityResourceWrite } from "@/lib/access/assert-entity.server";

function readSetup(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

export async function publishEntityFloor(
  userId: string,
  input: { orgId: string; locationId: string; entityId: string; floorPlan: unknown },
): Promise<{ floorPlan: LocationFloorPlan; configVersion: number }> {
  const entityId = input.entityId.trim();
  if (!entityId || entityId === "host") {
    throw new ForbiddenError("This login publishes only its own rooms.");
  }
  const sql = await getSql();
  const rows = await sql<{ org_id: string; setup: unknown; operating_model: string | null }>`
    select org_id, setup, operating_model
    from locations
    where id = ${input.locationId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Location not found");
  const orgId = input.orgId || row.org_id;
  if (row.org_id !== orgId) throw new ForbiddenError("Location not found");
  const setup = readSetup(row.setup);
  const setupModel = typeof setup.operatingModel === "string" ? setup.operatingModel : "";
  const peer =
    isPeerVenueModel(row.operating_model) ||
    isPeerVenueModel(setupModel) ||
    setup.peerVenue === true;
  if (!peer) throw new ForbiddenError("Publish floor is for a peer venue.");

  const ctx = await loadEntityWriteContext(userId, orgId, input.locationId);
  if (ctx.operatorId !== entityId) {
    throw new ForbiddenError("This login publishes only its own rooms.");
  }
  assertEntityResourceWrite(ctx, entityId);

  const storedPlan: LocationFloorPlan = parseFloorPlan(setup.floorPlan) ?? { tables: [], sections: [] };
  const draftRaw =
    input.floorPlan && typeof input.floorPlan === "object"
      ? { ...(input.floorPlan as Record<string, unknown>), room: storedPlan.room }
      : { room: storedPlan.room };
  const draftPlan = parseFloorPlan(draftRaw) ?? { tables: [], sections: [], room: storedPlan.room };
  const merged = mergeEntityFloor({
    stored: storedPlan,
    draft: draftPlan,
    entityId,
  });
  const floorPlan: LocationFloorPlan = {
    tables: merged.tables,
    sections: merged.sections,
    ...(merged.room ? { room: merged.room } : {}),
  };
  const prev = setup.stationPublish;
  const prevObj = prev && typeof prev === "object" && !Array.isArray(prev) ? (prev as Record<string, unknown>) : null;
  const prevSetup =
    prevObj?.setup && typeof prevObj.setup === "object" && !Array.isArray(prevObj.setup)
      ? (prevObj.setup as Record<string, unknown>)
      : {};
  const version = Math.max(0, Math.round(Number(prevObj?.version) || 0)) + 1;
  const sectionNames = floorPlan.sections.map((section) => section.name);
  const configVersion = Math.max(0, Math.round(Number(setup.configVersion) || 0)) + 1;
  const next = {
    ...setup,
    floorPlan,
    tableCount: floorPlan.tables.length,
    sectionNames,
    floorLater: false,
    configVersion,
    stationPublish: {
      version,
      publishedAt: Date.now(),
      publishedByName: "Entity",
      setup: {
        ...prevSetup,
        floorPlan,
        sectionNames,
      },
    },
  };
  await sql`
    update locations
    set setup = ${JSON.stringify(next)}::jsonb
    where id = ${input.locationId}
  `;
  return { floorPlan, configVersion };
}
