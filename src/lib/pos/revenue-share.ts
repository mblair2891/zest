/**
 * Location revenue-share rules between selling entities.
 * A second journal. It does not change the guest check, tax on that check,
 * or the Quantum Payments card split (the card still follows who sold the item).
 */
import type { Employee, FloorSection, MenuItem, Order, OrderLine, RestaurantSettings, Table } from "./types";
import { lineCardCents, lineCashCents } from "./calculations";
import { cashPolicyFromSettings } from "./cash-discount";
import { computeTaxLines, lineTaxCategory, ratesForEntity } from "./tax-rates";
import { isHostPrivileged } from "@/lib/access/entity-grants";

/** From-party: whoever sold the line. */
export const ANY_SELLER = "*";

export type ShareBasis = "drinks" | "food" | "all_items" | "menu_groups" | "items";
export type ShareFlatPer = "none" | "check" | "cover";
export type ShareCapPer = "none" | "check" | "day";
export type ShareServiceStyle = "dine_in" | "to_go" | "kiosk" | "qr" | "bar_tab";
export type ShareTicketSource = "server" | "kiosk" | "qr";
export type RevenueShareTransferMode = "book_entry" | "finix_split" | "both";

export const SHARE_BASIS_LABEL: Record<ShareBasis, string> = {
  drinks: "Drink sales",
  food: "Food sales",
  all_items: "All item sales",
  menu_groups: "Selected menu groups",
  items: "Selected items",
};

export const SERVICE_STYLE_LABEL: Record<ShareServiceStyle, string> = {
  dine_in: "Dine-in",
  to_go: "To-go",
  kiosk: "Kiosk",
  qr: "QR",
  bar_tab: "Bar tab",
};

export const TICKET_SOURCE_LABEL: Record<ShareTicketSource, string> = {
  server: "Server",
  kiosk: "Kiosk",
  qr: "QR",
};

export const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type RevenueShareRule = {
  id: string;
  /** Lower number is considered first. */
  priority: number;
  /** When on, this rule can also pay a line an earlier rule already matched. */
  allowStack: boolean;
  fromEntityId: string;
  toEntityId: string;
  basis: ShareBasis;
  categoryIds: string[];
  itemIds: string[];
  includeTax: boolean;
  includeCcTips: boolean;
  includeCardMarkup: boolean;
  /** 0 is valid when a flat amount is set. */
  percent: number;
  flatCents: number;
  flatPer: ShareFlatPer;
  /** 0 means no cap. */
  capCents: number;
  capPer: ShareCapPer;
  /** Empty = every section. */
  sectionIds: string[];
  /** Empty = every table, stool, and cluster. */
  tableIds: string[];
  /** Empty = every service style. */
  serviceStyles: ShareServiceStyle[];
  /** 0 Sunday … 6 Saturday. Empty = every day. */
  daysOfWeek: number[];
  /** HH:mm in the venue clock. Empty = no start. */
  hoursStart: string;
  /** HH:mm. Empty = no end. End before start wraps past midnight. */
  hoursEnd: string;
  /** Empty = every ticket source. */
  ticketSources: ShareTicketSource[];
  effectiveOn: string;
  endsOn: string;
  payout: RevenueShareTransferMode;
};

export type RevenueShareConfig = {
  /** Legacy default for rules saved before per-rule tip toggle. */
  includeCcTips: boolean;
  /**
   * Receiving entity’s labor sales include share income.
   * The paying entity’s labor stays on its own item sales. Default off.
   */
  laborUsesShareIncome: boolean;
  /** Default payout instruction for rules. */
  transferMode: RevenueShareTransferMode;
  rules: RevenueShareRule[];
};

export type RevenueShareLine = {
  id: string;
  ruleId: string;
  checkId: string;
  checkNumber: string;
  lineId: string;
  fromEntityId: string;
  toEntityId: string;
  amountCents: number;
  /** Net base the percent used (after the rule’s toggles). */
  drinkNetCents: number;
  percent: number;
  basis: ShareBasis;
  day: string;
  payout: RevenueShareTransferMode;
  tableId: string;
  tableLabel: string;
  sectionId: string;
  sectionName: string;
  closedAt: number;
};

