/**
 * Peer / hosted drink revenue share.
 * A second journal between selling entities. It does not change the guest
 * check, tax, or the Quantum Payments card split (that still follows who sold
 * the item).
 */
import type { Employee, FloorSection, MenuItem, Order, OrderLine, Table } from "./types";
import { lineCashCents } from "./calculations";
import { isHostPrivileged } from "@/lib/access/entity-grants";

export type RevenueShareScope = "venue" | "sections" | "tables";
export type RevenueShareTransferMode = "finix_split" | "book_entry";

export type RevenueShareRule = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  /** Percent of drink net. One decimal, greater than 0 through 100. */
  percent: number;
  scope: RevenueShareScope;
  sectionIds: string[];
  tableIds: string[];
  /** Inclusive start, YYYY-MM-DD in the venue calendar. */
  effectiveOn: string;
  /** Inclusive end. Empty means open-ended. */
  endsOn: string;
};

export type RevenueShareConfig = {
  /** Card tips join drink net, allocated by merchandise. Default off. */
  includeCcTips: boolean;
  /**
   * Receiving entity’s labor sales include drink-share income.
   * The paying entity’s labor stays on its own item sales. Default off.
   */
  laborUsesShareIncome: boolean;
  /** Instruction only. Does not move the guest card. */
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
  drinkNetCents: number;
  percent: number;
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
  label: string;
};

export type EntitySharePnl = {
  entityId: string;
  drinkShareIncomeCents: number;
  drinkShareExpenseCents: number;
};

export type RevenueShareSnapshot = {
  lines: RevenueShareLine[];
  transfers: RevenueShareTransfer[];
  byEntity: EntitySharePnl[];
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

export function transferInstruction(mode: RevenueShareTransferMode): string {
  if (mode === "finix_split") {
    return "Finix split instruction — a second journal between entities. The guest card still follows who sold the item.";
  }
  return "Book entry — settle this amount offline between entities. The guest card still follows who sold the item.";
}

export function canEditRevenueShare(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
): boolean {
  return isHostPrivileged(emp);
}

/** Location admin sees every rule. A selling entity sees rules that pay them or that they pay. */
export function rulesVisibleToEntity(
  rules: RevenueShareRule[],
  entityId: string | null | undefined,
): RevenueShareRule[] {
  if (!entityId) return rules;
  return rules.filter((r) => r.toEntityId === entityId || r.fromEntityId === entityId);
}

function idList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const id = String(item ?? "").trim().slice(0, 80);
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= 80) break;
  }
  return out;
}

function parseRule(raw: unknown): RevenueShareRule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim().slice(0, 80);
  const fromEntityId = String(o.fromEntityId ?? "").trim().slice(0, 80);
  const toEntityId = String(o.toEntityId ?? "").trim().slice(0, 80);
  const percent = Math.round(Number(o.percent) * 10) / 10;
  const scope: RevenueShareScope =
    o.scope === "sections" || o.scope === "tables" || o.scope === "venue" ? o.scope : "venue";
  const effectiveOn = String(o.effectiveOn ?? "").trim();
  const endsOn = String(o.endsOn ?? "").trim();
  if (!id || !fromEntityId || !toEntityId) return null;
  if (!Number.isFinite(percent)) return null;
  return {
    id,
    fromEntityId,
    toEntityId,
    percent,
    scope,
    sectionIds: scope === "sections" ? idList(o.sectionIds) : [],
    tableIds: scope === "tables" ? idList(o.tableIds) : [],
    effectiveOn,
    endsOn: DATE_RE.test(endsOn) ? endsOn : "",
  };
}

export function parseRevenueShare(raw: unknown): RevenueShareConfig {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rules: RevenueShareRule[] = [];
  if (Array.isArray(o.rules)) {
    for (const item of o.rules) {
      const rule = parseRule(item);
      if (rule) rules.push(rule);
      if (rules.length >= 40) break;
    }
  }
  return {
    includeCcTips: o.includeCcTips === true,
    laborUsesShareIncome: o.laborUsesShareIncome === true,
    transferMode: o.transferMode === "finix_split" ? "finix_split" : "book_entry",
    rules,
  };
}

function dateEnd(rule: RevenueShareRule): string {
  return rule.endsOn || "9999-12-31";
}

function datesOverlap(a: RevenueShareRule, b: RevenueShareRule): boolean {
  return a.effectiveOn <= dateEnd(b) && b.effectiveOn <= dateEnd(a);
}

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

