/**
 * Read and write one selling entity's legal name, DBA, menu name, tip percents,
 * and staff PIN length. The location row is not updated.
 */
import { getSql } from "@/lib/db";
import { ForbiddenError, isPlatformAdmin } from "@/lib/saas/tenancy.server";
import {
  canEditEntitySettings,
  locationContactMayEditEntity,
  parsePinLength,
  parseTipPercents,
  readTipPercents,
} from "@/lib/saas/entity-settings";
import {
  clampEntityGiftPolicy,
  defaultEntityGiftPolicy,
  parseEntityGiftPolicy,
  venueGiftRules,
  type EntityGiftPolicy,
  type VenueGiftRules,
} from "@/lib/pos/gift-policy";
import { mergeEntityGiftIntoHouse } from "@/lib/saas/entity-gift-setup.server";

export type EntitySettingsRecord = {
  operatorId: string;
  legalName: string;
  dba: string;
  menuDisplayName: string;
  tipPercents: number[];
  pinLength: 4 | 5 | 6 | null;
  giftPolicy: EntityGiftPolicy;
  venueGift: VenueGiftRules;
};

type MemRow = {
  role: string;
  operator_id: string | null;
  email: string | null;
};

function checklistEmail(setup: unknown): string {
  if (!setup || typeof setup !== "object") return "";
  const layer = (setup as { onboardingChecklist?: { location?: { contactEmail?: unknown } } })
    .onboardingChecklist;
  return String(layer?.location?.contactEmail ?? "");
}

export async function userCanEditEntitySettings(
  userId: string,
  locationId: string,
  operatorId: string,
): Promise<boolean> {
  const target = operatorId.trim();
  if (!target) return false;
  if (await isPlatformAdmin(userId)) return true;
  const sql = await getSql();
  const loc = await sql<{ contact_email: string | null; setup: unknown; org_id: string }>`
    select contact_email, setup, org_id from locations where id = ${locationId} limit 1
  `;
  const row = loc[0];
  if (!row) return false;
  const mems = await sql<MemRow>`
    select m.role, m.operator_id, u.email
    from memberships m
    join "user" u on u.id = m.user_id
    where m.user_id = ${userId}
      and m.org_id = ${row.org_id}
      and m.status = 'active'
  `;
  const check = checklistEmail(row.setup);
  let locationContact = false;
  let actorOperatorId: string | null = null;
  for (const mem of mems) {
    const op = String(mem.operator_id || "").trim();
    if (op && op === target) actorOperatorId = op;
    if (
      locationContactMayEditEntity({
        email: mem.email,
        contactEmail: row.contact_email,
        checklistEmail: check,
        role: mem.role,
        operatorId: mem.operator_id,
      })
    ) {
      locationContact = true;
    }
  }
  return canEditEntitySettings({
    targetOperatorId: target,
    actorOperatorId,
    locationContact,
    platformAdmin: false,
  });
}

type OperatorSettingsRow = {
  id: string;
  legal_name: string | null;
  dba: string | null;
  menu_display_name: string | null;
  tip_percents: unknown;
  pin_length: number | null;
  gift_policy: unknown;
};

async function venueGiftForLocation(locationId: string): Promise<VenueGiftRules> {
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where id = ${locationId} limit 1
  `;
  const setup = rows[0]?.setup;
  return venueGiftRules(
    setup && typeof setup === "object" && !Array.isArray(setup)
      ? (setup as Parameters<typeof venueGiftRules>[0])
      : {},
  );
}

function mapRow(r: OperatorSettingsRow, venueGift: VenueGiftRules): EntitySettingsRecord {
  return {
    operatorId: r.id,
    legalName: String(r.legal_name ?? ""),
    dba: String(r.dba ?? ""),
    menuDisplayName: String(r.menu_display_name ?? ""),
    tipPercents: readTipPercents(r.tip_percents),
    pinLength: parsePinLength(r.pin_length),
    giftPolicy: r.gift_policy == null ? defaultEntityGiftPolicy() : parseEntityGiftPolicy(r.gift_policy),
    venueGift,
  };
}

export async function loadEntitySettingsForUser(
  userId: string,
  input: { orgId: string; locationId: string; operatorId: string },
): Promise<EntitySettingsRecord> {
  const allowed = await userCanEditEntitySettings(userId, input.locationId, input.operatorId);
  if (!allowed) throw new ForbiddenError("The location contact or this entity edits these settings.");
  const sql = await getSql();
  const rows = await sql<OperatorSettingsRow>`
    select id, legal_name, dba, menu_display_name, tip_percents, pin_length, gift_policy
    from operators
    where id = ${input.operatorId}
      and org_id = ${input.orgId}
      and location_id = ${input.locationId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Selling entity not found.");
  return mapRow(row, await venueGiftForLocation(input.locationId));
}

export async function saveEntitySettingsForUser(
  userId: string,
  input: {
    orgId: string;
    locationId: string;
    operatorId: string;
    legalName: string;
    dba: string;
    menuDisplayName: string;
    tipPercents: unknown;
    pinLength: unknown;
    giftPolicy?: unknown;
  },
): Promise<EntitySettingsRecord> {
  const allowed = await userCanEditEntitySettings(userId, input.locationId, input.operatorId);
  if (!allowed) throw new ForbiddenError("The location contact or this entity edits these settings.");
  const legalName = String(input.legalName ?? "").trim().slice(0, 120);
  const dba = String(input.dba ?? "").trim().slice(0, 120);
  const menuDisplayName = String(input.menuDisplayName ?? "").trim().slice(0, 80);
  const tipPercents = parseTipPercents(input.tipPercents);
  const pinLength = parsePinLength(input.pinLength);
  if (input.pinLength != null && String(input.pinLength).trim() !== "" && pinLength == null) {
    throw new Error("Staff PIN length is 4, 5, or 6.");
  }
  const sql = await getSql();
  const venueGift = await venueGiftForLocation(input.locationId);
  const priorRows = await sql<{ gift_policy: unknown }>`
    select gift_policy from operators
    where id = ${input.operatorId}
      and org_id = ${input.orgId}
      and location_id = ${input.locationId}
    limit 1
  `;
  const previous = priorRows[0]?.gift_policy == null ? null : parseEntityGiftPolicy(priorRows[0].gift_policy);
  const giftPolicy =
    input.giftPolicy == null ? previous ?? defaultEntityGiftPolicy() : clampEntityGiftPolicy(venueGift, input.giftPolicy, previous);
  const tipsJson = tipPercents.length ? JSON.stringify(tipPercents) : "null";
  const giftJson = JSON.stringify(giftPolicy);
  const rows = await sql<OperatorSettingsRow>`
    update operators
    set legal_name = ${legalName},
        dba = ${dba || null},
        menu_display_name = ${menuDisplayName || null},
        tip_percents = ${tipsJson}::jsonb,
        pin_length = ${pinLength},
        gift_policy = ${giftJson}::jsonb
    where id = ${input.operatorId}
      and org_id = ${input.orgId}
      and location_id = ${input.locationId}
    returning id, legal_name, dba, menu_display_name, tip_percents, pin_length, gift_policy
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Selling entity not found.");
  if (input.giftPolicy != null) {
    await mergeEntityGiftIntoHouse(input.locationId, input.operatorId, giftPolicy);
  }
  return mapRow(row, venueGift);
}
