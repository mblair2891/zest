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
import {
  parseSuggestedLabor,
  windowsWithinDays,
  REG_LOOKAHEAD_DAYS,
  type SuggestedLabor,
} from "./reg-calendar";
import type {
  BulletinKind,
  BulletinStatus,
  CreateBulletinInput,
  RegBulletin,
  RegReviewTask,
  VenueBulletin,
} from "./reg-bulletins";

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
  suggested_labor: unknown;
  kind: string;
  status: string;
  source_url: string | null;
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
    suggestedLabor: parseSuggestedLabor(r.suggested_labor),
    kind: parseKind(r.kind),
    status: r.status === "draft" ? "draft" : "published",
    sourceUrl: String(r.source_url ?? "").trim(),
    createdAt: String(r.created_at ?? ""),
    archivedAt: r.archived_at ? String(r.archived_at) : null,
  };
}

function parseKind(raw: unknown): BulletinKind {
  const s = String(raw ?? "tax");
  if (s === "labor" || s === "both") return s;
  return "tax";
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
  const labor = parseSuggestedLabor(input.suggestedLabor);
  const status: BulletinStatus = input.status === "draft" ? "draft" : "published";
  const kind = parseKind(input.kind);
  const id = newId("rbl");
  const sql = await getSql();
  const rows = await sql<BulletinRow>`
    insert into reg_bulletins (
      id, title, body, effective_on, severity, scope_kind, scope_country,
      scope_state, scope_city, scope_district, suggested_tax, suggested_labor,
      kind, status, source_url, created_by
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
      ${labor ? JSON.stringify(labor) : null}::jsonb,
      ${kind},
      ${status},
      ${String(input.sourceUrl ?? "").trim().slice(0, 500) || null},
      ${userId}
    )
    returning *
  `;
  const created = mapBulletin(rows[0]!);
  if (created.status === "published") {
    void notifyMatchingVenues(created).catch(() => undefined);
  }
  return created;
}

export async function publishRegBulletin(userId: string, id: string): Promise<RegBulletin> {
  await requireAdmin(userId);
  const sql = await getSql();
  const rows = await sql<BulletinRow>`
    update reg_bulletins set status = ${"published"}
    where id = ${id} and archived_at is null
    returning *
  `;
  if (!rows[0]) throw new Error("Bulletin not found");
  const created = mapBulletin(rows[0]);
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
    where archived_at is null and coalesce(status, ${"published"}) = ${"published"}
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
  const acks = await sql<{ bulletin_id: string; status: string; apply_on: string | null }>`
    select bulletin_id, status, apply_on from reg_bulletin_acks
    where location_id = ${locationId}
  `.catch(() => [] as { bulletin_id: string; status: string; apply_on: string | null }[]);
  const ackMap = new Map(acks.map((a) => [a.bulletin_id, a]));
  return matched.map((b) => {
    const row = ackMap.get(b.id);
    const st = row?.status;
    const ack: VenueBulletin["ack"] =
      st === "saved" || st === "dismissed" || st === "scheduled" ? st : "pending";
    return { ...b, ack, applyOn: row?.apply_on ? dateOnly(row.apply_on) : null };
  });
}

