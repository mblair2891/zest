import { getSql, type Sql } from "@/lib/db";
import { ForbiddenError } from "@/lib/saas/tenancy.server";
import {
  loadEntityWriteContext,
  type EntityWriteContext,
} from "@/lib/access/assert-entity.server";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { uid } from "@/lib/utils";
import type {
  Course,
  OrderStatus,
  OrderType,
  PaymentMethod,
  SelectedModifier,
  TableStatus,
  TicketStation,
  TicketStatus,
} from "./types";
import type {
  AddLinesInput,
  FloorActor,
  FloorCheck,
  FloorLine,
  FloorLineStatus,
  FloorPayment,
  FloorTableStatus,
  FloorTicket,
  FloorTicketEvent,
  FloorTicketItem,
  OdsActionInput,
  OpenFloor,
  RecordPaymentInput,
  SendToStationsInput,
  UpsertCheckInput,
  UpsertTableStatusInput,
} from "./floor-types";

const OPEN_WINDOW_MS = 12 * 60 * 60 * 1000;
const BUMP_RECALL_MS = 45 * 60 * 1000;

const ORDER_TYPES = new Set<OrderType>([
  "dine_in",
  "bar_tab",
  "takeout",
  "delivery",
  "online",
  "kiosk",
]);
const ORDER_STATUSES = new Set<OrderStatus>(["open", "closed", "voided", "cancelled"]);
const STATIONS = new Set<TicketStation>(["kitchen", "bar", "expo", "dessert"]);
const TICKET_STATUSES = new Set<TicketStatus>(["new", "in_progress", "ready", "bumped"]);
const LINE_STATUSES = new Set<FloorLineStatus>([
  "draft",
  "sent",
  "started",
  "ready",
  "delivered",
]);
const COURSES = new Set<Course>([
  "drink",
  "appetizer",
  "salad",
  "entree",
  "side",
  "dessert",
  "other",
]);

type CheckRow = {
  id: string;
  location_id: string;
  org_id: string;
  table_id: string | null;
  tab_name: string | null;
  number: number;
  type: string;
  status: string;
  server_id: string;
  server_name: string;
  guest_count: number;
  discount_percent: number;
  discount_cents: number;
  auto_grat_applied: boolean;
  service_charge_cents: number;
  note: string | null;
  check_printed_at_ms: number | string | null;
  merged_table_ids: unknown;
  created_at_ms: number | string;
  updated_at_ms: number | string;
  closed_at_ms: number | string | null;
};

type ItemRow = {
  id: string;
  check_id: string;
  location_id: string;
  menu_item_id: string | null;
  name: string;
  operator_id: string | null;
  vendor_name: string | null;
  quantity: number;
  unit_price_cents: number;
  modifiers: unknown;
  note: string | null;
  seat: number | null;
  course: string;
  station: string;
  item_status: string;
  sent: boolean;
  held: boolean;
  voided: boolean;
  comped: boolean;
  discount_cents: number;
  tax_exempt: boolean;
  ticket_id: string | null;
  created_at_ms: number | string;
  fired_at_ms: number | string | null;
};

type TicketRow = {
  id: string;
  location_id: string;
  check_id: string;
  order_number: number;
  table_label: string;
  server_name: string;
  server_id: string | null;
  station: string;
  operator_id: string | null;
  vendor_name: string | null;
  status: string;
  course: string;
  items: unknown;
  created_at_ms: number | string;
  started_at_ms: number | string | null;
  ready_at_ms: number | string | null;
  bumped_at_ms: number | string | null;
};

type PayRow = {
  id: string;
  check_id: string;
  method: string;
  amount_cents: number;
  tip_cents: number;
  tendered_cents: number | null;
  change_cents: number | null;
  last4: string | null;
  gift_card_code: string | null;
  house_account_id: string | null;
  employee_id: string;
  processor: string | null;
  charge_brand: string | null;
  sandbox: boolean;
  at_ms: number | string;
};

type TableRow = {
  table_id: string;
  status: string;
  check_id: string | null;
  server_id: string | null;
  guest_count: number | null;
  seated_at_ms: number | string | null;
  status_since_ms: number | string;
};

