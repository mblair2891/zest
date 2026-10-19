/**
 * QuickBooks sync for one location. Summex stays the book of record.
 * A test company stores the same journal a sandbox or production company would receive.
 */
import { randomBytes } from "node:crypto";
import { loadEntityWriteContext } from "@/lib/access/assert-entity.server";
import { getSql, type Sql } from "@/lib/db";
import { ForbiddenError } from "@/lib/saas/tenancy.server";
import { uid } from "@/lib/utils";
import { SUMMEX_ACCOUNTS } from "./accounts.ts";
import { buildEntityDays } from "./activity.ts";
import {
  applyQboCall,
  ensureClass,
  intuitFaultMessage,
  isDuplicateDoc,
  seedTestBooks,
  testAccountMap,
  type QboAccountRow,
  type QboBooks,
  type QboClassRow,
} from "./company.ts";
import { isBusinessDate, nightlyBusinessDate } from "./dates.ts";
import {
  accountQueryPath,
  authorizeUrl,
  classQueryPath,
  companyInfoPath,
  exchangeIntuitCode,
  intuitApp,
  intuitCall,
  journalPath,
  refreshIntuitToken,
  safeOrigin,
} from "./intuit.server.ts";
import { QboMapError, buildJournals, missingAccounts, toQboPayload } from "./journal.ts";
import type {
  AccountMap,
  QboCheckIn,
  QboClassRef,
  QboConnectionView,
  QboEntityDay,
  QboGiftIn,
  QboJournalDraft,
  QboJournalLine,
  QboLogView,
  QboOverview,
  QboPostedView,
  QboSyncResult,
} from "./types.ts";

const HOST_ROLES = new Set(["owner", "manager", "accountant", "platform_admin"]);

type Conn = {
  id: string;
  location_id: string;
  org_id: string;
  entity_id: string;
  realm_id: string;
  company_name: string;
  environment: string;
  access_token: string;
  refresh_token: string;
  access_expires_at_ms: number | string;
  auto_sync: boolean;
  status: string;
  last_error: string | null;
  cache: unknown;
  connected_at_ms: number | string;
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function booksOf(raw: unknown): QboBooks {
  if (!raw || typeof raw !== "object") return emptyCache();
  const row = raw as Partial<QboBooks>;
  return {
    accounts: Array.isArray(row.accounts) ? row.accounts : [],
    classes: Array.isArray(row.classes) ? row.classes : [],
    journals: Array.isArray(row.journals) ? row.journals : [],
  };
}

function emptyCache(): QboBooks {
  return { accounts: [], classes: [], journals: [] };
}

function asList<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function modifierCents(raw: unknown): number {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return 0;
    }
  }
  if (!Array.isArray(list)) return 0;
  return list.reduce((sum, row) => {
    const price = row && typeof row === "object" ? num((row as { priceCents?: unknown }).priceCents) : 0;
    return sum + price;
  }, 0);
}

