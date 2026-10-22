/**
 * Copies one entity's gift policy onto the location setup the stations already read.
 */
import { getSql } from "@/lib/db";
import type { EntityGiftPolicy } from "@/lib/pos/gift-policy";

export async function mergeEntityGiftIntoHouse(
  locationId: string,
  operatorId: string,
  policy: EntityGiftPolicy,
): Promise<void> {
  const id = operatorId.trim();
  if (!locationId || !id) return;
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where id = ${locationId} limit 1
  `;
  const raw = rows[0]?.setup;
  const setup =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  const current =
    setup.entityGiftPolicy && typeof setup.entityGiftPolicy === "object" && !Array.isArray(setup.entityGiftPolicy)
      ? { ...(setup.entityGiftPolicy as Record<string, unknown>) }
      : {};
  current[id] = policy;
  const version = Math.max(0, Math.round(Number(setup.configVersion) || 0)) + 1;
  const next = { ...setup, entityGiftPolicy: current, configVersion: version };
  await sql`
    update locations
    set setup = ${JSON.stringify(next)}::jsonb
    where id = ${locationId}
  `;
}