function n(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function clip(raw: unknown, max: number): string {
  return String(raw ?? "").trim().slice(0, max);
}

function asCourse(raw: unknown): Course {
  const s = String(raw ?? "entree");
  return COURSES.has(s as Course) ? (s as Course) : "entree";
}

function asStation(raw: unknown): TicketStation {
  const s = String(raw ?? "kitchen");
  return STATIONS.has(s as TicketStation) ? (s as TicketStation) : "kitchen";
}

function asTicketStatus(raw: unknown): TicketStatus {
  const s = String(raw ?? "new");
  return TICKET_STATUSES.has(s as TicketStatus) ? (s as TicketStatus) : "new";
}

function asLineStatus(raw: unknown): FloorLineStatus {
  const s = String(raw ?? "draft");
  return LINE_STATUSES.has(s as FloorLineStatus) ? (s as FloorLineStatus) : "draft";
}

function asOrderType(raw: unknown): OrderType {
  const s = String(raw ?? "dine_in");
  return ORDER_TYPES.has(s as OrderType) ? (s as OrderType) : "dine_in";
}

function asOrderStatus(raw: unknown): OrderStatus {
  const s = String(raw ?? "open");
  return ORDER_STATUSES.has(s as OrderStatus) ? (s as OrderStatus) : "open";
}

function asTableStatus(raw: unknown): TableStatus {
  const s = String(raw ?? "empty");
  return (s || "empty") as TableStatus;
}

function asJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? (v as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseModifiers(raw: unknown): SelectedModifier[] {
  return asJsonArray<SelectedModifier>(raw).filter(
    (m) => m && typeof m === "object" && typeof m.optionName === "string",
  );
}

function parseTicketItems(raw: unknown): FloorTicketItem[] {
  return asJsonArray<FloorTicketItem>(raw).filter(
    (it) => it && typeof it === "object" && typeof it.lineId === "string",
  );
}

export async function loadFloorContext(
  userId: string,
  locationId: string,
): Promise<EntityWriteContext> {
  const loc = clip(locationId, 80);
  if (!loc) throw new ForbiddenError("Location is required");
  const sql = await getSql();
  const rows = await sql<{ id: string; org_id: string }>`
    select id, org_id from locations
    where id = ${loc} and coalesce(is_demo, false) = false
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Location not found");
  return loadEntityWriteContext(userId, row.org_id, loc);
}

export function isVendorScoped(ctx: EntityWriteContext): boolean {
  return ctx.role === "vendor" && Boolean(ctx.operatorId) && ctx.operatorId !== HOST_SCOPE;
}

export function vendorOperatorId(ctx: EntityWriteContext): string | null {
  return isVendorScoped(ctx) ? ctx.operatorId : null;
}

function assertLineOperator(ctx: EntityWriteContext, operatorId: string | null | undefined): void {
  const scoped = vendorOperatorId(ctx);
  if (!scoped) return;
  const op = clip(operatorId, 80) || HOST_SCOPE;
  if (op !== scoped) throw new ForbiddenError("Not permitted for this operator");
}

function assertTicketOperator(ctx: EntityWriteContext, operatorId: string | null | undefined): void {
  assertLineOperator(ctx, operatorId);
}

function lineToRowStatus(line: FloorLine): FloorLineStatus {
  if (line.itemStatus && LINE_STATUSES.has(line.itemStatus)) return line.itemStatus;
  if (!line.sent) return "draft";
  return "sent";
}

function mapLine(row: ItemRow): FloorLine {
  return {
    id: row.id,
    menuItemId: row.menu_item_id ?? "",
    name: row.name,
    operatorId: row.operator_id,
    vendorName: row.vendor_name,
    quantity: n(row.quantity, 1),
    unitPriceCents: n(row.unit_price_cents),
    modifiers: parseModifiers(row.modifiers),
    note: row.note,
    seat: row.seat == null ? null : n(row.seat),
    course: asCourse(row.course),
    station: asStation(row.station),
    itemStatus: asLineStatus(row.item_status),
    sent: Boolean(row.sent),
    held: Boolean(row.held),
    voided: Boolean(row.voided),
    comped: Boolean(row.comped),
    discountCents: n(row.discount_cents),
    taxExempt: Boolean(row.tax_exempt),
    ticketId: row.ticket_id,
    createdAt: n(row.created_at_ms),
    firedAt: row.fired_at_ms == null ? null : n(row.fired_at_ms),
  };
}

function mapPayment(row: PayRow): FloorPayment {
  return {
    id: row.id,
    method: (row.method || "cash") as PaymentMethod,
    amountCents: n(row.amount_cents),
    tipCents: n(row.tip_cents),
    tenderedCents: row.tendered_cents == null ? undefined : n(row.tendered_cents),
    changeCents: row.change_cents == null ? undefined : n(row.change_cents),
    last4: row.last4 ?? undefined,
    giftCardCode: row.gift_card_code ?? undefined,
    houseAccountId: row.house_account_id ?? undefined,
    at: n(row.at_ms),
    employeeId: row.employee_id,
    processor:
      row.processor === "quantum_payments" || row.processor === "zest_payments"
        ? row.processor
        : undefined,
    chargeBrand: row.charge_brand ?? undefined,
    sandbox: Boolean(row.sandbox),
  };
}

function mapTicket(row: TicketRow, now: number): FloorTicket {
  const createdAt = n(row.created_at_ms);
  const startedAt = row.started_at_ms == null ? undefined : n(row.started_at_ms);
  const bumpedAt = row.bumped_at_ms == null ? undefined : n(row.bumped_at_ms);
  return {
    id: row.id,
    locationId: row.location_id,
    orderId: row.check_id,
    orderNumber: n(row.order_number),
    tableLabel: row.table_label,
    serverName: row.server_name,
    serverId: row.server_id ?? undefined,
    station: asStation(row.station),
    operatorId: row.operator_id,
    vendorName: row.vendor_name,
    status: asTicketStatus(row.status),
    course: asCourse(row.course),
    createdAt,
    elapsedSec: Math.max(0, Math.floor((now - createdAt) / 1000)),
    bumpedAt,
    startedAt,
    items: parseTicketItems(row.items).map((it) => ({
      lineId: String(it.lineId),
      name: String(it.name ?? ""),
      quantity: n(it.quantity, 1),
      modifiers: Array.isArray(it.modifiers) ? it.modifiers.map(String) : [],
      note: it.note ? String(it.note) : undefined,
      course: asCourse(it.course),
      seat: it.seat == null ? undefined : n(it.seat),
    })),
  };
}

function mapCheck(
  row: CheckRow,
  lines: FloorLine[],
  payments: FloorPayment[],
): FloorCheck {
  return {
    id: row.id,
    locationId: row.location_id,
    tableId: row.table_id,
    tabName: row.tab_name,
    number: n(row.number),
    type: asOrderType(row.type),
    status: asOrderStatus(row.status),
    serverId: row.server_id,
    serverName: row.server_name,
    guestCount: n(row.guest_count, 1),
    discountPercent: n(row.discount_percent),
    discountCents: n(row.discount_cents),
    autoGratApplied: Boolean(row.auto_grat_applied),
    serviceChargeCents: n(row.service_charge_cents),
    note: row.note,
    checkPrintedAt: row.check_printed_at_ms == null ? null : n(row.check_printed_at_ms),
    mergedTableIds: asJsonArray<string>(row.merged_table_ids).map(String),
    lines,
    payments,
    createdAt: n(row.created_at_ms),
    updatedAt: n(row.updated_at_ms),
    closedAt: row.closed_at_ms == null ? null : n(row.closed_at_ms),
  };
}

async function loadOpenWindowRows(
  sql: Sql,
  locationId: string,
  since: number,
): Promise<{ checks: CheckRow[]; items: ItemRow[]; payments: PayRow[] }> {
  const checks = await sql<CheckRow>`
    select * from pos_checks
    where location_id = ${locationId}
      and (status = ${"open"} or coalesce(closed_at_ms, 0) >= ${since} or coalesce(updated_at_ms, 0) >= ${since})
    order by created_at_ms desc
    limit 400
  `;
  const items = await sql<ItemRow>`
    select i.* from pos_check_items i
    inner join pos_checks c on c.id = i.check_id
    where i.location_id = ${locationId}
      and (c.status = ${"open"} or coalesce(c.closed_at_ms, 0) >= ${since} or coalesce(c.updated_at_ms, 0) >= ${since})
    order by i.created_at_ms asc
  `;
  const payments = await sql<PayRow>`
    select p.* from pos_check_payments p
    inner join pos_checks c on c.id = p.check_id
    where p.location_id = ${locationId}
      and (c.status = ${"open"} or coalesce(c.closed_at_ms, 0) >= ${since} or coalesce(c.updated_at_ms, 0) >= ${since})
    order by p.at_ms asc
  `;
  return { checks, items, payments };
}

function assembleChecks(
  checks: CheckRow[],
  items: ItemRow[],
  payments: PayRow[],
  scopedOp: string | null,
): FloorCheck[] {
  const itemsBy = new Map<string, FloorLine[]>();
  for (const it of items) {
    if (scopedOp && (it.operator_id || HOST_SCOPE) !== scopedOp) continue;
    const list = itemsBy.get(it.check_id) ?? [];
    list.push(mapLine(it));
    itemsBy.set(it.check_id, list);
  }
  const payBy = new Map<string, FloorPayment[]>();
  for (const p of payments) {
    const list = payBy.get(p.check_id) ?? [];
    list.push(mapPayment(p));
    payBy.set(p.check_id, list);
  }
  return checks
    .map((c) => mapCheck(c, itemsBy.get(c.id) ?? [], payBy.get(c.id) ?? []))
    .filter((c) => !scopedOp || c.lines.length > 0);
}

async function writeEvent(
  sql: Sql,
  opts: {
    locationId: string;
    ticketId: string;
    checkId: string;
    kind: string;
    actor?: FloorActor;
    operatorId?: string | null;
    payload?: Record<string, unknown>;
    at: number;
  },
): Promise<void> {
  await sql`
    insert into pos_ticket_events (
      id, location_id, ticket_id, check_id, kind, actor_id, actor_name, operator_id, at_ms, payload
    ) values (
      ${uid("tev")},
      ${opts.locationId},
      ${opts.ticketId},
      ${opts.checkId},
      ${opts.kind},
      ${opts.actor?.employeeId ?? null},
      ${opts.actor?.employeeName ?? null},
      ${opts.operatorId ?? null},
      ${opts.at},
      ${JSON.stringify(opts.payload ?? {})}::jsonb
    )
  `;
}

async function upsertCheckRow(
  sql: Sql,
  ctx: EntityWriteContext,
  check: FloorCheck,
  clientMutationId: string | null,
  now: number,
): Promise<void> {
  const existing = await sql<{ id: string; location_id: string }>`
    select id, location_id from pos_checks where id = ${check.id} limit 1
  `;
  if (existing[0] && existing[0].location_id !== ctx.locationId) {
    throw new ForbiddenError("Check belongs to another location");
  }
  await sql`
    insert into pos_checks (
      id, location_id, org_id, table_id, tab_name, number, type, status,
      server_id, server_name, guest_count, discount_percent, discount_cents,
      auto_grat_applied, service_charge_cents, note, check_printed_at_ms,
      merged_table_ids, client_mutation_id, created_at_ms, updated_at_ms, closed_at_ms
    ) values (
      ${check.id},
      ${ctx.locationId},
      ${ctx.orgId},
      ${check.tableId},
      ${check.tabName},
      ${check.number},
      ${check.type},
      ${check.status},
      ${check.serverId},
      ${check.serverName},
      ${check.guestCount},
      ${check.discountPercent},
      ${check.discountCents},
      ${check.autoGratApplied},
      ${check.serviceChargeCents},
      ${check.note},
      ${check.checkPrintedAt},
      ${JSON.stringify(check.mergedTableIds ?? [])}::jsonb,
      ${clientMutationId},
      ${check.createdAt || now},
      ${now},
      ${check.closedAt}
    )
    on conflict (id) do update set
      table_id = excluded.table_id,
      tab_name = excluded.tab_name,
      number = excluded.number,
      type = excluded.type,
      status = excluded.status,
      server_id = excluded.server_id,
      server_name = excluded.server_name,
      guest_count = excluded.guest_count,
      discount_percent = excluded.discount_percent,
      discount_cents = excluded.discount_cents,
      auto_grat_applied = excluded.auto_grat_applied,
      service_charge_cents = excluded.service_charge_cents,
      note = excluded.note,
      check_printed_at_ms = excluded.check_printed_at_ms,
      merged_table_ids = excluded.merged_table_ids,
      updated_at_ms = excluded.updated_at_ms,
      closed_at_ms = excluded.closed_at_ms
    where pos_checks.location_id = ${ctx.locationId}
  `;
}

async function upsertLines(
  sql: Sql,
  ctx: EntityWriteContext,
  checkId: string,
  lines: FloorLine[],
  now: number,
): Promise<void> {
  for (const line of lines) {
    assertLineOperator(ctx, line.operatorId);
    const status = lineToRowStatus(line);
    await sql`
      insert into pos_check_items (
        id, check_id, location_id, menu_item_id, name, operator_id, vendor_name,
        quantity, unit_price_cents, modifiers, note, seat, course, station,
        item_status, sent, held, voided, comped, discount_cents, tax_exempt,
        ticket_id, created_at_ms, updated_at_ms, fired_at_ms
      ) values (
        ${line.id},
        ${checkId},
        ${ctx.locationId},
        ${line.menuItemId || null},
        ${line.name},
        ${line.operatorId},
        ${line.vendorName},
        ${line.quantity},
        ${line.unitPriceCents},
        ${JSON.stringify(line.modifiers ?? [])}::jsonb,
        ${line.note},
        ${line.seat},
        ${line.course},
        ${line.station},
        ${status},
        ${line.sent},
        ${line.held},
        ${line.voided},
        ${line.comped},
        ${line.discountCents},
        ${line.taxExempt},
        ${line.ticketId},
        ${line.createdAt || now},
        ${now},
        ${line.firedAt}
      )
      on conflict (id) do update set
        name = excluded.name,
        operator_id = excluded.operator_id,
        vendor_name = excluded.vendor_name,
        quantity = excluded.quantity,
        unit_price_cents = excluded.unit_price_cents,
        modifiers = excluded.modifiers,
        note = excluded.note,
        seat = excluded.seat,
        course = excluded.course,
        station = excluded.station,
        held = excluded.held,
        voided = excluded.voided,
        comped = excluded.comped,
        discount_cents = excluded.discount_cents,
        tax_exempt = excluded.tax_exempt,
        ticket_id = coalesce(excluded.ticket_id, pos_check_items.ticket_id),
        sent = pos_check_items.sent or excluded.sent,
        item_status = case
          when pos_check_items.item_status = ${"delivered"} then ${"delivered"}
          when pos_check_items.item_status = ${"ready"}
            and excluded.item_status = ${"delivered"} then ${"delivered"}
          when pos_check_items.item_status = ${"ready"} then ${"ready"}
          when pos_check_items.item_status = ${"started"}
            and excluded.item_status in (${"ready"}, ${"delivered"}) then excluded.item_status
          when pos_check_items.item_status = ${"started"} then ${"started"}
          when pos_check_items.item_status = ${"sent"}
            and excluded.item_status in (${"draft"}, ${"sent"}) then ${"sent"}
          else excluded.item_status
        end,
        updated_at_ms = excluded.updated_at_ms,
        fired_at_ms = coalesce(pos_check_items.fired_at_ms, excluded.fired_at_ms)
      where pos_check_items.location_id = ${ctx.locationId}
        and pos_check_items.check_id = ${checkId}
    `;
  }
}

async function upsertTicketRows(
  sql: Sql,
  ctx: EntityWriteContext,
  tickets: FloorTicket[],
  now: number,
): Promise<void> {
  for (const t of tickets) {
    assertTicketOperator(ctx, t.operatorId);
    await sql`
      insert into pos_tickets (
        id, location_id, check_id, order_number, table_label, server_name, server_id,
        station, operator_id, vendor_name, status, course, items, created_at_ms,
        started_at_ms, bumped_at_ms
      ) values (
        ${t.id},
        ${ctx.locationId},
        ${t.orderId},
        ${t.orderNumber},
        ${t.tableLabel},
        ${t.serverName},
        ${t.serverId ?? null},
        ${t.station},
        ${t.operatorId},
        ${t.vendorName},
        ${t.status},
        ${t.course},
        ${JSON.stringify(t.items ?? [])}::jsonb,
        ${t.createdAt || now},
        ${t.startedAt ?? null},
        ${t.bumpedAt ?? null}
      )
      on conflict (id) do update set
        table_label = excluded.table_label,
        server_name = excluded.server_name,
        server_id = excluded.server_id,
        station = excluded.station,
        operator_id = excluded.operator_id,
        vendor_name = excluded.vendor_name,
        status = case
          when pos_tickets.status = ${"bumped"} then ${"bumped"}
          when excluded.status = ${"new"} then pos_tickets.status
          when pos_tickets.status = ${"ready"} and excluded.status <> ${"bumped"} then ${"ready"}
          when pos_tickets.status = ${"in_progress"} and excluded.status = ${"new"} then ${"in_progress"}
          else excluded.status
        end,
        course = excluded.course,
        items = excluded.items,
        started_at_ms = coalesce(pos_tickets.started_at_ms, excluded.started_at_ms),
        ready_at_ms = coalesce(pos_tickets.ready_at_ms, excluded.ready_at_ms),
        bumped_at_ms = coalesce(pos_tickets.bumped_at_ms, excluded.bumped_at_ms)
      where pos_tickets.location_id = ${ctx.locationId}
    `;
  }
}

async function upsertTableRow(
  sql: Sql,
  ctx: EntityWriteContext,
  table: FloorTableStatus,
  now: number,
): Promise<void> {
  await sql`
    insert into pos_table_status (
      location_id, table_id, status, check_id, server_id, guest_count,
      seated_at_ms, status_since_ms, updated_at_ms
    ) values (
      ${ctx.locationId},
      ${table.tableId},
      ${table.status},
      ${table.checkId},
      ${table.serverId},
      ${table.guestCount},
      ${table.seatedAt},
      ${table.statusSince || now},
      ${now}
    )
    on conflict (location_id, table_id) do update set
      status = excluded.status,
      check_id = excluded.check_id,
      server_id = excluded.server_id,
      guest_count = excluded.guest_count,
      seated_at_ms = excluded.seated_at_ms,
      status_since_ms = excluded.status_since_ms,
      updated_at_ms = excluded.updated_at_ms
  `;
}

async function loadTicketOrThrow(
  sql: Sql,
  ctx: EntityWriteContext,
  ticketId: string,
): Promise<TicketRow> {
  const rows = await sql<TicketRow>`
    select * from pos_tickets
    where id = ${ticketId} and location_id = ${ctx.locationId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Ticket not found");
  assertTicketOperator(ctx, row.operator_id);
  return row;
}

async function setLineStatusForTicket(
  sql: Sql,
  ctx: EntityWriteContext,
  ticket: TicketRow,
  status: FloorLineStatus,
  now: number,
): Promise<void> {
  const started = status === "started" || status === "ready" || status === "delivered" ? now : null;
  const ready = status === "ready" || status === "delivered" ? now : null;
  const delivered = status === "delivered" ? now : null;
  await sql`
    update pos_check_items set
      item_status = ${status},
      sent = true,
      started_at_ms = coalesce(started_at_ms, ${started}),
      ready_at_ms = coalesce(ready_at_ms, ${ready}),
      delivered_at_ms = coalesce(delivered_at_ms, ${delivered}),
      updated_at_ms = ${now}
    where location_id = ${ctx.locationId}
      and (ticket_id = ${ticket.id} or (check_id = ${ticket.check_id} and station = ${ticket.station}))
  `;
}

export async function upsertCheck(
  userId: string,
  input: UpsertCheckInput,
): Promise<{ ok: true; checkId: string }> {
  const ctx = await loadFloorContext(userId, input.locationId);
  const sql = await getSql();
  const now = Date.now();
  const check: FloorCheck = {
    ...input.check,
    locationId: ctx.locationId,
    updatedAt: now,
    lines: input.check.lines ?? [],
    payments: input.check.payments ?? [],
    mergedTableIds: input.check.mergedTableIds ?? [],
  };
  for (const line of check.lines) assertLineOperator(ctx, line.operatorId);
  await upsertCheckRow(sql, ctx, check, input.clientMutationId ?? null, now);
  if (check.lines.length) await upsertLines(sql, ctx, check.id, check.lines, now);
  return { ok: true, checkId: check.id };
}

export async function addCheckLines(
  userId: string,
  input: AddLinesInput,
): Promise<{ ok: true }> {
  const ctx = await loadFloorContext(userId, input.locationId);
  const sql = await getSql();
  const now = Date.now();
  const existing = await sql<{ id: string }>`
    select id from pos_checks
    where id = ${input.checkId} and location_id = ${ctx.locationId}
    limit 1
  `;
  if (!existing[0]) throw new ForbiddenError("Check not found");
  await upsertLines(sql, ctx, input.checkId, input.lines, now);
  await sql`
    update pos_checks set updated_at_ms = ${now}
    where id = ${input.checkId} and location_id = ${ctx.locationId}
  `;
  return { ok: true };
}

export async function sendToStations(
  userId: string,
  input: SendToStationsInput,
): Promise<{ ok: true }> {
  const ctx = await loadFloorContext(userId, input.locationId);
  const sql = await getSql();
  const now = Date.now();
  const existing = await sql<{ id: string }>`
    select id from pos_checks
    where id = ${input.checkId} and location_id = ${ctx.locationId}
    limit 1
  `;
  if (!existing[0]) throw new ForbiddenError("Check not found");
  await upsertTicketRows(sql, ctx, input.tickets, now);
  for (const t of input.tickets) {
    const lineIds = t.items.map((i) => i.lineId);
    if (lineIds.length === 0) continue;
    for (const lineId of lineIds) {
      await sql`
        update pos_check_items set
          sent = true,
          held = false,
          item_status = case
            when item_status in (${"started"}, ${"ready"}, ${"delivered"}) then item_status
            else ${"sent"}
          end,
          ticket_id = coalesce(ticket_id, ${t.id}),
          fired_at_ms = coalesce(fired_at_ms, ${now}),
          updated_at_ms = ${now}
        where location_id = ${ctx.locationId}
          and check_id = ${input.checkId}
          and id = ${lineId}
      `;
    }
    await writeEvent(sql, {
      locationId: ctx.locationId,
      ticketId: t.id,
      checkId: input.checkId,
      kind: "send",
      actor: input.actor,
      operatorId: t.operatorId,
      at: now,
    });
  }
  if (input.table) await upsertTableRow(sql, ctx, input.table, now);
  await sql`
    update pos_checks set updated_at_ms = ${now}
    where id = ${input.checkId} and location_id = ${ctx.locationId}
  `;
  return { ok: true };
}

export async function odsStart(
  userId: string,
  input: OdsActionInput,
): Promise<{ ok: true; status: TicketStatus }> {
  const ctx = await loadFloorContext(userId, input.locationId);
  const sql = await getSql();
  const now = Date.now();
  const ticket = await loadTicketOrThrow(sql, ctx, input.ticketId);
  if (ticket.status === "bumped") return { ok: true, status: "bumped" };
  await sql`
    update pos_tickets set
      status = ${"in_progress"},
      started_at_ms = coalesce(started_at_ms, ${now})
    where id = ${ticket.id} and location_id = ${ctx.locationId}
  `;
  await setLineStatusForTicket(sql, ctx, ticket, "started", now);
  await writeEvent(sql, {
    locationId: ctx.locationId,
    ticketId: ticket.id,
    checkId: ticket.check_id,
    kind: "start",
    actor: input.actor,
    operatorId: ticket.operator_id,
    at: now,
  });
  return { ok: true, status: "in_progress" };
}

export async function odsReady(
  userId: string,
  input: OdsActionInput,
): Promise<{ ok: true; status: TicketStatus }> {
  const ctx = await loadFloorContext(userId, input.locationId);
  const sql = await getSql();
  const now = Date.now();
  const ticket = await loadTicketOrThrow(sql, ctx, input.ticketId);
  if (ticket.status === "bumped") return { ok: true, status: "bumped" };
  await sql`
    update pos_tickets set
      status = ${"ready"},
      started_at_ms = coalesce(started_at_ms, ${now}),
      ready_at_ms = coalesce(ready_at_ms, ${now})
    where id = ${ticket.id} and location_id = ${ctx.locationId}
  `;
  await setLineStatusForTicket(sql, ctx, ticket, "ready", now);
  await writeEvent(sql, {
    locationId: ctx.locationId,
    ticketId: ticket.id,
    checkId: ticket.check_id,
    kind: "ready",
    actor: input.actor,
    operatorId: ticket.operator_id,
    at: now,
  });
  return { ok: true, status: "ready" };
}

export async function odsBump(
  userId: string,
  input: OdsActionInput,
): Promise<{ ok: true; status: TicketStatus }> {
  const ctx = await loadFloorContext(userId, input.locationId);
  const sql = await getSql();
  const now = Date.now();
  const ticket = await loadTicketOrThrow(sql, ctx, input.ticketId);
  await sql`
    update pos_tickets set
      status = ${"bumped"},
      started_at_ms = coalesce(started_at_ms, ${now}),
      ready_at_ms = coalesce(ready_at_ms, ${now}),
      bumped_at_ms = coalesce(bumped_at_ms, ${now})
    where id = ${ticket.id} and location_id = ${ctx.locationId}
  `;
  await setLineStatusForTicket(sql, ctx, ticket, "delivered", now);
  await writeEvent(sql, {
    locationId: ctx.locationId,
    ticketId: ticket.id,
    checkId: ticket.check_id,
    kind: "bump",
    actor: input.actor,
    operatorId: ticket.operator_id,
    at: now,
  });
  return { ok: true, status: "bumped" };
}

export async function odsRecall(
  userId: string,
  input: OdsActionInput,
): Promise<{ ok: true; status: TicketStatus }> {
  const ctx = await loadFloorContext(userId, input.locationId);
  const sql = await getSql();
  const now = Date.now();
  const ticket = await loadTicketOrThrow(sql, ctx, input.ticketId);
  await sql`
    update pos_tickets set
      status = ${"new"},
      bumped_at_ms = null
    where id = ${ticket.id} and location_id = ${ctx.locationId}
  `;
  await sql`
    update pos_check_items set
      item_status = ${"sent"},
      delivered_at_ms = null,
      updated_at_ms = ${now}
    where location_id = ${ctx.locationId} and ticket_id = ${ticket.id}
  `;
  await writeEvent(sql, {
    locationId: ctx.locationId,
    ticketId: ticket.id,
    checkId: ticket.check_id,
    kind: "recall",
    actor: input.actor,
    operatorId: ticket.operator_id,
    at: now,
  });
  return { ok: true, status: "new" };
}

export async function recordPayment(
  userId: string,
  input: RecordPaymentInput,
): Promise<{ ok: true }> {
  const ctx = await loadFloorContext(userId, input.locationId);
  const sql = await getSql();
  const now = Date.now();
  const p = input.payment;
  const existing = await sql<{ id: string }>`
    select id from pos_checks
    where id = ${input.checkId} and location_id = ${ctx.locationId}
    limit 1
  `;
  if (!existing[0]) throw new ForbiddenError("Check not found");
  await sql`
    insert into pos_check_payments (
      id, check_id, location_id, method, amount_cents, tip_cents, tendered_cents,
      change_cents, last4, gift_card_code, house_account_id, employee_id,
      processor, charge_brand, sandbox, client_mutation_id, at_ms
    ) values (
      ${p.id},
      ${input.checkId},
      ${ctx.locationId},
      ${p.method},
      ${p.amountCents},
      ${p.tipCents},
      ${p.tenderedCents ?? null},
      ${p.changeCents ?? null},
      ${p.last4 ?? null},
      ${p.giftCardCode ?? null},
      ${p.houseAccountId ?? null},
      ${p.employeeId},
      ${p.processor ?? null},
      ${p.chargeBrand ?? null},
      ${Boolean(p.sandbox)},
      ${input.clientMutationId ?? null},
      ${p.at || now}
    )
    on conflict (id) do nothing
  `;
  const status = input.checkStatus ?? "open";
  const closedAt = status === "closed" ? (input.closedAt ?? now) : null;
  await sql`
    update pos_checks set
      status = ${status},
      closed_at_ms = ${closedAt},
      updated_at_ms = ${now}
    where id = ${input.checkId} and location_id = ${ctx.locationId}
  `;
  if (input.table) await upsertTableRow(sql, ctx, input.table, now);
  return { ok: true };
}

export async function upsertTableStatus(
  userId: string,
  input: UpsertTableStatusInput,
): Promise<{ ok: true }> {
  const ctx = await loadFloorContext(userId, input.locationId);
  const sql = await getSql();
  await upsertTableRow(sql, ctx, input.table, Date.now());
  return { ok: true };
}

export async function listOpenFloor(
  userId: string,
  locationId: string,
): Promise<OpenFloor> {
  const ctx = await loadFloorContext(userId, locationId);
  const sql = await getSql();
  const now = Date.now();
  const since = now - OPEN_WINDOW_MS;
  const scoped = vendorOperatorId(ctx);

  const packed = await loadOpenWindowRows(sql, ctx.locationId, since);
  const floorChecks = assembleChecks(packed.checks, packed.items, packed.payments, scoped);

  const tickets = await sql<TicketRow>`
    select * from pos_tickets
    where location_id = ${ctx.locationId}
      and (
        status <> ${"bumped"}
        or coalesce(bumped_at_ms, created_at_ms) >= ${now - BUMP_RECALL_MS}
      )
    order by created_at_ms desc
    limit 400
  `;
  const mappedTickets = tickets
    .filter((t) => !scoped || (t.operator_id || HOST_SCOPE) === scoped)
    .map((t) => mapTicket(t, now));

  const tables = await sql<TableRow>`
    select table_id, status, check_id, server_id, guest_count, seated_at_ms, status_since_ms
    from pos_table_status
    where location_id = ${ctx.locationId}
  `;
  const visibleCheckIds = new Set(floorChecks.map((c) => c.id));
  const mappedTables: FloorTableStatus[] = tables
    .filter((t) => !scoped || !t.check_id || visibleCheckIds.has(t.check_id))
    .map((t) => ({
      tableId: t.table_id,
      status: asTableStatus(t.status),
      checkId: t.check_id,
      serverId: t.server_id,
      guestCount: t.guest_count == null ? null : n(t.guest_count),
      seatedAt: t.seated_at_ms == null ? null : n(t.seated_at_ms),
      statusSince: n(t.status_since_ms, now),
    }));

  const events = await sql<{
    id: string;
    ticket_id: string;
    check_id: string;
    kind: string;
    actor_id: string | null;
    actor_name: string | null;
    at_ms: number | string;
    operator_id: string | null;
  }>`
    select id, ticket_id, check_id, kind, actor_id, actor_name, at_ms, operator_id
    from pos_ticket_events
    where location_id = ${ctx.locationId} and at_ms >= ${now - BUMP_RECALL_MS}
    order by at_ms desc
    limit 200
  `;
  const mappedEvents: FloorTicketEvent[] = events
    .filter((e) => !scoped || (e.operator_id || HOST_SCOPE) === scoped)
    .map((e) => ({
      id: e.id,
      ticketId: e.ticket_id,
      checkId: e.check_id,
      kind: e.kind,
      actorId: e.actor_id,
      actorName: e.actor_name,
      at: n(e.at_ms),
    }));

  return {
    locationId: ctx.locationId,
    checks: floorChecks,
    tickets: mappedTickets,
    tables: mappedTables,
    events: mappedEvents,
    serverTime: now,
    operatorScoped: Boolean(scoped),
  };
}

export async function listStationTickets(
  userId: string,
  locationId: string,
  station: TicketStation,
  operatorId?: string | null,
): Promise<{ locationId: string; station: TicketStation; tickets: FloorTicket[] }> {
  const ctx = await loadFloorContext(userId, locationId);
  const sql = await getSql();
  const now = Date.now();
  const st = asStation(station);
  const scoped = vendorOperatorId(ctx);
  const wantOp = scoped ?? (operatorId && operatorId !== HOST_SCOPE ? clip(operatorId, 80) : null);
  const tickets = await sql<TicketRow>`
    select * from pos_tickets
    where location_id = ${ctx.locationId}
      and station = ${st}
      and (
        status <> ${"bumped"}
        or coalesce(bumped_at_ms, created_at_ms) >= ${now - BUMP_RECALL_MS}
      )
    order by created_at_ms asc
    limit 300
  `;
  const mapped = tickets
    .filter((t) => !wantOp || (t.operator_id || HOST_SCOPE) === wantOp)
    .map((t) => mapTicket(t, now));
  return { locationId: ctx.locationId, station: st, tickets: mapped };
}

/** Offline outbox: apply a mutation payload idempotently. */
export async function applyFloorOutboxPayload(
  userId: string,
  kind: string,
  locationId: string,
  payload: Record<string, unknown>,
  clientMutationId: string,
): Promise<void> {
  const loc = clip(locationId, 80) || clip(payload.locationId, 80);
  if (!loc) throw new Error("locationId required");
  const actor: FloorActor | undefined =
    payload.actor && typeof payload.actor === "object"
      ? {
          employeeId: clip((payload.actor as FloorActor).employeeId, 80),
          employeeName: clip((payload.actor as FloorActor).employeeName, 80),
        }
      : payload.employeeId
        ? {
            employeeId: clip(payload.employeeId, 80),
            employeeName: clip(payload.employeeName, 80),
          }
        : undefined;

  if (kind === "order_upsert") {
    const check = payload.check as FloorCheck | undefined;
    if (check?.id) {
      await upsertCheck(userId, {
        locationId: loc,
        check,
        clientMutationId,
      });
      const tickets = Array.isArray(payload.tickets) ? (payload.tickets as FloorTicket[]) : [];
      if (tickets.length) {
        await sendToStations(userId, {
          locationId: loc,
          checkId: check.id,
          tickets,
          table: (payload.table as FloorTableStatus | undefined) ?? undefined,
          clientMutationId,
          actor,
        });
      }
      for (const payment of check.payments ?? []) {
        if (!payment?.id) continue;
        await recordPayment(userId, {
          locationId: loc,
          checkId: check.id,
          payment,
          checkStatus: check.status,
          closedAt: check.closedAt,
          table: (payload.table as FloorTableStatus | undefined) ?? undefined,
          clientMutationId: `${clientMutationId}:${payment.id}`,
        });
      }
    }
    return;
  }
  if (kind === "ticket_upsert") {
    const ticketId = clip(payload.ticketId, 80);
    const status = String(payload.status ?? "");
    if (!ticketId) return;
    if (status === "in_progress") {
      await odsStart(userId, { locationId: loc, ticketId, clientMutationId, actor });
    } else if (status === "ready") {
      await odsReady(userId, { locationId: loc, ticketId, clientMutationId, actor });
    } else if (status === "new") {
      await odsRecall(userId, { locationId: loc, ticketId, clientMutationId, actor });
    }
    return;
  }
  if (kind === "ticket_bump") {
    const ticketId = clip(payload.ticketId, 80);
    if (!ticketId) return;
    await odsBump(userId, { locationId: loc, ticketId, clientMutationId, actor });
    return;
  }
  if (kind === "table_seat") {
    const table = payload.table as FloorTableStatus | undefined;
    if (table?.tableId) {
      await upsertTableStatus(userId, { locationId: loc, table, clientMutationId });
      return;
    }
    const tableId = clip(payload.tableId, 80);
    if (!tableId) return;
    await upsertTableStatus(userId, {
      locationId: loc,
      table: {
        tableId,
        status: asTableStatus(payload.status ?? "sat_no_order"),
        checkId: payload.checkId ? clip(payload.checkId, 80) : payload.orderId ? clip(payload.orderId, 80) : null,
        serverId: payload.serverId ? clip(payload.serverId, 80) : null,
        guestCount: n(payload.guestCount, 1),
        seatedAt: n(payload.seatedAt, Date.now()),
        statusSince: n(payload.statusSince, Date.now()),
      },
      clientMutationId,
    });
  }
}
