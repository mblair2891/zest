/**
 * Entity-owner password login: header, today’s numbers, menu groups, bulk shifts.
 * Client-safe. No @/ value imports so node:test can load this file.
 */

export type EntityOwnerLine = {
  entityId?: string | null;
  vendorId?: string | null;
  name?: string;
  menuItemId?: string;
  quantity?: number;
  unitPriceCents?: number;
  discountCents?: number;
  voided?: boolean;
  comped?: boolean;
  createdAt?: number;
};

export type EntityOwnerOrder = {
  status?: string;
  createdAt: number;
  lines: EntityOwnerLine[];
};

export type EntityOwnerPunch = {
  operatorId?: string | null;
  clockInAt: number;
  clockOutAt?: number | null;
  status?: string;
};

export type EntityOwnerItem = {
  name: string;
  vendorId?: string | null;
  entityId?: string | null;
  available?: boolean;
  archived?: boolean;
};

export type EntityTodayInput = {
  entityId: string;
  dayYmd: string;
  todayYmd: string;
  timeZone: string;
  orders: EntityOwnerOrder[];
  punches: EntityOwnerPunch[];
  wageCentsPerHour: number;
  items: EntityOwnerItem[];
};

export type EntityTopItem = { name: string; cents: number; qty: number };

export type EntityTodaySnapshot = {
  hourlyCents: number[];
  salesCents: number;
  openChecks: number;
  laborCents: number;
  laborMinutes: number;
  laborPct: number | null;
  topItems: EntityTopItem[];
  eightySixCount: number;
};

export function entityLoginHeader(entityName: string, venueName: string): string {
  const entity = entityName.trim();
  const venue = venueName.trim();
  if (entity && venue) return `${entity} · ${venue}`;
  return entity || venue;
}

export function lineEntityId(line: { entityId?: string | null; vendorId?: string | null }): string {
  return String(line.entityId || line.vendorId || "").trim();
}

/** Non-void, non-comp merchandise. Comps and voids are zero. */
export function lineNetCents(line: EntityOwnerLine): number {
  if (line.voided || line.comped) return 0;
  const qty = Number(line.quantity) || 0;
  const unit = Number(line.unitPriceCents) || 0;
  const discount = Number(line.discountCents) || 0;
  return Math.max(0, unit * qty - discount);
}

