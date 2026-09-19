/**
 * Platform-authored jurisdiction bulletins. Never import from client bundles.
 * Never writes venue tax rows.
 */
import { getSql } from "@/lib/db";
import { newId } from "./ids";
import { ForbiddenError, isPlatformAdmin } from "./tenancy.server";
import { sendEmail } from "./email.server";
import { PRODUCT_NAME } from "@/lib/platform/brand";
import {
  bulletinMatchesVenue,
  parseScopeKind,
  parseSeverity,
  type BulletinTarget,
} from "@/lib/pos/jurisdiction";
import { parseTaxRateDef, type TaxRateDef } from "@/lib/pos/tax-rates";
import type { CreateBulletinInput, RegBulletin, VenueBulletin } from "./reg-bulletins";

type BulletinRow = {
  id: string;
  title: string;
  body: string;
  effective_on: string;
  severity: string;
  scope_kind: string;
  scope_country: string;
  scope_state: string;
  scope_city: string;
  scope_district: string;
  suggested_tax: unknown;
  created_at: unknown;
  archived_at: unknown;
};

function dateOnly(raw: unknown): string {
  const s = String(raw ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function mapBulletin(r: BulletinRow): RegBulletin {
  return {
    id: r.id,
    title: String(r.title ?? "").trim(),
    body: String(r.body ?? "").trim(),
    effectiveOn: dateOnly(r.effective_on),
    severity: parseSeverity(r.severity),
    scopeKind: parseScopeKind(r.scope_kind),
    scopeCountry: String(r.scope_country ?? "US").trim() || "US",
    scopeState: String(r.scope_state ?? "").trim().toUpperCase(),
    scopeCity: String(r.scope_city ?? "").trim(),
    scopeDistrict: String(r.scope_district ?? "").trim(),
    suggestedTax: parseTaxRateDef(r.suggested_tax),
    createdAt: String(r.created_at ?? ""),
    archivedAt: r.archived_at ? String(r.archived_at) : null,
  };
}

function targetOf(b: RegBulletin): BulletinTarget {
  return {
    scopeKind: b.scopeKind,
    scopeCountry: b.scopeCountry,
    scopeState: b.scopeState,
    scopeCity: b.scopeCity,
    scopeDistrict: b.scopeDistrict,
  };
}

function venueFromSetup(setup: unknown, timezone: string): {
  jurisdiction?: unknown;
  timezone?: string;
} {
  const o = setup && typeof setup === "object" && !Array.isArray(setup)
    ? (setup as Record<string, unknown>)
    : {};
  return {
    jurisdiction: o.jurisdiction,
    timezone: typeof o.timezone === "string" ? o.timezone : timezone,
  };
}

async function requireAdmin(userId: string) {
  if (!(await isPlatformAdmin(userId))) {
    throw new ForbiddenError("Platform admin only");
  }
}

export async function listRegBulletins(userId: string): Promise<RegBulletin[]> {
  await requireAdmin(userId);
  const sql = await getSql();
  const rows = await sql<BulletinRow>`
    select * from reg_bulletins
    where archived_at is null
    order by effective_on desc, created_at desc
    limit 200
  `.catch(() => [] as BulletinRow[]);
  return rows.map(mapBulletin);
}

export async function createRegBulletin(
  userId: string,
  input: CreateBulletinInput,
): Promise<RegBulletin> {
  await requireAdmin(userId);
  const title = String(input.title ?? "").trim().slice(0, 160);
  const body = String(input.body ?? "").trim().slice(0, 8000);
  if (!title || !body) throw new Error("Title and body are required");
  const scopeKind = parseScopeKind(input.scopeKind);
  const scopeState = String(input.scopeState ?? "").trim().toUpperCase();
  if (scopeKind !== "all" && !scopeState) throw new Error("State is required for this scope");
  const suggested = input.suggestedTax
    ? parseTaxRateDef({
        name: input.suggestedTax.name,
        percent: input.suggestedTax.percent,
        appliesTo: "all",
        compound: "stacked",
        inclusive: false,
      })
    : null;
  const id = newId("rbl");
  const sql = await getSql();
  const rows = await sql<BulletinRow>`
    insert into reg_bulletins (
      id, title, body, effective_on, severity, scope_kind, scope_country,
      scope_state, scope_city, scope_district, suggested_tax, created_by
    )
    values (
      ${id},
      ${title},
      ${body},
      ${dateOnly(input.effectiveOn)}::date,
      ${parseSeverity(input.severity)},
      ${scopeKind},
      ${(String(input.scopeCountry ?? "US").trim().toUpperCase() || "US").slice(0, 2)},
      ${scopeState},
      ${String(input.scopeCity ?? "").trim().slice(0, 80)},
      ${String(input.scopeDistrict ?? "").trim().slice(0, 80)},
      ${suggested ? JSON.stringify(suggested) : null}::jsonb,
      ${userId}
    )
    returning *
  `;
  const created = mapBulletin(rows[0]!);
  void notifyMatchingVenues(created).catch(() => undefined);
  return created;
}

export async function archiveRegBulletin(userId: string, id: string): Promise<{ ok: true }> {
  await requireAdmin(userId);
  const sql = await getSql();
  await sql`
    update reg_bulletins set archived_at = now()
    where id = ${id} and archived_at is null
  `;
  return { ok: true as const };
}

async function loadActiveBulletins(): Promise<RegBulletin[]> {
  const sql = await getSql();
  const rows = await sql<BulletinRow>`
    select * from reg_bulletins
    where archived_at is null
    order by effective_on desc, created_at desc
    limit 200
  `.catch(() => [] as BulletinRow[]);
  return rows.map(mapBulletin);
}

export async function listVenueBulletins(
  userId: string,
  locationId: string,
): Promise<VenueBulletin[]> {
  const { assertLocationAccess } = await import("./tenancy.server");
  const access = await assertLocationAccess(userId, locationId);
  const venue = venueFromSetup(access.location.setup, access.location.timezone);
  const all = await loadActiveBulletins();
  const matched = all.filter((b) => bulletinMatchesVenue(targetOf(b), venue));
  if (!matched.length) return [];
  const sql = await getSql();
  const acks = await sql<{ bulletin_id: string; status: string }>`
    select bulletin_id, status from reg_bulletin_acks
    where location_id = ${locationId}
  `.catch(() => [] as { bulletin_id: string; status: string }[]);
  const ackMap = new Map(acks.map((a) => [a.bulletin_id, a.status]));
  return matched.map((b) => {
    const st = ackMap.get(b.id);
    const ack: VenueBulletin["ack"] =
      st === "saved" || st === "dismissed" ? st : "pending";
    return { ...b, ack };
  });
}

export async function ackVenueBulletin(
  userId: string,
  input: { locationId: string; bulletinId: string; status: "saved" | "dismissed" },
): Promise<{ ok: true }> {
  const { assertLocationAccess } = await import("./tenancy.server");
  await assertLocationAccess(userId, input.locationId);
  const status = input.status === "saved" ? "saved" : "dismissed";
  const sql = await getSql();
  await sql`
    insert into reg_bulletin_acks (bulletin_id, location_id, status, updated_at)
    values (${input.bulletinId}, ${input.locationId}, ${status}, now())
    on conflict (bulletin_id, location_id)
    do update set status = ${status}, updated_at = now()
  `;
  return { ok: true as const };
}

export async function actionRequiredNoticesForLocation(locationId: string): Promise<string[]> {
  const sql = await getSql();
  const loc = await sql<{ setup: unknown; timezone: string }>`
    select setup, timezone from locations where id = ${locationId} limit 1
  `.catch(() => [] as { setup: unknown; timezone: string }[]);
  if (!loc[0]) return [];
  const venue = venueFromSetup(loc[0].setup, loc[0].timezone);
  const all = await loadActiveBulletins();
  const acks = await sql<{ bulletin_id: string }>`
    select bulletin_id from reg_bulletin_acks
    where location_id = ${locationId}
  `.catch(() => [] as { bulletin_id: string }[]);
  const done = new Set(acks.map((a) => a.bulletin_id));
  return all
    .filter((b) => b.severity === "action_required" && !done.has(b.id))
    .filter((b) => bulletinMatchesVenue(targetOf(b), venue))
    .map((b) => b.title)
    .slice(0, 5);
}

async function notifyMatchingVenues(b: RegBulletin): Promise<void> {
  const sql = await getSql();
  const locs = await sql<{ id: string; org_id: string; name: string; timezone: string; setup: unknown }>`
    select id, org_id, name, timezone, setup from locations where status = ${"active"}
  `.catch(() => [] as { id: string; org_id: string; name: string; timezone: string; setup: unknown }[]);
  const matched = locs.filter((l) =>
    bulletinMatchesVenue(targetOf(b), venueFromSetup(l.setup, l.timezone)),
  );
  if (!matched.length) return;
  const orgSet = new Set(matched.map((l) => l.org_id));
  const emails = await sql<{ org_id: string; email: string }>`
    select m.org_id, u.email
    from memberships m
    join "user" u on u.id = m.user_id
    where m.role in (${"owner"}, ${"manager"})
      and m.status = ${"active"}
      and u.email is not null
  `.catch(() => [] as { org_id: string; email: string }[]);
  const byOrg = new Map<string, string[]>();
  for (const row of emails) {
    if (!orgSet.has(row.org_id)) continue;
    const list = byOrg.get(row.org_id) ?? [];
    if (row.email && !list.includes(row.email)) list.push(row.email);
    byOrg.set(row.org_id, list);
  }
  const seen = new Set<string>();
  for (const loc of matched) {
    for (const to of byOrg.get(loc.org_id) ?? []) {
      const key = `${to}:${b.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await sendEmail({
        to,
        subject: `${PRODUCT_NAME}: ${b.title}`,
        text: `${b.title}\nEffective ${b.effectiveOn}\n\n${b.body}\n\nTax rates are not changed until you Review rates and Save.`,
        html: `<p><strong>${escapeHtml(b.title)}</strong></p><p>Effective ${escapeHtml(b.effectiveOn)}</p><p>${escapeHtml(b.body)}</p><p>Tax rates are not changed until you Review rates and Save.</p>`,
        kind: "reg_bulletin",
      });
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function suggestedTaxFromBulletin(b: { suggestedTax: TaxRateDef | null }): TaxRateDef | null {
  return b.suggestedTax;
}