function scopesOverlap(
  a: RevenueShareRule,
  b: RevenueShareRule,
  tables: ShareTableRef[],
  sections: ShareSectionRef[],
): boolean {
  if (a.scope === "venue" || b.scope === "venue") return true;
  if (a.scope === "sections" && b.scope === "sections") {
    return a.sectionIds.some((id) => b.sectionIds.includes(id));
  }
  if (a.scope === "tables" && b.scope === "tables") {
    return a.tableIds.some((id) => b.tableIds.includes(id));
  }
  const sec = a.scope === "sections" ? a : b;
  const tab = a.scope === "tables" ? a : b;
  return tab.tableIds.some((id) => {
    const table = tables.find((t) => t.id === id);
    if (!table) return false;
    const keys = sectionKeysForTable(table, sections);
    return sec.sectionIds.some((sid) => keys.includes(sid));
  });
}

export function rulesOverlap(
  a: RevenueShareRule,
  b: RevenueShareRule,
  tables: ShareTableRef[] = [],
  sections: ShareSectionRef[] = [],
): boolean {
  if (a.fromEntityId !== b.fromEntityId) return false;
  if (!datesOverlap(a, b)) return false;
  return scopesOverlap(a, b, tables, sections);
}

export function validateRevenueShareRules(
  rules: RevenueShareRule[],
  tables: ShareTableRef[] = [],
  sections: ShareSectionRef[] = [],
): { ok: true } | { ok: false; error: string } {
  for (const rule of rules) {
    if (!rule.fromEntityId || !rule.toEntityId) {
      return { ok: false, error: "Each rule needs a from entity and a to entity." };
    }
    if (rule.fromEntityId === rule.toEntityId) {
      return { ok: false, error: "From and to must be different entities." };
    }
    if (!(rule.percent > 0 && rule.percent <= 100)) {
      return { ok: false, error: "Percent must be greater than 0 and at most 100." };
    }
    if (!DATE_RE.test(rule.effectiveOn)) {
      return { ok: false, error: "Each rule needs an effective date." };
    }
    if (rule.endsOn && !DATE_RE.test(rule.endsOn)) {
      return { ok: false, error: "End date must be a calendar date." };
    }
    if (rule.endsOn && rule.endsOn < rule.effectiveOn) {
      return { ok: false, error: "End date is before the effective date." };
    }
    if (rule.scope === "sections" && rule.sectionIds.length === 0) {
      return { ok: false, error: "Pick at least one section, or share the whole venue." };
    }
    if (rule.scope === "tables" && rule.tableIds.length === 0) {
      return { ok: false, error: "Pick at least one table, or share the whole venue." };
    }
  }
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      if (rulesOverlap(rules[i]!, rules[j]!, tables, sections)) {
        return {
          ok: false,
          error:
            "Two rules would share the same drink twice. Change the section, table, entity, or dates so they do not overlap.",
        };
      }
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

type Place = {
  tableId: string;
  tableLabel: string;
  sectionId: string;
  sectionName: string;
};

function placeOf(
  order: Order,
  tables: ShareTableRef[],
  sections: ShareSectionRef[],
): Place {
  const table = order.tableId ? tables.find((t) => t.id === order.tableId) : undefined;
  if (!table) {
    return {
      tableId: "",
      tableLabel: order.tabName?.trim() || "Bar tab",
      sectionId: "",
      sectionName: "",
    };
  }
  const keys = sectionKeysForTable(table, sections);
  const section = sections.find((s) => keys.includes(s.id) || keys.includes(s.name));
  return {
    tableId: table.id,
    tableLabel: table.label?.trim() || table.id,
    sectionId: section?.id || table.sectionId || "",
    sectionName: section?.name || table.section || "",
  };
}

function scopeMatches(rule: RevenueShareRule, place: Place): boolean {
  if (rule.scope === "venue") return true;
  if (rule.scope === "sections") {
    const keys = [place.sectionId, place.sectionName].filter(Boolean);
    return rule.sectionIds.some((id) => keys.includes(id));
  }
  if (rule.scope === "tables") {
    return Boolean(place.tableId) && rule.tableIds.includes(place.tableId);
  }
  return false;
}

function ruleApplies(rule: RevenueShareRule, ymd: string, entityId: string, place: Place): boolean {
  if (rule.fromEntityId !== entityId) return false;
  if (!DATE_RE.test(rule.effectiveOn) || ymd < rule.effectiveOn) return false;
  if (rule.endsOn && ymd > rule.endsOn) return false;
  return scopeMatches(rule, place);
}

function cardTipCents(order: Order): number {
  return (order.payments ?? [])
    .filter((p) => p.method === "card" || p.method === "room_charge")
    .reduce((s, p) => s + (p.tipCents || 0), 0);
}

/** Card-tip cents allocated onto each merchandise line. Food lines are not drink net. */
function cardTipByLine(order: Order, includeCcTips: boolean): Map<string, number> {
  const map = new Map<string, number>();
  if (!includeCcTips) return map;
  const tip = cardTipCents(order);
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

export function shareLinesForOrders(opts: {
  orders: Order[];
  config: RevenueShareConfig | null | undefined;
  tables?: Array<ShareTableRef | Table>;
  sections?: Array<ShareSectionRef | FloorSection>;
  menuItems?: MenuItem[];
  from?: number;
  to?: number;
  toInclusive?: boolean;
  timeZone?: string;
}): RevenueShareLine[] {
  const config = parseRevenueShare(opts.config);
  if (!config.rules.length) return [];
  const tables = (opts.tables ?? []) as ShareTableRef[];
  const sections = (opts.sections ?? []) as ShareSectionRef[];
  const ordered = [...config.rules].sort(
    (a, b) => a.effectiveOn.localeCompare(b.effectiveOn) || a.id.localeCompare(b.id),
  );
  const out: RevenueShareLine[] = [];
  for (const order of opts.orders) {
    if (order.status !== "closed") continue;
    const at = order.closedAt ?? order.createdAt;
    if (opts.from != null && at < opts.from) continue;
    if (opts.to != null && (opts.toInclusive ? at > opts.to : at >= opts.to)) continue;
    const ymd = venueYmd(at, opts.timeZone);
    const place = placeOf(order, tables, sections);
    const tips = cardTipByLine(order, config.includeCcTips);
    for (const line of order.lines ?? []) {
      if (!isDrinkLine(line, opts.menuItems) || line.comped) continue;
      const merch = lineCashCents(line);
      const drinkNet = merch + (tips.get(line.id) ?? 0);
      if (drinkNet <= 0) continue;
      const entityId = sellingEntityId(line);
      const rule = ordered.find((r) => ruleApplies(r, ymd, entityId, place));
      if (!rule) continue;
      const amountCents = Math.round((drinkNet * rule.percent) / 100);
      if (amountCents <= 0) continue;
      out.push({
        id: `rs_${order.id}_${line.id}_${rule.id}`,
        ruleId: rule.id,
        checkId: order.id,
        checkNumber: String(order.number ?? ""),
        lineId: line.id,
        fromEntityId: rule.fromEntityId,
        toEntityId: rule.toEntityId,
        amountCents,
        drinkNetCents: drinkNet,
        percent: rule.percent,
        tableId: place.tableId,
        tableLabel: place.tableLabel,
        sectionId: place.sectionId,
        sectionName: place.sectionName,
        closedAt: at,
      });
    }
  }
  return out;
}

export function shareTransfers(
  lines: RevenueShareLine[],
  mode: RevenueShareTransferMode,
): RevenueShareTransfer[] {
  const map = new Map<string, RevenueShareTransfer>();
  const label = transferInstruction(mode);
  for (const line of lines) {
    const key = `${line.fromEntityId}\u2192${line.toEntityId}`;
    const cur = map.get(key) ?? {
      fromEntityId: line.fromEntityId,
      toEntityId: line.toEntityId,
      amountCents: 0,
      mode,
      label,
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

export function revenueShareSnapshot(opts: {
  orders: Order[];
  config: RevenueShareConfig | null | undefined;
  tables?: Array<ShareTableRef | Table>;
  sections?: Array<ShareSectionRef | FloorSection>;
  menuItems?: MenuItem[];
  entityIds?: string[];
  from?: number;
  to?: number;
  toInclusive?: boolean;
  timeZone?: string;
}): RevenueShareSnapshot {
  const config = parseRevenueShare(opts.config);
  const lines = shareLinesForOrders({ ...opts, config });
  return {
    lines,
    transfers: shareTransfers(lines, config.transferMode),
    byEntity: shareByEntity(lines, opts.entityIds ?? []),
    includeCcTips: config.includeCcTips,
    laborUsesShareIncome: config.laborUsesShareIncome,
    transferMode: config.transferMode,
  };
}

/** Food-side labor sales. The paying entity is unchanged even when the flag is on. */
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