export function venueYmd(atMs: number, timeZone: string): string {
  const tz = timeZone?.trim() || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(atMs));
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const mo = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${mo}-${d}`;
  } catch {
    return new Date(atMs).toISOString().slice(0, 10);
  }
}

export function venueHour(atMs: number, timeZone: string): number {
  const tz = timeZone?.trim() || "UTC";
  if (tz === "UTC" || tz === "Etc/UTC") return new Date(atMs).getUTCHours();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(atMs));
    const raw = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    if (!Number.isFinite(raw) || raw === 24) return 0;
    return Math.min(23, Math.max(0, raw));
  } catch {
    return new Date(atMs).getUTCHours();
  }
}

export function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export function venueDayBounds(ymd: string, timeZone: string): { start: number; end: number } {
  const tz = timeZone?.trim() || "UTC";
  if (tz === "UTC" || tz === "Etc/UTC") {
    const start = Date.parse(`${ymd}T00:00:00.000Z`);
    return { start, end: start + 86_400_000 };
  }
  const guess = Date.parse(`${ymd}T12:00:00.000Z`);
  let found = -1;
  for (let t = guess - 36 * 3_600_000; t < guess + 36 * 3_600_000; t += 60_000) {
    if (venueYmd(t, tz) === ymd) {
      found = t;
      break;
    }
  }
  if (found < 0) {
    const start = Date.parse(`${ymd}T00:00:00.000Z`);
    return { start, end: start + 86_400_000 };
  }
  let start = found;
  while (start > found - 120_000 && venueYmd(start - 1000, tz) === ymd) start -= 1000;
  let end = start;
  const cap = start + 40 * 3_600_000;
  while (end < cap && venueYmd(end, tz) === ymd) end += 60_000;
  while (end > start && venueYmd(end, tz) !== ymd) end -= 1000;
  return { start, end: end + 1000 };
}

function orderTouchesEntity(order: EntityOwnerOrder, entityId: string): boolean {
  return order.lines.some((line) => !line.voided && lineEntityId(line) === entityId);
}

export function entityToday(input: EntityTodayInput): EntityTodaySnapshot {
  const entityId = input.entityId.trim();
  const tz = input.timeZone?.trim() || "UTC";
  const hourlyCents = Array.from({ length: 24 }, () => 0);
  const byItem = new Map<string, EntityTopItem>();
  let salesCents = 0;

  for (const order of input.orders) {
    for (const line of order.lines) {
      if (lineEntityId(line) !== entityId) continue;
      if (line.voided) continue;
      const cents = lineNetCents(line);
      const at = line.createdAt && line.createdAt > 0 ? line.createdAt : order.createdAt;
      if (venueYmd(at, tz) !== input.dayYmd) continue;
      salesCents += cents;
      const hour = venueHour(at, tz);
      hourlyCents[hour] = (hourlyCents[hour] ?? 0) + cents;
      if (cents <= 0) continue;
      const key = (line.menuItemId || line.name || "Item").trim() || "Item";
      const name = (line.name || "Item").trim() || "Item";
      const prev = byItem.get(key) ?? { name, cents: 0, qty: 0 };
      prev.cents += cents;
      prev.qty += Number(line.quantity) || 0;
      byItem.set(key, prev);
    }
  }

  const today = input.dayYmd === input.todayYmd;
  const openChecks = input.orders.filter((order) => {
    if (order.status !== "open") return false;
    if (!orderTouchesEntity(order, entityId)) return false;
    if (today) return true;
    return venueYmd(order.createdAt, tz) === input.dayYmd;
  }).length;

  const bounds = venueDayBounds(input.dayYmd, tz);
  let laborMinutes = 0;
  for (const punch of input.punches) {
    if (String(punch.operatorId || "").trim() !== entityId) continue;
    if (punch.status === "rejected") continue;
    const out = punch.clockOutAt && punch.clockOutAt > punch.clockInAt ? punch.clockOutAt : bounds.end;
    const a = Math.max(punch.clockInAt, bounds.start);
    const b = Math.min(out, bounds.end);
    if (b > a) laborMinutes += Math.round((b - a) / 60_000);
  }
  const wage = Math.max(0, input.wageCentsPerHour || 0);
  const laborCents = Math.round((laborMinutes * wage) / 60);
  const laborPct =
    laborMinutes === 0 && wage <= 0
      ? null
      : salesCents > 0
        ? laborCents / salesCents
        : null;

  const topItems = [...byItem.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name)).slice(0, 5);
  const eightySixCount = input.items.filter((item) => {
    if (lineEntityId(item) !== entityId) return false;
    if (item.archived) return false;
    return item.available === false;
  }).length;

  return {
    hourlyCents,
    salesCents,
    openChecks,
    laborCents,
    laborMinutes,
    laborPct,
    topItems,
    eightySixCount,
  };
}

export type MenuGroup<T> = { id: string; name: string; items: T[] };

export function menuGroups<T extends { categoryId?: string; archived?: boolean }>(
  items: T[],
  categories: Array<{ id: string; name: string; sort?: number }>,
  opts: { archived: boolean; categoryId?: string | null },
): MenuGroup<T>[] {
  const wantArchived = opts.archived;
  const filterId = opts.categoryId && opts.categoryId !== "all" ? opts.categoryId : null;
  return [...categories]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name))
    .filter((cat) => !filterId || cat.id === filterId)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      items: items.filter(
        (item) => item.categoryId === cat.id && (wantArchived ? Boolean(item.archived) : !item.archived),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export type BulkShiftDraft = {
  employeeId: string;
  operatorId: string;
  start: number;
  end: number;
  published: false;
  role: string;
};

function parseHm(hm: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** One unpublished shift per person per selected local midnight. End at or before start becomes start + 8h. */
export function bulkShiftDrafts(input: {
  employeeIds: string[];
  dayStarts: number[];
  startHm: string;
  endHm: string;
  role: string;
  operatorId: string;
}): BulkShiftDraft[] {
  const startHm = parseHm(input.startHm) ?? { h: 11, m: 0 };
  const endHm = parseHm(input.endHm) ?? { h: 19, m: 0 };
  const out: BulkShiftDraft[] = [];
  for (const employeeId of input.employeeIds) {
    const id = employeeId.trim();
    if (!id) continue;
    for (const day of input.dayStarts) {
      if (!Number.isFinite(day)) continue;
      const startAt = new Date(day);
      startAt.setHours(startHm.h, startHm.m, 0, 0);
      const endAt = new Date(day);
      endAt.setHours(endHm.h, endHm.m, 0, 0);
      const start = startAt.getTime();
      let end = endAt.getTime();
      if (end <= start) end = start + 8 * 3_600_000;
      out.push({
        employeeId: id,
        operatorId: input.operatorId,
        start,
        end,
        published: false,
        role: input.role,
      });
    }
  }
  return out;
}
