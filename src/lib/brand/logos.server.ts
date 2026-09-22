/**
 * Save or clear one logo slot. Original stays in brand_logos.
 * Screen + receipt go on the location setup and bump configVersion.
 */
import { getSql } from "@/lib/db";
import { ForbiddenError, isPlatformAdmin } from "@/lib/saas/tenancy.server";
import {
  SCREEN_MAX_CHARS,
  acceptUpload,
  canWriteLogoSlot,
  emptyBrandLogoMap,
  logoActor,
  normalizeLogoMime,
  parseBrandLogoMap,
  parseStoredLogo,
  screenUrlFromSetup,
  type BrandLogoMap,
  type StoredLogo,
} from "./logos";

async function actorFor(userId: string, locationId: string) {
  if (await isPlatformAdmin(userId)) return { actor: "platform" as const, operatorId: null as string | null };
  const sql = await getSql();
  const rows = await sql<{ role: string; operator_id: string | null }>`
    select m.role, m.operator_id
    from memberships m
    join locations l on l.org_id = m.org_id
    where m.user_id = ${userId}
      and l.id = ${locationId}
      and m.status = 'active'
  `;
  const locationRow = rows.find((r) => {
    const op = String(r.operator_id || "").trim();
    return (r.role === "owner" || r.role === "manager") && (!op || op === "host");
  });
  if (locationRow) return { actor: logoActor({ membershipRole: locationRow.role, operatorId: null }), operatorId: null };
  const entityRow = rows.find((r) => String(r.operator_id || "").trim());
  if (entityRow) {
    return {
      actor: logoActor({ membershipRole: entityRow.role, operatorId: entityRow.operator_id }),
      operatorId: String(entityRow.operator_id || "").trim() || null,
    };
  }
  return { actor: "none" as const, operatorId: null };
}

function readSetup(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

async function writeMap(locationId: string, map: BrandLogoMap, setup: Record<string, unknown>) {
  const sql = await getSql();
  const next = {
    ...setup,
    brandLogos: map,
    configVersion: Math.max(0, Math.round(Number(setup.configVersion) || 0)) + 1,
  };
  await sql`
    update locations set setup = ${JSON.stringify(next)}::jsonb where id = ${locationId}
  `;
  return { configVersion: next.configVersion as number, brandLogos: map };
}

export async function saveBrandLogo(
  userId: string,
  input: {
    locationId: string;
    operatorId: string;
    mime: string;
    originalBase64: string;
    screenUrl: string;
    receipt: { width: number; height: number; rowsBase64: string } | null;
  },
): Promise<{ configVersion: number; brandLogos: BrandLogoMap }> {
  const slot = String(input.operatorId || "").trim();
  const who = await actorFor(userId, input.locationId);
  if (!canWriteLogoSlot(who.actor, who.operatorId, slot)) {
    throw new ForbiddenError("You can edit only your logo slot");
  }
  const mime = normalizeLogoMime(input.mime);
  const original = String(input.originalBase64 || "").replace(/\s/g, "");
  const bytes = Math.floor((original.length * 3) / 4);
  const gate = acceptUpload({ mime: mime || "", byteLength: bytes });
  if (!gate.ok || !mime) throw new Error(gate.ok ? "Use a PNG, JPG, or SVG" : gate.error);
  if (original.length > 2_900_000) throw new Error("Logo must be 2MB or smaller");
  const stored = parseStoredLogo({
    mime,
    screenUrl: String(input.screenUrl || "").slice(0, SCREEN_MAX_CHARS + 1),
    receipt: input.receipt,
  });
  if (!stored) throw new Error("Could not store that logo");
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where id = ${input.locationId} limit 1
  `;
  if (!rows[0]) throw new ForbiddenError("Location not found");
  const setup = readSetup(rows[0].setup);
  const map = parseBrandLogoMap(setup.brandLogos);
  if (slot) map.entities[slot] = stored;
  else map.location = stored;
  await sql`
    insert into brand_logos (location_id, operator_id, mime, original_b64, updated_at)
    values (${input.locationId}, ${slot}, ${mime}, ${original}, now())
    on conflict (location_id, operator_id)
    do update set mime = excluded.mime, original_b64 = excluded.original_b64, updated_at = now()
  `;
  return writeMap(input.locationId, map, setup);
}

export async function clearBrandLogo(
  userId: string,
  input: { locationId: string; operatorId: string },
): Promise<{ configVersion: number; brandLogos: BrandLogoMap }> {
  const slot = String(input.operatorId || "").trim();
  const who = await actorFor(userId, input.locationId);
  if (!canWriteLogoSlot(who.actor, who.operatorId, slot)) {
    throw new ForbiddenError("You can edit only your logo slot");
  }
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where id = ${input.locationId} limit 1
  `;
  if (!rows[0]) throw new ForbiddenError("Location not found");
  await sql`
    delete from brand_logos where location_id = ${input.locationId} and operator_id = ${slot}
  `.catch(() => undefined);
  const setup = readSetup(rows[0].setup);
  const map = parseBrandLogoMap(setup.brandLogos);
  if (slot) map.entities[slot] = null;
  else map.location = null;
  return writeMap(input.locationId, map, setup);
}

export async function locationScreenLogo(locationId: string): Promise<string | null> {
  const brand = await locationMailBrand(locationId);
  return brand.screenUrl;
}

export async function locationMailBrand(
  locationId: string,
): Promise<{ name: string; screenUrl: string | null }> {
  const sql = await getSql();
  const rows = await sql<{ name: string | null; setup: unknown }>`
    select name, setup from locations where id = ${locationId} limit 1
  `;
  return {
    name: String(rows[0]?.name || "").trim() || "Location",
    screenUrl: screenUrlFromSetup(rows[0]?.setup ?? null),
  };
}

export async function orgScreenLogo(orgId: string): Promise<string | null> {
  if (!orgId) return null;
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where org_id = ${orgId} order by created_at asc limit 1
  `;
  return screenUrlFromSetup(rows[0]?.setup ?? null);
}

export function slotStored(map: BrandLogoMap, operatorId: string): StoredLogo | null {
  const slot = operatorId.trim();
  if (!slot) return map.location;
  return map.entities[slot] ?? null;
}

export { emptyBrandLogoMap };