export type RevenueShareTransfer = {
  fromEntityId: string;
  toEntityId: string;
  amountCents: number;
  mode: RevenueShareTransferMode;
  finixReady: boolean;
  label: string;
};

export type EntitySharePnl = {
  entityId: string;
  drinkShareIncomeCents: number;
  drinkShareExpenseCents: number;
};

export type ShareRuleDay = {
  ruleId: string;
  day: string;
  fromEntityId: string;
  toEntityId: string;
  amountCents: number;
  lineCount: number;
};

export type RevenueShareSnapshot = {
  lines: RevenueShareLine[];
  transfers: RevenueShareTransfer[];
  byEntity: EntitySharePnl[];
  byRuleDay: ShareRuleDay[];
  includeCcTips: boolean;
  laborUsesShareIncome: boolean;
  transferMode: RevenueShareTransferMode;
};

export type ShareTableRef = {
  id: string;
  label?: string;
  section?: string;
  sectionId?: string;
};

export type ShareSectionRef = {
  id: string;
  name: string;
};

export const DEFAULT_REVENUE_SHARE: RevenueShareConfig = {
  includeCcTips: false,
  laborUsesShareIncome: false,
  transferMode: "book_entry",
  rules: [],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;
const BASES: ShareBasis[] = ["drinks", "food", "all_items", "menu_groups", "items"];
const FLATS: ShareFlatPer[] = ["none", "check", "cover"];
const CAPS: ShareCapPer[] = ["none", "check", "day"];
const STYLES: ShareServiceStyle[] = ["dine_in", "to_go", "kiosk", "qr", "bar_tab"];
const SOURCES: ShareTicketSource[] = ["server", "kiosk", "qr"];

export function transferInstruction(
  mode: RevenueShareTransferMode,
  bothMerchants = false,
): string {
  return payoutPlan(mode, bothMerchants).label;
}

export function payoutPlan(
  mode: RevenueShareTransferMode,
  bothMerchants: boolean,
): { bookEntry: boolean; finixTransfer: boolean; finixReady: boolean; label: string } {
  const wantFinix = mode === "finix_split" || mode === "both";
  const finix = wantFinix && bothMerchants;
  const book = mode === "book_entry" || mode === "both" || (wantFinix && !finix);
  const guest = "The guest check and the card split still follow who sold the item.";
  if (finix && book) {
    return {
      bookEntry: true,
      finixTransfer: true,
      finixReady: true,
      label: `Book entry and Finix internal transfer. Both merchants are on file. ${guest}`,
    };
  }
  if (finix) {
    return {
      bookEntry: false,
      finixTransfer: true,
      finixReady: true,
      label: `Finix internal transfer. Both merchants are on file. ${guest}`,
    };
  }
  if (wantFinix) {
    return {
      bookEntry: true,
      finixTransfer: false,
      finixReady: false,
      label: `Book entry. Finix internal transfer waits until both selling entities have a merchant. ${guest}`,
    };
  }
  return {
    bookEntry: true,
    finixTransfer: false,
    finixReady: false,
    label: `Book entry. Settle this amount offline between entities. ${guest}`,
  };
}

export function canEditRevenueShare(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
): boolean {
  return isHostPrivileged(emp);
}

/** Location admin sees every rule. A selling entity sees inbound and outbound rules. */
export function rulesVisibleToEntity(
  rules: RevenueShareRule[],
  entityId: string | null | undefined,
): RevenueShareRule[] {
  if (!entityId) return rules;
  return rules.filter(
    (r) => r.toEntityId === entityId || r.fromEntityId === entityId || r.fromEntityId === ANY_SELLER,
  );
}

export function ruleSummary(rule: RevenueShareRule, nameOf: (id: string) => string): string {
  const from = rule.fromEntityId === ANY_SELLER ? "Whoever sold the item" : nameOf(rule.fromEntityId);
  const rate = [
    rule.percent > 0 ? `${rule.percent}%` : "",
    rule.flatPer !== "none" && rule.flatCents > 0
      ? `${(rule.flatCents / 100).toFixed(2)} ${rule.flatPer === "cover" ? "per cover" : "per check"}`
      : "",
  ]
    .filter(Boolean)
    .join(" + ");
  const where = [
    rule.sectionIds.length ? `${rule.sectionIds.length} section(s)` : "",
    rule.tableIds.length ? `${rule.tableIds.length} table(s)` : "",
    rule.serviceStyles.length ? rule.serviceStyles.map((s) => SERVICE_STYLE_LABEL[s]).join(", ") : "",
    rule.hoursStart || rule.hoursEnd
      ? `${rule.hoursStart || "open"}–${rule.hoursEnd || "close"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `${rate || "No rate"} of ${SHARE_BASIS_LABEL[rule.basis].toLowerCase()} · ${from} → ${nameOf(rule.toEntityId)}${where ? ` · ${where}` : ""}`;
}

function idList(raw: unknown, max = 80): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const id = String(item ?? "").trim().slice(0, 80);
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

function oneOf<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  const s = String(raw ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function timeOrEmpty(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return TIME_RE.test(s) ? s : "";
}

function payoutOf(raw: unknown, fallback: RevenueShareTransferMode): RevenueShareTransferMode {
  if (raw === "finix_split" || raw === "both" || raw === "book_entry") return raw;
  return fallback;
}

function parseRule(raw: unknown, legacyTips: boolean, payout: RevenueShareTransferMode): RevenueShareRule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim().slice(0, 80);
  const fromEntityId = String(o.fromEntityId ?? "").trim().slice(0, 80);
  const toEntityId = String(o.toEntityId ?? "").trim().slice(0, 80);
  if (!id || !fromEntityId || !toEntityId) return null;
  const percent = Math.round(Number(o.percent) * 10) / 10;
  const legacyScope = o.scope === "sections" || o.scope === "tables" || o.scope === "venue" ? o.scope : "";
  let sectionIds = idList(o.sectionIds);
  let tableIds = idList(o.tableIds);
  if (legacyScope === "venue") {
    sectionIds = [];
    tableIds = [];
  } else if (legacyScope === "sections") {
    tableIds = [];
  } else if (legacyScope === "tables") {
    sectionIds = [];
  }
  const days = idList(o.daysOfWeek, 7)
    .map((d) => Number(d))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const basis = oneOf(o.basis, BASES, "drinks");
  return {
    id,
    priority: Number.isFinite(Number(o.priority)) ? Math.round(Number(o.priority)) : 100,
    allowStack: o.allowStack === true,
    fromEntityId,
    toEntityId,
    basis,
    categoryIds: basis === "menu_groups" ? idList(o.categoryIds) : [],
    itemIds: basis === "items" ? idList(o.itemIds) : [],
    includeTax: o.includeTax === true,
    includeCcTips: "includeCcTips" in o ? o.includeCcTips === true : legacyTips,
    includeCardMarkup: o.includeCardMarkup === true,
    percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0,
    flatCents: Math.max(0, Math.round(Number(o.flatCents) || 0)),
    flatPer: oneOf(o.flatPer, FLATS, "none"),
    capCents: Math.max(0, Math.round(Number(o.capCents) || 0)),
    capPer: oneOf(o.capPer, CAPS, "none"),
    sectionIds,
    tableIds,
    serviceStyles: idList(o.serviceStyles).filter((s): s is ShareServiceStyle =>
      (STYLES as string[]).includes(s),
    ),
    daysOfWeek: days,
    hoursStart: timeOrEmpty(o.hoursStart),
    hoursEnd: timeOrEmpty(o.hoursEnd),
    ticketSources: idList(o.ticketSources).filter((s): s is ShareTicketSource =>
      (SOURCES as string[]).includes(s),
    ),
    effectiveOn: String(o.effectiveOn ?? "").trim(),
    endsOn: DATE_RE.test(String(o.endsOn ?? "").trim()) ? String(o.endsOn).trim() : "",
    payout: payoutOf(o.payout, payout),
  };
}

export function parseRevenueShare(raw: unknown): RevenueShareConfig {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const transferMode = payoutOf(o.transferMode, "book_entry");
  const legacyTips = o.includeCcTips === true;
  const rules: RevenueShareRule[] = [];
  if (Array.isArray(o.rules)) {
    for (const item of o.rules) {
      const rule = parseRule(item, legacyTips, transferMode);
      if (rule) rules.push(rule);
      if (rules.length >= 80) break;
    }
  }
  return {
    includeCcTips: legacyTips,
    laborUsesShareIncome: o.laborUsesShareIncome === true,
    transferMode,
    rules,
  };
}

export function validateRevenueShareRules(
  rules: RevenueShareRule[],
  _tables: ShareTableRef[] = [],
  _sections: ShareSectionRef[] = [],
): { ok: true } | { ok: false; error: string } {
  const parsed = rules.map((r) => parseRule(r, false, r.payout || "book_entry")).filter((r) => r != null);
  if (parsed.length !== rules.length) {
    return { ok: false, error: "Each rule needs an id, a from entity, and a to entity." };
  }
  for (const rule of parsed) {
    if (rule.fromEntityId === rule.toEntityId) {
      return { ok: false, error: "From and to must be different entities." };
    }
    if (rule.percent < 0 || rule.percent > 100) {
      return { ok: false, error: "Percent must be from 0 through 100." };
    }
    if (rule.percent === 0 && (rule.flatPer === "none" || rule.flatCents <= 0)) {
      return { ok: false, error: "Set a percent, a flat per check, or a flat per cover." };
    }
    if (!DATE_RE.test(rule.effectiveOn)) {
      return { ok: false, error: "Each rule needs an effective date." };
    }
    if (rule.endsOn && rule.endsOn < rule.effectiveOn) {
      return { ok: false, error: "End date is before the effective date." };
    }
    if (rule.basis === "menu_groups" && rule.categoryIds.length === 0) {
      return { ok: false, error: "Pick at least one menu group." };
    }
    if (rule.basis === "items" && rule.itemIds.length === 0) {
      return { ok: false, error: "Pick at least one item." };
    }
    if ((rule.hoursStart && !TIME_RE.test(rule.hoursStart)) || (rule.hoursEnd && !TIME_RE.test(rule.hoursEnd))) {
      return { ok: false, error: "Hours use 24-hour HH:mm." };
    }
  }
  return { ok: true };
}

export function venueYmd(ts: number, timeZone?: string): string {
  const zone = timeZone && timeZone.trim() ? timeZone.trim() : "UTC";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

function venueParts(ts: number, timeZone?: string): { minutes: number; weekday: number } {
  const zone = timeZone && timeZone.trim() ? timeZone.trim() : "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    }).formatToParts(new Date(ts));
    const bag: Record<string, string> = {};
    for (const p of parts) bag[p.type] = p.value;
    let hour = Number(bag.hour);
    if (hour === 24) hour = 0;
    const minute = Number(bag.minute);
    const weekday = WEEKDAY_LABEL.indexOf((bag.weekday ?? "Sun") as (typeof WEEKDAY_LABEL)[number]);
    return {
      minutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
      weekday: weekday >= 0 ? weekday : 0,
    };
  } catch {
    const d = new Date(ts);
    return { minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), weekday: d.getUTCDay() };
  }
}

function hmToMin(hm: string): number | null {
  const m = TIME_RE.exec(hm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function inHours(nowMin: number, start: string, end: string): boolean {
  const a = start ? hmToMin(start) : null;
  const b = end ? hmToMin(end) : null;
  if (a == null && b == null) return true;
  if (a != null && b == null) return nowMin >= a;
  if (a == null && b != null) return nowMin <= b;
  if (a! <= b!) return nowMin >= a! && nowMin <= b!;
  return nowMin >= a! || nowMin <= b!;
}

function sellingEntityId(line: OrderLine): string {
  return String(line.entityId || line.vendorId || "").trim();
}

export function isDrinkLine(line: OrderLine, menuItems?: MenuItem[]): boolean {
  if (line.voided) return false;
  if (line.course === "drink") return true;
  if (line.taxCategory === "bev") return true;
  const item = menuItems?.find((m) => m.id === line.menuItemId);
  if (item?.course === "drink" || item?.taxCategory === "bev") return true;
  return line.station === "bar" && (line.course === "other" || !line.course);
}

export function isFoodLine(line: OrderLine, menuItems?: MenuItem[]): boolean {
  if (line.voided || isDrinkLine(line, menuItems)) return false;
  if (line.taxCategory === "retail" || line.taxCategory === "gift" || line.taxCategory === "service") {
    return false;
  }
  const item = menuItems?.find((m) => m.id === line.menuItemId);
  if (item?.taxCategory === "retail" || item?.taxCategory === "gift" || item?.taxCategory === "service") {
    return false;
  }
  return true;
}

function serviceStyleOf(order: Order): ShareServiceStyle {
  if (order.guestChannel === "table_qr") return "qr";
  if (order.type === "kiosk" || order.guestChannel === "kiosk") return "kiosk";
  if (order.type === "bar_tab") return "bar_tab";
  if (order.type === "takeout" || order.type === "delivery" || order.type === "online") return "to_go";
  return "dine_in";
}

function ticketSourceOf(order: Order): ShareTicketSource {
  if (order.guestChannel === "table_qr") return "qr";
  if (order.type === "kiosk" || order.guestChannel === "kiosk") return "kiosk";
  return "server";
}

type Place = {
  tableId: string;
  tableLabel: string;
  sectionId: string;
  sectionName: string;
  tableIds: string[];
  sectionKeys: string[];
};

function sectionKeysForTable(table: ShareTableRef, sections: ShareSectionRef[]): string[] {
  const keys = new Set<string>();
  if (table.sectionId) keys.add(table.sectionId);
  if (table.section) keys.add(table.section);
  const hit = sections.find((s) => s.id === table.sectionId || s.name === table.section);
  if (hit) {
    keys.add(hit.id);
    if (hit.name) keys.add(hit.name);
  }
  return [...keys];
}

function placeOf(order: Order, tables: ShareTableRef[], sections: ShareSectionRef[]): Place {
  const ids = [order.tableId, ...(order.mergedTableIds ?? [])].filter((id): id is string => Boolean(id));
  const found = ids
    .map((id) => tables.find((t) => t.id === id))
    .filter((t): t is ShareTableRef => Boolean(t));
  const primary = found[0];
  const sectionKeys = new Set<string>();
  for (const table of found) {
    for (const key of sectionKeysForTable(table, sections)) sectionKeys.add(key);
  }
  if (!primary) {
    return {
      tableId: "",
      tableLabel: order.tabName?.trim() || (order.type === "bar_tab" ? "Bar tab" : "No table"),
      sectionId: "",
      sectionName: "",
      tableIds: ids,
      sectionKeys: [...sectionKeys],
    };
  }
  const keys = sectionKeysForTable(primary, sections);
  const section = sections.find((s) => keys.includes(s.id) || keys.includes(s.name));
  return {
    tableId: primary.id,
    tableLabel: primary.label?.trim() || primary.id,
    sectionId: section?.id || primary.sectionId || "",
    sectionName: section?.name || primary.section || "",
    tableIds: ids,
    sectionKeys: [...sectionKeys],
  };
}

function basisMatches(rule: RevenueShareRule, line: OrderLine, menuItems?: MenuItem[]): boolean {
  if (rule.basis === "drinks") return isDrinkLine(line, menuItems);
  if (rule.basis === "food") return isFoodLine(line, menuItems);
  if (rule.basis === "all_items") return !line.voided;
  if (rule.basis === "items") return rule.itemIds.includes(line.menuItemId);
  const item = menuItems?.find((m) => m.id === line.menuItemId);
  const cat = item?.categoryId || "";
  return Boolean(cat) && rule.categoryIds.includes(cat);
}

function scopeMatches(rule: RevenueShareRule, order: Order, place: Place, at: number, timeZone?: string): boolean {
  if (rule.sectionIds.length && !rule.sectionIds.some((id) => place.sectionKeys.includes(id))) return false;
  if (rule.tableIds.length && !rule.tableIds.some((id) => place.tableIds.includes(id))) return false;
  if (rule.serviceStyles.length && !rule.serviceStyles.includes(serviceStyleOf(order))) return false;
  if (rule.ticketSources.length && !rule.ticketSources.includes(ticketSourceOf(order))) return false;
  const clock = venueParts(at, timeZone);
  if (rule.daysOfWeek.length && !rule.daysOfWeek.includes(clock.weekday)) return false;
  if (!inHours(clock.minutes, rule.hoursStart, rule.hoursEnd)) return false;
  return true;
}

function ruleMatches(
  rule: RevenueShareRule,
  order: Order,
  line: OrderLine,
  place: Place,
  ymd: string,
  at: number,
  menuItems: MenuItem[] | undefined,
  timeZone: string | undefined,
): boolean {
  const seller = sellingEntityId(line);
  if (!seller) return false;
  if (rule.fromEntityId === ANY_SELLER) {
    if (seller === rule.toEntityId) return false;
  } else if (rule.fromEntityId !== seller) {
    return false;
  }
  if (!DATE_RE.test(rule.effectiveOn) || ymd < rule.effectiveOn) return false;
  if (rule.endsOn && ymd > rule.endsOn) return false;
  if (!basisMatches(rule, line, menuItems)) return false;
  return scopeMatches(rule, order, place, at, timeZone);
}

function cardTipByLine(order: Order): Map<string, number> {
  const map = new Map<string, number>();
  const tip = (order.payments ?? [])
    .filter((p) => p.method === "card" || p.method === "room_charge")
    .reduce((s, p) => s + (p.tipCents || 0), 0);
  if (tip <= 0) return map;
  const lines = (order.lines ?? []).filter((l) => !l.voided && !l.comped && lineCashCents(l) > 0);
  const total = lines.reduce((s, l) => s + lineCashCents(l), 0);
  if (total <= 0) return map;
  let used = 0;
  lines.forEach((line, i) => {
    const merch = lineCashCents(line);
    const share = i === lines.length - 1 ? tip - used : Math.round((tip * merch) / total);
    used += share;
    map.set(line.id, Math.max(0, share));
  });
  return map;
}

function lineBaseCents(
  line: OrderLine,
  rule: RevenueShareRule,
  order: Order,
  settings: RestaurantSettings | undefined,
  tips: Map<string, number>,
): number {
  if (line.voided || line.comped) return 0;
  const policy = rule.includeCardMarkup && settings ? cashPolicyFromSettings(settings) : null;
  let base = policy ? lineCardCents(line, policy) : lineCashCents(line);
  if (rule.includeTax && settings && base > 0) {
    const rates = ratesForEntity(settings, sellingEntityId(line) || null);
    const cat = lineTaxCategory(line);
    base += computeTaxLines({ [cat]: base }, rates).addOnCents;
  }
  if (rule.includeCcTips) base += tips.get(line.id) ?? 0;
  return Math.max(0, base);
}

type Draft = {
  rule: RevenueShareRule;
  order: Order;
  line: OrderLine;
  place: Place;
  seller: string;
  base: number;
  amount: number;
  at: number;
  day: string;
};

function clampGroup(rows: Draft[], cap: number): void {
  if (cap <= 0) return;
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  let over = sum - cap;
  if (over <= 0) return;
  for (let i = rows.length - 1; i >= 0 && over > 0; i--) {
    const row = rows[i]!;
    const cut = Math.min(row.amount, over);
    row.amount -= cut;
    over -= cut;
  }
}

export function shareLinesForOrders(opts: {
  orders: Order[];
  config: RevenueShareConfig | null | undefined;
  tables?: Array<ShareTableRef | Table>;
  sections?: Array<ShareSectionRef | FloorSection>;
  menuItems?: MenuItem[];
  settings?: RestaurantSettings;
  from?: number;
  to?: number;
  toInclusive?: boolean;
  timeZone?: string;
  merchants?: Record<string, boolean>;
}): RevenueShareLine[] {
  const config = parseRevenueShare(opts.config);
  if (!config.rules.length) return [];
  const tables = (opts.tables ?? []) as ShareTableRef[];
  const sections = (opts.sections ?? []) as ShareSectionRef[];
  const ordered = [...config.rules].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const orders = [...opts.orders].sort(
    (a, b) => (a.closedAt ?? a.createdAt) - (b.closedAt ?? b.createdAt) || String(a.id).localeCompare(String(b.id)),
  );
  const drafts: Draft[] = [];
  for (const order of orders) {
    if (order.status !== "closed") continue;
    const at = order.closedAt ?? order.createdAt;
    if (opts.from != null && at < opts.from) continue;
    if (opts.to != null && (opts.toInclusive ? at > opts.to : at >= opts.to)) continue;
    const ymd = venueYmd(at, opts.timeZone);
    const place = placeOf(order, tables, sections);
    const tips = cardTipByLine(order);
    const matched: Draft[] = [];
    for (const line of order.lines ?? []) {
      let claimed = false;
      for (const rule of ordered) {
        if (!ruleMatches(rule, order, line, place, ymd, at, opts.menuItems, opts.timeZone)) continue;
        if (claimed && !rule.allowStack) continue;
        const base = lineBaseCents(line, rule, order, opts.settings, tips);
        if (base <= 0 && rule.flatPer === "none") continue;
        const percentAmount = base > 0 && rule.percent > 0 ? Math.round((base * rule.percent) / 100) : 0;
        matched.push({
          rule,
          order,
          line,
          place,
          seller: sellingEntityId(line),
          base,
          amount: percentAmount,
          at,
          day: ymd,
        });
        claimed = true;
      }
    }
    const byRule = new Map<string, Draft[]>();
    for (const row of matched) {
      const list = byRule.get(row.rule.id) ?? [];
      list.push(row);
      byRule.set(row.rule.id, list);
    }
    for (const rows of byRule.values()) {
      const rule = rows[0]!.rule;
      if (rule.flatPer !== "none" && rule.flatCents > 0 && rows.length) {
        const flat = rule.flatPer === "cover" ? rule.flatCents * Math.max(1, order.guestCount || 1) : rule.flatCents;
        rows[0]!.amount += flat;
      }
      if (rule.capPer === "check" && rule.capCents > 0) clampGroup(rows, rule.capCents);
      drafts.push(...rows);
    }
  }
  const dayUsed = new Map<string, number>();
  for (const row of drafts) {
    if (row.rule.capPer === "day" && row.rule.capCents > 0) {
      const key = `${row.rule.id}:${row.day}`;
      const used = dayUsed.get(key) ?? 0;
      const room = Math.max(0, row.rule.capCents - used);
      row.amount = Math.min(row.amount, room);
      dayUsed.set(key, used + row.amount);
    }
  }
  const out: RevenueShareLine[] = [];
  for (const row of drafts) {
    if (row.amount <= 0) continue;
    out.push({
      id: `rs_${row.order.id}_${row.line.id}_${row.rule.id}`,
      ruleId: row.rule.id,
      checkId: row.order.id,
      checkNumber: String(row.order.number ?? ""),
      lineId: row.line.id,
      fromEntityId: row.seller,
      toEntityId: row.rule.toEntityId,
      amountCents: row.amount,
      drinkNetCents: row.base,
      percent: row.rule.percent,
      basis: row.rule.basis,
      day: row.day,
      payout: row.rule.payout,
      tableId: row.place.tableId,
      tableLabel: row.place.tableLabel,
      sectionId: row.place.sectionId,
      sectionName: row.place.sectionName,
      closedAt: row.at,
    });
  }
  return out;
}

export function shareTransfers(
  lines: RevenueShareLine[],
  mode: RevenueShareTransferMode,
  merchants: Record<string, boolean> = {},
): RevenueShareTransfer[] {
  const map = new Map<string, RevenueShareTransfer>();
  for (const line of lines) {
    const payout = line.payout || mode;
    const ready = Boolean(merchants[line.fromEntityId] && merchants[line.toEntityId]);
    const plan = payoutPlan(payout, ready);
    const key = `${line.fromEntityId}\u2192${line.toEntityId}:${payout}:${plan.finixReady}`;
    const cur = map.get(key) ?? {
      fromEntityId: line.fromEntityId,
      toEntityId: line.toEntityId,
      amountCents: 0,
      mode: payout,
      finixReady: plan.finixReady,
      label: plan.label,
    };
    cur.amountCents += line.amountCents;
    map.set(key, cur);
  }
  return [...map.values()];
}

export function shareByEntity(lines: RevenueShareLine[], entityIds: string[]): EntitySharePnl[] {
  const ids = [...entityIds];
  for (const line of lines) {
    if (!ids.includes(line.fromEntityId)) ids.push(line.fromEntityId);
    if (!ids.includes(line.toEntityId)) ids.push(line.toEntityId);
  }
  return ids.map((entityId) => ({
    entityId,
    drinkShareIncomeCents: lines
      .filter((l) => l.toEntityId === entityId)
      .reduce((s, l) => s + l.amountCents, 0),
    drinkShareExpenseCents: lines
      .filter((l) => l.fromEntityId === entityId)
      .reduce((s, l) => s + l.amountCents, 0),
  }));
}

export function shareByRuleDay(lines: RevenueShareLine[]): ShareRuleDay[] {
  const map = new Map<string, ShareRuleDay>();
  for (const line of lines) {
    const key = `${line.ruleId}|${line.day}|${line.fromEntityId}|${line.toEntityId}`;
    const cur = map.get(key) ?? {
      ruleId: line.ruleId,
      day: line.day,
      fromEntityId: line.fromEntityId,
      toEntityId: line.toEntityId,
      amountCents: 0,
      lineCount: 0,
    };
    cur.amountCents += line.amountCents;
    cur.lineCount += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort(
    (a, b) => a.day.localeCompare(b.day) || a.ruleId.localeCompare(b.ruleId),
  );
}

export function revenueShareSnapshot(opts: {
  orders: Order[];
  config: RevenueShareConfig | null | undefined;
  tables?: Array<ShareTableRef | Table>;
  sections?: Array<ShareSectionRef | FloorSection>;
  menuItems?: MenuItem[];
  settings?: RestaurantSettings;
  entityIds?: string[];
  from?: number;
  to?: number;
  toInclusive?: boolean;
  timeZone?: string;
  merchants?: Record<string, boolean>;
}): RevenueShareSnapshot {
  const config = parseRevenueShare(opts.config);
  const lines = shareLinesForOrders({ ...opts, config });
  return {
    lines,
    transfers: shareTransfers(lines, config.transferMode, opts.merchants),
    byEntity: shareByEntity(lines, opts.entityIds ?? []),
    byRuleDay: shareByRuleDay(lines),
    includeCcTips: config.includeCcTips,
    laborUsesShareIncome: config.laborUsesShareIncome,
    transferMode: config.transferMode,
  };
}

/** Receiving entity only. The paying entity’s own item sales stay put. */
export function laborSalesIncludingShare(opts: {
  ownSalesCents: number;
  entityId: string;
  lines: RevenueShareLine[];
  laborUsesShareIncome: boolean;
}): number {
  if (!opts.laborUsesShareIncome) return opts.ownSalesCents;
  const income = opts.lines
    .filter((l) => l.toEntityId === opts.entityId)
    .reduce((s, l) => s + l.amountCents, 0);
  return opts.ownSalesCents + income;
}