function flag(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

export async function assertQboWrite(userId: string, locationId: string, entityId: string): Promise<{ orgId: string }> {
  const sql = await getSql();
  const loc = await sql<{ org_id: string }>`select org_id from locations where id = ${locationId} limit 1`;
  const orgId = loc[0]?.org_id;
  if (!orgId) throw new ForbiddenError("Location not found");
  const ctx = await loadEntityWriteContext(userId, orgId, locationId);
  const host = ctx.isPlatformAdmin || HOST_ROLES.has(ctx.role);
  if (host) return { orgId };
  if (entityId && entityId === ctx.operatorId && ctx.role === "vendor") return { orgId };
  throw new ForbiddenError("QuickBooks is limited to the location contact, an accountant, or that entity.");
}

async function locationRow(sql: Sql, locationId: string) {
  const rows = await sql<{ timezone: string; lifecycle_status: string; org_id: string; name: string }>`
    select timezone, lifecycle_status, org_id, name from locations where id = ${locationId} limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Location not found");
  return row;
}

async function entityNames(sql: Sql, locationId: string): Promise<Array<{ id: string; name: string }>> {
  const ops = await sql<{ id: string; name: string }>`
    select id, coalesce(nullif(dba, ''), legal_name) as name
    from operators
    where location_id = ${locationId}
    order by 2
  `;
  const seen = new Map<string, string>();
  for (const row of ops) {
    if (row.id) seen.set(row.id, text(row.name) || row.id);
  }
  const extra = await sql<{ id: string }>`
    select distinct operator_id as id
    from pos_check_items
    where location_id = ${locationId}
      and operator_id is not null
      and operator_id <> ''
  `;
  for (const row of extra) {
    if (row.id && !seen.has(row.id)) seen.set(row.id, row.id);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

async function loadActivity(
  sql: Sql,
  locationId: string,
  businessDate: string,
  timeZone: string,
  names: Record<string, string>,
): Promise<QboEntityDay[]> {
  const noon = Date.parse(`${businessDate}T12:00:00Z`);
  const from = noon - 36 * 60 * 60 * 1000;
  const to = noon + 36 * 60 * 60 * 1000;
  const checks = await sql<{
    id: string;
    closed_at_ms: number | string;
    discount_cents: number | string;
    service_charge_cents: number | string;
  }>`
    select id, closed_at_ms, discount_cents, service_charge_cents
    from pos_checks
    where location_id = ${locationId}
      and status = 'closed'
      and closed_at_ms between ${from} and ${to}
  `;
  const lines = await sql<{
    check_id: string;
    operator_id: string | null;
    name: string;
    station: string | null;
    course: string | null;
    quantity: number | string;
    unit_price_cents: number | string;
    modifiers: unknown;
    discount_cents: number | string;
    voided: unknown;
    comped: unknown;
    sent: unknown;
  }>`
    select i.check_id, i.operator_id, i.name, i.station, i.course, i.quantity, i.unit_price_cents,
           i.modifiers, i.discount_cents, i.voided, i.comped, i.sent
    from pos_check_items i
    join pos_checks c on c.id = i.check_id
    where c.location_id = ${locationId}
      and c.status = 'closed'
      and c.closed_at_ms between ${from} and ${to}
  `;
  const pays = await sql<{
    check_id: string;
    method: string;
    amount_cents: number | string;
    tip_cents: number | string;
  }>`
    select p.check_id, p.method, p.amount_cents, p.tip_cents
    from pos_check_payments p
    join pos_checks c on c.id = p.check_id
    where c.location_id = ${locationId}
      and c.status = 'closed'
      and c.closed_at_ms between ${from} and ${to}
  `;
  const gifts = await sql<{
    kind: string;
    amount_cents: number | string;
    issuer_id: string | null;
    counterparty_id: string | null;
    tender: string | null;
    check_id: string | null;
    at_ms: number | string;
  }>`
    select kind, amount_cents, issuer_id, counterparty_id, tender, check_id, at_ms
    from gift_ledger
    where location_id = ${locationId}
      and at_ms between ${from} and ${to}
  `;
  const byCheck = new Map<string, QboCheckIn>();
  for (const check of checks) {
    byCheck.set(check.id, {
      id: check.id,
      closedAtMs: num(check.closed_at_ms),
      discountCents: num(check.discount_cents),
      serviceChargeCents: num(check.service_charge_cents),
      lines: [],
      payments: [],
    });
  }
  for (const line of lines) {
    const check = byCheck.get(line.check_id);
    if (!check) continue;
    check.lines.push({
      entityId: text(line.operator_id),
      name: text(line.name),
      station: text(line.station),
      course: text(line.course),
      quantity: num(line.quantity) || 1,
      unitPriceCents: num(line.unit_price_cents),
      modifierCents: modifierCents(line.modifiers),
      discountCents: num(line.discount_cents),
      voided: flag(line.voided),
      comped: flag(line.comped),
      sent: flag(line.sent),
    });
  }
  for (const pay of pays) {
    byCheck.get(pay.check_id)?.payments.push({
      method: text(pay.method),
      amountCents: num(pay.amount_cents),
      tipCents: num(pay.tip_cents),
    });
  }
  const giftRows: QboGiftIn[] = gifts.map((row) => ({
    kind: text(row.kind),
    amountCents: num(row.amount_cents),
    issuerId: text(row.issuer_id),
    counterpartyId: row.counterparty_id ? text(row.counterparty_id) : null,
    tender: row.tender ? text(row.tender) : null,
    checkId: row.check_id ? text(row.check_id) : null,
    atMs: num(row.at_ms),
  }));
  return buildEntityDays({
    businessDate,
    timeZone,
    names,
    checks: [...byCheck.values()],
    gifts: giftRows,
  });
}

function viewConn(row: Conn): QboConnectionView {
  const environment = row.environment === "production" || row.environment === "test" ? row.environment : "sandbox";
  return {
    id: row.id,
    entityId: row.entity_id,
    companyName: row.company_name,
    realmId: row.environment === "test" ? "" : row.realm_id,
    environment,
    autoSync: row.auto_sync === true,
    status: row.status,
    lastError: row.last_error,
    connectedAt: num(row.connected_at_ms),
  };
}

function postedLines(payload: unknown): QboJournalLine[] {
  if (!payload || typeof payload !== "object") return [];
  const lines = (payload as { lines?: QboJournalLine[] }).lines;
  return Array.isArray(lines) ? lines : [];
}

export async function qboOverview(userId: string, locationId: string): Promise<QboOverview> {
  const sql = await getSql();
  const loc = await locationRow(sql, locationId);
  const ctx = await loadEntityWriteContext(userId, loc.org_id, locationId);
  const host = ctx.isPlatformAdmin || HOST_ROLES.has(ctx.role);
  const scopeEntityId = host ? null : ctx.role === "vendor" && ctx.operatorId ? ctx.operatorId : "";
  if (scopeEntityId === "") {
    throw new ForbiddenError("QuickBooks is limited to the location contact, an accountant, or that entity.");
  }
  const app = intuitApp();
  const entities = (await entityNames(sql, locationId)).filter((row) => !scopeEntityId || row.id === scopeEntityId);
  const connections = (
    await sql<Conn>`
      select id, location_id, org_id, entity_id, realm_id, company_name, environment,
             access_token, refresh_token, access_expires_at_ms, auto_sync, status, last_error,
             cache, connected_at_ms
      from qbo_connections
      where location_id = ${locationId}
      order by entity_id
    `
  ).filter((row) => !scopeEntityId || row.entity_id === scopeEntityId);
  const ids = connections.map((row) => row.id);
  const maps = ids.length
    ? await sql.query<{ connection_id: string; summex_code: string; qbo_account_id: string; qbo_account_name: string }>(
        `select connection_id, summex_code, qbo_account_id, qbo_account_name
         from qbo_account_maps
         where connection_id in (${ids.map((_, i) => `$${i + 1}`).join(", ")})`,
        ids,
      )
    : [];
  const classMaps = ids.length
    ? await sql.query<{ connection_id: string; entity_id: string; qbo_class_id: string; qbo_class_name: string }>(
        `select connection_id, entity_id, qbo_class_id, qbo_class_name
         from qbo_class_maps
         where connection_id in (${ids.map((_, i) => `$${i + 1}`).join(", ")})`,
        ids,
      )
    : [];
  const logs = await sql<{
    id: string;
    created_at_ms: number | string;
    connection_id: string | null;
    entity_id: string;
    business_date: string;
    trigger: string;
    status: string;
    attempt: number;
    doc_number: string | null;
    qbo_id: string | null;
    error: string | null;
    summary: string | null;
  }>`
    select id, created_at_ms, connection_id, entity_id, business_date, trigger, status, attempt,
           doc_number, qbo_id, error, summary
    from qbo_sync_log
    where location_id = ${locationId}
    order by created_at_ms desc
    limit 40
  `;
  const posted = ids.length
    ? await sql<{
        id: string;
        connection_id: string;
        business_date: string;
        doc_number: string;
        qbo_id: string | null;
        payload: unknown;
      }>`
        select id, connection_id, business_date, doc_number, qbo_id, payload
        from qbo_posted
        where location_id = ${locationId}
        order by created_at_ms desc
        limit 20
      `
    : [];
  const accounts: QboOverview["accounts"] = [];
  const classes: QboOverview["classes"] = [];
  for (const conn of connections) {
    const books = booksOf(conn.cache);
    for (const account of books.accounts) {
      accounts.push({
        connectionId: conn.id,
        id: account.Id,
        name: account.Name,
        accountType: account.AccountType,
      });
    }
    for (const klass of books.classes) {
      classes.push({ connectionId: conn.id, id: klass.Id, name: klass.Name });
    }
  }
  const visibleIds = new Set(ids);
  const logViews: QboLogView[] = logs
    .filter((row) => !scopeEntityId || row.entity_id === scopeEntityId)
    .map((row) => ({
    id: row.id,
    at: num(row.created_at_ms),
    connectionId: row.connection_id,
    entityId: row.entity_id,
    businessDate: row.business_date,
    trigger: row.trigger,
    status: row.status,
    attempt: num(row.attempt),
    docNumber: row.doc_number,
    qboId: row.qbo_id,
    error: row.error,
    summary: row.summary,
  }));
  const postedViews: QboPostedView[] = posted
    .filter((row) => visibleIds.has(row.connection_id))
    .map((row) => ({
    id: row.id,
    connectionId: row.connection_id,
    businessDate: row.business_date,
    docNumber: row.doc_number,
    qboId: row.qbo_id,
    lines: postedLines(row.payload),
  }));
  return {
    intuitConfigured: app.configured,
    intuitEnvironment: app.environment,
    scopeEntityId,
    entities,
    connections: connections.map(viewConn),
    accounts,
    maps: maps.map((row) => ({
      connectionId: row.connection_id,
      code: row.summex_code,
      qboAccountId: row.qbo_account_id,
      qboAccountName: row.qbo_account_name,
    })),
    classes,
    classMaps: classMaps.map((row) => ({
      connectionId: row.connection_id,
      entityId: row.entity_id,
      classId: row.qbo_class_id,
      className: row.qbo_class_name,
    })),
    logs: logViews,
    posted: postedViews,
    requiredAccounts: SUMMEX_ACCOUNTS.map((row) => ({ code: row.code, name: row.name })),
  };
}

export async function beginOAuth(input: {
  userId: string;
  locationId: string;
  entityId: string;
  origin: string;
}): Promise<{ url: string }> {
  const { orgId } = await assertQboWrite(input.userId, input.locationId, input.entityId);
  const app = intuitApp();
  if (!app.configured) {
    throw new Error("INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET are not set. Connect a test company, or add the Intuit app keys.");
  }
  const origin = safeOrigin(input.origin);
  const redirectUri = app.redirectOverride || `${origin}/api/quickbooks/callback`;
  const state = randomBytes(24).toString("hex");
  const now = Date.now();
  const sql = await getSql();
  await sql`delete from qbo_oauth_states where expires_at_ms < ${now}`;
  await sql`
    insert into qbo_oauth_states (
      state, location_id, org_id, entity_id, user_id, environment, redirect_uri, created_at_ms, expires_at_ms
    ) values (
      ${state}, ${input.locationId}, ${orgId}, ${input.entityId}, ${input.userId},
      ${app.environment}, ${redirectUri}, ${now}, ${now + 10 * 60 * 1000}
    )
  `;
  return { url: authorizeUrl({ clientId: app.clientId, redirectUri, state }) };
}

export async function finishOAuth(query: {
  code?: string;
  state?: string;
  realmId?: string;
  error?: string;
}): Promise<{ ok: boolean; message: string }> {
  if (query.error) return { ok: false, message: `QuickBooks did not connect. ${query.error}` };
  if (!query.code || !query.state || !query.realmId) {
    return { ok: false, message: "QuickBooks did not return a company." };
  }
  const sql = await getSql();
  const rows = await sql<{
    state: string;
    location_id: string;
    org_id: string;
    entity_id: string;
    user_id: string;
    environment: string;
    redirect_uri: string;
    expires_at_ms: number | string;
  }>`
    select state, location_id, org_id, entity_id, user_id, environment, redirect_uri, expires_at_ms
    from qbo_oauth_states
    where state = ${query.state}
    limit 1
  `;
  const pending = rows[0];
  await sql`delete from qbo_oauth_states where state = ${query.state}`;
  if (!pending) return { ok: false, message: "That QuickBooks link expired. Connect again." };
  if (num(pending.expires_at_ms) < Date.now()) {
    return { ok: false, message: "That QuickBooks link expired. Connect again." };
  }
  const environment = pending.environment === "production" ? "production" : "sandbox";
  let token;
  try {
    token = await exchangeIntuitCode({ code: query.code, redirectUri: pending.redirect_uri });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "QuickBooks did not return a token." };
  }
  const info = await intuitCall({
    environment,
    realmId: query.realmId,
    token: token.accessToken,
    call: { method: "GET", path: companyInfoPath(query.realmId) },
  });
  const companyName =
    text((info.json as { CompanyInfo?: { CompanyName?: string } })?.CompanyInfo?.CompanyName) || "QuickBooks company";
  const remote = await pullRemote(environment, query.realmId, token.accessToken);
  const now = Date.now();
  const id = uid("qbo");
  const saved = await sql<{ id: string }>`
    insert into qbo_connections (
      id, location_id, org_id, entity_id, realm_id, company_name, environment,
      access_token, refresh_token, access_expires_at_ms, refresh_expires_at_ms,
      auto_sync, status, cache, connected_by, connected_at_ms, updated_at_ms
    ) values (
      ${id}, ${pending.location_id}, ${pending.org_id}, ${pending.entity_id}, ${query.realmId},
      ${companyName}, ${environment}, ${token.accessToken}, ${token.refreshToken},
      ${token.accessExpiresAt}, ${token.refreshExpiresAt}, false, 'connected',
      ${JSON.stringify(remote)}::jsonb, ${pending.user_id}, ${now}, ${now}
    )
    on conflict (location_id, entity_id) do update set
      realm_id = excluded.realm_id,
      company_name = excluded.company_name,
      environment = excluded.environment,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      access_expires_at_ms = excluded.access_expires_at_ms,
      refresh_expires_at_ms = excluded.refresh_expires_at_ms,
      status = 'connected',
      last_error = null,
      cache = excluded.cache,
      updated_at_ms = excluded.updated_at_ms
    returning id
  `;
  const connectionId = saved[0]?.id ?? id;
  await seedMaps(sql, connectionId, guessMap(remote.accounts));
  const who = pending.entity_id ? "entity" : "venue";
  return { ok: true, message: `Connected ${companyName} for this ${who}. Map any accounts that are still open, then sync.` };
}

async function pullRemote(
  environment: "sandbox" | "production",
  realmId: string,
  token: string,
): Promise<QboBooks> {
  const accountsReply = await intuitCall({
    environment,
    realmId,
    token,
    call: { method: "GET", path: accountQueryPath() },
  });
  const classReply = await intuitCall({
    environment,
    realmId,
    token,
    call: { method: "GET", path: classQueryPath() },
  });
  const accounts = asList(
    (accountsReply.json as { QueryResponse?: { Account?: QboAccountRow | QboAccountRow[] } }).QueryResponse?.Account,
  ).map((row) => ({
    Id: text(row.Id),
    Name: text(row.Name),
    AccountType: text(row.AccountType),
    Active: row.Active !== false,
  }));
  const classes = asList(
    (classReply.json as { QueryResponse?: { Class?: QboClassRow | QboClassRow[] } }).QueryResponse?.Class,
  ).map((row) => ({ Id: text(row.Id), Name: text(row.Name), Active: row.Active !== false }));
  return { accounts, classes, journals: [] };
}

const NAME_HINTS: Array<[string, string[]]> = [
  ["2300", ["gift card liability", "gift card", "gift certificate"]],
  ["4000", ["food sales", "food income", "food revenue"]],
  ["4010", ["beverage sales", "beverage income", "liquor sales", "bar sales"]],
  ["4020", ["other sales", "other income", "retail sales"]],
  ["1000", ["cash on hand", "undeposited funds", "cash"]],
  ["1010", ["card clearing", "credit card", "undeposited"]],
  ["1040", ["other tender", "other current asset"]],
  ["1400", ["due from", "intercompany receivable"]],
  ["2400", ["due to", "intercompany payable"]],
  ["2100", ["tips payable", "gratuity"]],
  ["2200", ["sales tax payable", "sales tax"]],
  ["4100", ["discount"]],
  ["4110", ["comp"]],
  ["6900", ["over/short", "over short", "cash over"]],
];

export function guessMap(accounts: QboAccountRow[]): AccountMap {
  const map: AccountMap = {};
  const used = new Set<string>();
  const rows = accounts.filter((row) => row.Active !== false);
  for (const [code, hints] of NAME_HINTS) {
    const hit = rows.find((row) => {
      if (used.has(row.Id)) return false;
      const name = row.Name.toLowerCase();
      return hints.some((hint) => name.includes(hint));
    });
    if (!hit) continue;
    used.add(hit.Id);
    map[code] = { qboId: hit.Id, qboName: hit.Name };
  }
  return map;
}

async function seedMaps(sql: Sql, connectionId: string, map: AccountMap) {
  for (const [code, account] of Object.entries(map)) {
    await sql`
      insert into qbo_account_maps (connection_id, summex_code, qbo_account_id, qbo_account_name)
      values (${connectionId}, ${code}, ${account.qboId}, ${account.qboName})
      on conflict (connection_id, summex_code) do nothing
    `;
  }
}

export async function connectTestCompany(input: {
  userId: string;
  locationId: string;
  entityId: string;
}): Promise<{ ok: true; message: string }> {
  const { orgId } = await assertQboWrite(input.userId, input.locationId, input.entityId);
  const sql = await getSql();
  const entities = await entityNames(sql, input.locationId);
  const books = seedTestBooks();
  for (const entity of entities) ensureClass(books, entity.id, entity.name);
  const now = Date.now();
  const id = uid("qbo");
  const realm = `test-${input.locationId}-${input.entityId || "venue"}`.slice(0, 80);
  const saved = await sql<{ id: string }>`
    insert into qbo_connections (
      id, location_id, org_id, entity_id, realm_id, company_name, environment,
      access_token, refresh_token, access_expires_at_ms, refresh_expires_at_ms,
      auto_sync, status, cache, connected_by, connected_at_ms, updated_at_ms
    ) values (
      ${id}, ${input.locationId}, ${orgId}, ${input.entityId}, ${realm},
      ${"Test QuickBooks company"}, ${"test"}, ${""}, ${""}, ${0}, ${0},
      false, 'connected', ${JSON.stringify(books)}::jsonb, ${input.userId}, ${now}, ${now}
    )
    on conflict (location_id, entity_id) do update set
      realm_id = excluded.realm_id,
      company_name = excluded.company_name,
      environment = 'test',
      access_token = '',
      refresh_token = '',
      status = 'connected',
      last_error = null,
      cache = excluded.cache,
      updated_at_ms = excluded.updated_at_ms
    returning id
  `;
  const connectionId = saved[0]?.id ?? id;
  await seedMaps(sql, connectionId, testAccountMap());
  for (const klass of books.classes) {
    const entity = entities.find((row) => klass.Id === `cls_${row.id}`.slice(0, 40));
    if (!entity) continue;
    await sql`
      insert into qbo_class_maps (connection_id, entity_id, qbo_class_id, qbo_class_name)
      values (${connectionId}, ${entity.id}, ${klass.Id}, ${klass.Name})
      on conflict (connection_id, entity_id) do update set
        qbo_class_id = excluded.qbo_class_id,
        qbo_class_name = excluded.qbo_class_name
    `;
  }
  return {
    ok: true,
    message: input.entityId
      ? "Test company connected for this entity. Sync now posts the journal here."
      : "Test company connected for the venue. Sync now posts every entity on one journal.",
  };
}

export async function disconnectQbo(userId: string, locationId: string, connectionId: string): Promise<void> {
  await assertQboWrite(userId, locationId, await entityIdFor(locationId, connectionId));
  const sql = await getSql();
  await sql`delete from qbo_connections where id = ${connectionId} and location_id = ${locationId}`;
}

async function entityIdFor(locationId: string, connectionId: string): Promise<string> {
  const sql = await getSql();
  const rows = await sql<{ entity_id: string }>`
    select entity_id from qbo_connections where id = ${connectionId} and location_id = ${locationId} limit 1
  `;
  if (!rows[0]) throw new ForbiddenError("QuickBooks company not found");
  return rows[0].entity_id;
}

export async function saveAccountMap(input: {
  userId: string;
  locationId: string;
  connectionId: string;
  maps: Array<{ code: string; qboAccountId: string; qboAccountName: string }>;
}): Promise<void> {
  await assertQboWrite(input.userId, input.locationId, await entityIdFor(input.locationId, input.connectionId));
  const allowed = new Set(SUMMEX_ACCOUNTS.map((row) => row.code));
  const sql = await getSql();
  for (const row of input.maps) {
    if (!allowed.has(row.code)) continue;
    if (!row.qboAccountId) {
      await sql`
        delete from qbo_account_maps
        where connection_id = ${input.connectionId} and summex_code = ${row.code}
      `;
      continue;
    }
    await sql`
      insert into qbo_account_maps (connection_id, summex_code, qbo_account_id, qbo_account_name)
      values (${input.connectionId}, ${row.code}, ${row.qboAccountId}, ${row.qboAccountName})
      on conflict (connection_id, summex_code) do update set
        qbo_account_id = excluded.qbo_account_id,
        qbo_account_name = excluded.qbo_account_name
    `;
  }
}

export async function saveClassMap(input: {
  userId: string;
  locationId: string;
  connectionId: string;
  maps: Array<{ entityId: string; classId: string; className: string }>;
}): Promise<void> {
  const entityId = await entityIdFor(input.locationId, input.connectionId);
  await assertQboWrite(input.userId, input.locationId, entityId);
  const sql = await getSql();
  for (const row of input.maps) {
    if (!row.entityId) continue;
    if (!row.classId) {
      await sql`
        delete from qbo_class_maps
        where connection_id = ${input.connectionId} and entity_id = ${row.entityId}
      `;
      continue;
    }
    await sql`
      insert into qbo_class_maps (connection_id, entity_id, qbo_class_id, qbo_class_name)
      values (${input.connectionId}, ${row.entityId}, ${row.classId}, ${row.className})
      on conflict (connection_id, entity_id) do update set
        qbo_class_id = excluded.qbo_class_id,
        qbo_class_name = excluded.qbo_class_name
    `;
  }
}

export async function setAutoSync(input: {
  userId: string;
  locationId: string;
  connectionId: string;
  autoSync: boolean;
}): Promise<void> {
  await assertQboWrite(input.userId, input.locationId, await entityIdFor(input.locationId, input.connectionId));
  const sql = await getSql();
  await sql`
    update qbo_connections
    set auto_sync = ${input.autoSync}, updated_at_ms = ${Date.now()}
    where id = ${input.connectionId} and location_id = ${input.locationId}
  `;
}

export async function refreshQboAccounts(userId: string, locationId: string, connectionId: string): Promise<void> {
  await assertQboWrite(userId, locationId, await entityIdFor(locationId, connectionId));
  const sql = await getSql();
  const conn = await loadConn(sql, locationId, connectionId);
  if (conn.environment === "test") return;
  const token = await freshToken(sql, conn);
  const environment = conn.environment === "production" ? "production" : "sandbox";
  const remote = await pullRemote(environment, conn.realm_id, token);
  const prior = booksOf(conn.cache);
  remote.journals = prior.journals;
  await sql`
    update qbo_connections
    set cache = ${JSON.stringify(remote)}::jsonb, updated_at_ms = ${Date.now()}, last_error = null
    where id = ${conn.id}
  `;
}

async function loadConn(sql: Sql, locationId: string, connectionId: string): Promise<Conn> {
  const rows = await sql<Conn>`
    select id, location_id, org_id, entity_id, realm_id, company_name, environment,
           access_token, refresh_token, access_expires_at_ms, auto_sync, status, last_error,
           cache, connected_at_ms
    from qbo_connections
    where id = ${connectionId} and location_id = ${locationId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("QuickBooks company not found");
  return row;
}

async function freshToken(sql: Sql, conn: Conn): Promise<string> {
  if (conn.environment === "test") return "";
  if (num(conn.access_expires_at_ms) > Date.now() + 60_000 && conn.access_token) return conn.access_token;
  const next = await refreshIntuitToken(conn.refresh_token);
  await sql`
    update qbo_connections set
      access_token = ${next.accessToken},
      refresh_token = ${next.refreshToken},
      access_expires_at_ms = ${next.accessExpiresAt},
      refresh_expires_at_ms = ${next.refreshExpiresAt},
      updated_at_ms = ${Date.now()}
    where id = ${conn.id}
  `;
  return next.accessToken;
}

async function mapFor(sql: Sql, connectionId: string): Promise<AccountMap> {
  const rows = await sql<{ summex_code: string; qbo_account_id: string; qbo_account_name: string }>`
    select summex_code, qbo_account_id, qbo_account_name
    from qbo_account_maps
    where connection_id = ${connectionId}
  `;
  const map: AccountMap = {};
  for (const row of rows) map[row.summex_code] = { qboId: row.qbo_account_id, qboName: row.qbo_account_name };
  return map;
}

async function classesFor(sql: Sql, connectionId: string): Promise<Record<string, QboClassRef>> {
  const rows = await sql<{ entity_id: string; qbo_class_id: string; qbo_class_name: string }>`
    select entity_id, qbo_class_id, qbo_class_name
    from qbo_class_maps
    where connection_id = ${connectionId}
  `;
  const out: Record<string, QboClassRef> = {};
  for (const row of rows) out[row.entity_id] = { id: row.qbo_class_id, name: row.qbo_class_name };
  return out;
}

function summarize(draft: QboJournalDraft): string {
  return draft.lines
    .map((line) => {
      const amount = ((line.debitCents || line.creditCents) / 100).toFixed(2);
      const side = line.debitCents ? "Dr" : "Cr";
      return `${side} ${amount} ${line.description}`;
    })
    .join(" · ")
    .slice(0, 1800);
}

async function writeLog(
  sql: Sql,
  input: {
    locationId: string;
    connectionId: string;
    entityId: string;
    businessDate: string;
    trigger: string;
    status: string;
    attempt: number;
    docNumber?: string | null;
    qboId?: string | null;
    error?: string | null;
    summary?: string | null;
  },
) {
  await sql`
    insert into qbo_sync_log (
      id, location_id, connection_id, entity_id, business_date, trigger, status, attempt,
      doc_number, qbo_id, error, summary, created_at_ms
    ) values (
      ${uid("qlog")}, ${input.locationId}, ${input.connectionId}, ${input.entityId},
      ${input.businessDate}, ${input.trigger}, ${input.status}, ${input.attempt},
      ${input.docNumber ?? null}, ${input.qboId ?? null}, ${input.error ?? null},
      ${input.summary ?? null}, ${Date.now()}
    )
  `;
}

export async function syncConnection(input: {
  userId?: string;
  locationId: string;
  connectionId: string;
  businessDate: string;
  trigger: "manual" | "nightly" | "retry";
}): Promise<QboSyncResult> {
  if (!isBusinessDate(input.businessDate)) {
    return { ok: false, status: "error", message: "Pick a business date.", docNumber: null, lines: [] };
  }
  if (input.userId) {
    await assertQboWrite(input.userId, input.locationId, await entityIdFor(input.locationId, input.connectionId));
  }
  const sql = await getSql();
  const conn = await loadConn(sql, input.locationId, input.connectionId);
  const loc = await locationRow(sql, input.locationId);
  const entities = await entityNames(sql, input.locationId);
  const names: Record<string, string> = {};
  for (const entity of entities) names[entity.id] = entity.name;
  const attempts = await sql<{ n: number }>`
    select coalesce(max(attempt), 0)::int as n
    from qbo_sync_log
    where connection_id = ${conn.id} and business_date = ${input.businessDate}
  `;
  const attempt = num(attempts[0]?.n) + 1;
  const training = loc.lifecycle_status !== "live";
  if (training && conn.environment === "production") {
    const message = "This location is in training. A production QuickBooks company is not updated.";
    await writeLog(sql, {
      locationId: input.locationId,
      connectionId: conn.id,
      entityId: conn.entity_id,
      businessDate: input.businessDate,
      trigger: input.trigger,
      status: "skipped",
      attempt,
      error: message,
    });
    return { ok: false, status: "skipped", message, docNumber: null, lines: [] };
  }
  let days: QboEntityDay[] = [];
  try {
    days = await loadActivity(sql, input.locationId, input.businessDate, loc.timezone || "UTC", names);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the day’s checks.";
    await writeLog(sql, {
      locationId: input.locationId,
      connectionId: conn.id,
      entityId: conn.entity_id,
      businessDate: input.businessDate,
      trigger: input.trigger,
      status: "error",
      attempt,
      error: message,
    });
    await touchError(sql, conn.id, message);
    return { ok: false, status: "error", message, docNumber: null, lines: [] };
  }
  const mode = conn.entity_id ? "entity" : "location";
  const drafts = buildJournals({
    days: mode === "entity" ? days.filter((day) => day.entityId === conn.entity_id) : days,
    mode,
    entityId: conn.entity_id,
    businessDate: input.businessDate,
    training,
  });
  const draft = drafts[0];
  if (!draft) {
    const message = "Nothing to post for that date.";
    await writeLog(sql, {
      locationId: input.locationId,
      connectionId: conn.id,
      entityId: conn.entity_id,
      businessDate: input.businessDate,
      trigger: input.trigger,
      status: "skipped",
      attempt,
      error: message,
    });
    return { ok: true, status: "skipped", message, docNumber: null, lines: [] };
  }
  const existing = await sql<{ qbo_id: string | null }>`
    select qbo_id from qbo_posted
    where connection_id = ${conn.id} and doc_number = ${draft.docNumber}
    limit 1
  `;
  if (existing[0]) {
    const message = `Already posted ${draft.docNumber}.`;
    await writeLog(sql, {
      locationId: input.locationId,
      connectionId: conn.id,
      entityId: conn.entity_id,
      businessDate: input.businessDate,
      trigger: input.trigger,
      status: "skipped",
      attempt,
      docNumber: draft.docNumber,
      qboId: existing[0].qbo_id,
      summary: message,
    });
    return { ok: true, status: "skipped", message, docNumber: draft.docNumber, lines: draft.lines };
  }
  const map = await mapFor(sql, conn.id);
  const missing = missingAccounts(draft, map);
  if (missing.length) {
    const message = new QboMapError(missing).message;
    await writeLog(sql, {
      locationId: input.locationId,
      connectionId: conn.id,
      entityId: conn.entity_id,
      businessDate: input.businessDate,
      trigger: input.trigger,
      status: "error",
      attempt,
      docNumber: draft.docNumber,
      error: message,
    });
    await touchError(sql, conn.id, message);
    return { ok: false, status: "error", message, docNumber: draft.docNumber, lines: draft.lines };
  }
  let classBy = await classesFor(sql, conn.id);
  const books = booksOf(conn.cache);
  if (conn.environment === "test" && mode === "location") {
    for (const line of draft.lines) {
      const klass = ensureClass(books, line.entityId, line.entityName);
      classBy = { ...classBy, [line.entityId]: classBy[line.entityId] ?? { id: klass.Id, name: klass.Name } };
    }
  }
  let payload: Record<string, unknown>;
  try {
    payload = toQboPayload(draft, map, classBy);
  } catch (err) {
    const message = err instanceof Error ? err.message : "The journal could not be built.";
    await writeLog(sql, {
      locationId: input.locationId,
      connectionId: conn.id,
      entityId: conn.entity_id,
      businessDate: input.businessDate,
      trigger: input.trigger,
      status: "error",
      attempt,
      error: message,
    });
    await touchError(sql, conn.id, message);
    return { ok: false, status: "error", message, docNumber: draft.docNumber, lines: draft.lines };
  }
  try {
    const reply = await postJournal(sql, conn, books, payload);
    if (reply.status >= 200 && reply.status < 300) {
      const qboId = text((reply.json as { JournalEntry?: { Id?: string } }).JournalEntry?.Id) || null;
      await sql`
        insert into qbo_posted (id, connection_id, location_id, business_date, doc_number, qbo_id, payload, created_at_ms)
        values (
          ${uid("qpost")}, ${conn.id}, ${input.locationId}, ${input.businessDate}, ${draft.docNumber},
          ${qboId}, ${JSON.stringify({ lines: draft.lines, qbo: payload })}::jsonb, ${Date.now()}
        )
        on conflict (connection_id, doc_number) do nothing
      `;
      const message = `Posted ${draft.docNumber} to ${conn.company_name}.`;
      await writeLog(sql, {
        locationId: input.locationId,
        connectionId: conn.id,
        entityId: conn.entity_id,
        businessDate: input.businessDate,
        trigger: input.trigger,
        status: "posted",
        attempt,
        docNumber: draft.docNumber,
        qboId,
        summary: summarize(draft),
      });
      await sql`
        update qbo_connections set last_error = null, status = 'connected', updated_at_ms = ${Date.now()}
        where id = ${conn.id}
      `;
      return { ok: true, status: "posted", message, docNumber: draft.docNumber, lines: draft.lines };
    }
    if (isDuplicateDoc(reply.json)) {
      const message = `Already in QuickBooks as ${draft.docNumber}.`;
      await writeLog(sql, {
        locationId: input.locationId,
        connectionId: conn.id,
        entityId: conn.entity_id,
        businessDate: input.businessDate,
        trigger: input.trigger,
        status: "skipped",
        attempt,
        docNumber: draft.docNumber,
        summary: message,
      });
      return { ok: true, status: "skipped", message, docNumber: draft.docNumber, lines: draft.lines };
    }
    const message = intuitFaultMessage(reply.json);
    await writeLog(sql, {
      locationId: input.locationId,
      connectionId: conn.id,
      entityId: conn.entity_id,
      businessDate: input.businessDate,
      trigger: input.trigger,
      status: "error",
      attempt,
      docNumber: draft.docNumber,
      error: message,
    });
    await touchError(sql, conn.id, message);
    return { ok: false, status: "error", message, docNumber: draft.docNumber, lines: draft.lines };
  } catch (err) {
    const message = err instanceof Error ? err.message : "QuickBooks could not be reached.";
    await writeLog(sql, {
      locationId: input.locationId,
      connectionId: conn.id,
      entityId: conn.entity_id,
      businessDate: input.businessDate,
      trigger: input.trigger,
      status: "error",
      attempt,
      docNumber: draft.docNumber,
      error: message,
    });
    await touchError(sql, conn.id, message);
    return { ok: false, status: "error", message, docNumber: draft.docNumber, lines: draft.lines };
  }
}

async function touchError(sql: Sql, connectionId: string, message: string) {
  await sql`
    update qbo_connections
    set last_error = ${message.slice(0, 500)}, status = 'error', updated_at_ms = ${Date.now()}
    where id = ${connectionId}
  `;
}

async function postJournal(sql: Sql, conn: Conn, books: QboBooks, payload: Record<string, unknown>) {
  if (conn.environment === "test") {
    const reply = applyQboCall(books, { method: "POST", path: `/v3/company/${conn.realm_id}/journalentry`, body: payload });
    await sql`
      update qbo_connections set cache = ${JSON.stringify(books)}::jsonb, updated_at_ms = ${Date.now()}
      where id = ${conn.id}
    `;
    return reply;
  }
  const token = await freshToken(sql, conn);
  const environment = conn.environment === "production" ? "production" : "sandbox";
  return intuitCall({
    environment,
    realmId: conn.realm_id,
    token,
    call: { method: "POST", path: journalPath(), body: payload },
  });
}

export async function retryQboLog(userId: string, locationId: string, logId: string): Promise<QboSyncResult> {
  const sql = await getSql();
  const rows = await sql<{ connection_id: string | null; business_date: string }>`
    select connection_id, business_date from qbo_sync_log
    where id = ${logId} and location_id = ${locationId}
    limit 1
  `;
  const row = rows[0];
  if (!row?.connection_id) {
    return { ok: false, status: "error", message: "That sync has no company to retry.", docNumber: null, lines: [] };
  }
  return syncConnection({
    userId,
    locationId,
    connectionId: row.connection_id,
    businessDate: row.business_date,
    trigger: "retry",
  });
}

export async function syncAutoLocation(userId: string, locationId: string): Promise<{ results: QboSyncResult[] }> {
  const sql = await getSql();
  const loc = await locationRow(sql, locationId);
  const date = nightlyBusinessDate(Date.now(), loc.timezone || "UTC");
  const connections = await sql<{ id: string; entity_id: string }>`
    select id, entity_id from qbo_connections
    where location_id = ${locationId} and auto_sync = true and status <> 'disconnected'
  `;
  const results: QboSyncResult[] = [];
  for (const conn of connections) {
    try {
      await assertQboWrite(userId, locationId, conn.entity_id);
    } catch {
      continue;
    }
    results.push(
      await syncConnection({
        userId,
        locationId,
        connectionId: conn.id,
        businessDate: date,
        trigger: "nightly",
      }),
    );
  }
  return { results };
}

export async function syncAllAuto(now = Date.now()): Promise<{ posted: number; errors: number }> {
  const sql = await getSql();
  const connections = await sql<{ id: string; location_id: string; timezone: string }>`
    select c.id, c.location_id, l.timezone
    from qbo_connections c
    join locations l on l.id = c.location_id
    where c.auto_sync = true
  `;
  let posted = 0;
  let errors = 0;
  for (const conn of connections) {
    const date = nightlyBusinessDate(now, conn.timezone || "UTC");
    const result = await syncConnection({
      locationId: conn.location_id,
      connectionId: conn.id,
      businessDate: date,
      trigger: "nightly",
    });
    if (result.status === "posted") posted += 1;
    if (result.status === "error") errors += 1;
  }
  return { posted, errors };
}

export function callbackHtml(message: string, ok: boolean): string {
  const safe = message.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);
  return `<!doctype html><html><body style="font-family:sans-serif;padding:32px">
<p>${safe}</p>
<p><a href="/">Return to Summex</a></p>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "qbo", ok: ${ok ? "true" : "false"} }, window.location.origin);
    window.close();
  }
</script>
</body></html>`;
}