export async function ackVenueBulletin(
  userId: string,
  input: {
    locationId: string;
    bulletinId: string;
    status: "saved" | "dismissed" | "scheduled";
    applyOn?: string | null;
  },
): Promise<{ ok: true }> {
  const { assertLocationAccess } = await import("./tenancy.server");
  await assertLocationAccess(userId, input.locationId);
  const status =
    input.status === "saved" || input.status === "scheduled" ? input.status : "dismissed";
  const applyOn = status === "scheduled" ? dateOnly(input.applyOn) : null;
  const sql = await getSql();
  await sql`
    insert into reg_bulletin_acks (bulletin_id, location_id, status, apply_on, updated_at)
    values (${input.bulletinId}, ${input.locationId}, ${status}, ${applyOn}::date, now())
    on conflict (bulletin_id, location_id)
    do update set status = ${status}, apply_on = ${applyOn}::date, updated_at = now()
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
        text: `${b.title}\nEffective ${b.effectiveOn}\n\n${b.body}\n\nTax and labor rules are not changed until you Review and Save.`,
        html: `<p><strong>${escapeHtml(b.title)}</strong></p><p>Effective ${escapeHtml(b.effectiveOn)}</p><p>${escapeHtml(b.body)}</p><p>Tax and labor rules are not changed until you Review and Save.</p>`,
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

type TaskRow = {
  id: string;
  state: string;
  city: string;
  window_mmdd: string;
  window_date: string;
  kinds: string;
  status: string;
  source_url: string | null;
  created_at: unknown;
};

function mapTask(r: TaskRow): RegReviewTask {
  return {
    id: r.id,
    state: r.state,
    city: r.city ?? "",
    windowMmdd: r.window_mmdd,
    windowDate: dateOnly(r.window_date),
    kinds: r.kinds,
    status: r.status === "drafted" || r.status === "dismissed" ? r.status : "open",
    sourceUrl: String(r.source_url ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

/** Nightly: open a platform review task for windows within 45 days. Never writes venue rows. */
export async function runRegCalendarTick(nowIso?: string): Promise<{ created: number; windows: number }> {
  const today = (nowIso || new Date().toISOString()).slice(0, 10);
  const upcoming = windowsWithinDays(today, REG_LOOKAHEAD_DAYS);
  const sql = await getSql();
  let created = 0;
  for (const w of upcoming) {
    const id = newId("rtk");
    const kinds = w.kinds.join(",");
    const ins = await sql<{ id: string }>`
      insert into reg_review_tasks (id, state, city, window_mmdd, window_date, kinds, status)
      values (${id}, ${w.state}, ${w.city}, ${w.mmdd}, ${w.nextDate}::date, ${kinds}, ${"open"})
      on conflict (state, city, window_date) do nothing
      returning id
    `.catch(() => [] as { id: string }[]);
    if (ins[0]) created += 1;
  }
  return { created, windows: upcoming.length };
}

export async function listRegReviewTasks(userId: string): Promise<RegReviewTask[]> {
  await requireAdmin(userId);
  await runRegCalendarTick().catch(() => undefined);
  const sql = await getSql();
  const rows = await sql<TaskRow>`
    select * from reg_review_tasks
    where status <> ${"dismissed"}
    order by window_date asc
    limit 200
  `.catch(() => [] as TaskRow[]);
  return rows.map(mapTask);
}

export async function dismissRegReviewTask(userId: string, id: string): Promise<{ ok: true }> {
  await requireAdmin(userId);
  const sql = await getSql();
  await sql`update reg_review_tasks set status = ${"dismissed"} where id = ${id}`;
  return { ok: true as const };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
}

export async function draftBulletinFromUrl(
  userId: string,
  input: { url: string; taskId?: string; state?: string; city?: string; kinds?: string },
): Promise<RegBulletin> {
  await requireAdmin(userId);
  const url = String(input.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("Paste an official http(s) DOR or labor URL");
  let pageText = "";
  try {
    const res = await fetch(url, { redirect: "follow", headers: { Accept: "text/html,text/plain" } });
    const raw = await res.text();
    pageText = stripHtml(raw);
  } catch {
    throw new Error("Could not fetch that URL");
  }
  if (!pageText) throw new Error("That page had no readable text");

  let title = "Draft bulletin";
  let body = pageText.slice(0, 1200);
  let kind: BulletinKind = input.kinds?.includes("labor") && input.kinds?.includes("tax")
    ? "both"
    : input.kinds?.includes("labor")
      ? "labor"
      : "tax";
  let suggestedTax: { name: string; percent: number } | null = null;
  let suggestedLabor: SuggestedLabor | null = null;
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (apiKey) {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "Summarize an official US tax or labor page into a venue bulletin. Return JSON only: {title, body, kind: tax|labor|both, suggestedTax: {name, percent}|null, suggestedLabor: {minWageCents, otDailyHours, otWeeklyHours, tipCreditCents}|null}. Never invent a rate you cannot see in the page. If unclear, leave suggestions null.",
          },
          { role: "user", content: pageText.slice(0, 8000) },
        ],
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
          title = String(parsed.title ?? title).slice(0, 160);
          body = String(parsed.body ?? body).slice(0, 8000);
          kind = parseKind(parsed.kind);
          if (parsed.suggestedTax && typeof parsed.suggestedTax === "object") {
            const t = parsed.suggestedTax as { name?: string; percent?: number };
            if (t.name && Number(t.percent) > 0) {
              suggestedTax = { name: String(t.name), percent: Number(t.percent) };
            }
          }
          suggestedLabor = parseSuggestedLabor(parsed.suggestedLabor);
        } catch {
          /* keep fallback */
        }
      }
    }
  }

  const state = String(input.state ?? "").trim().toUpperCase();
  const created = await createRegBulletin(userId, {
    title,
    body,
    effectiveOn: new Date().toISOString().slice(0, 10),
    severity: "action_required",
    scopeKind: state ? "state" : "all",
    scopeCountry: "US",
    scopeState: state,
    scopeCity: input.city,
    kind,
    status: "draft",
    sourceUrl: url,
    suggestedTax,
    suggestedLabor,
  });
  if (input.taskId) {
    const sql = await getSql();
    await sql`
      update reg_review_tasks
      set status = ${"drafted"}, source_url = ${url}
      where id = ${input.taskId}
    `.catch(() => undefined);
  }
  return created;
}

