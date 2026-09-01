import type { Employee, Order, Table } from "./types";
import { isEmptyTable, normalizeTableStatus } from "./floor-status";
import { findLateCompCashEvents, type LossPreventionConfig } from "./loss-prevention";

export const CHECK_HOLDS = ["manager_hold", "walkout", "bar_tab", "left_to_close"] as const;
export type CheckHoldKind = (typeof CHECK_HOLDS)[number];

export const CHECK_HOLD_LABEL: Record<CheckHoldKind, string> = {
  manager_hold: "Manager hold",
  walkout: "Walkout",
  bar_tab: "Bar tab",
  left_to_close: "Left to close",
};

export const CHECK_HOLD_REASONS: Record<CheckHoldKind, readonly string[]> = {
  manager_hold: ["End of night", "Guest returning", "Manager hold", "Other (logged)"],
  walkout: ["Walkout", "Skip", "Manager approved"],
  bar_tab: ["Still drinking", "Moved to bar", "Tab parked"],
  left_to_close: ["Table needed", "Guest left to pay", "Table marked empty", "Other (logged)"],
};

export type EmptyTablePolicy = "auto_hold" | "require_lead";
export type NightCloseMode = "hard_block" | "ack";

export const INTEGRITY_WARN_COLOR = "#f59e0b";

export const DEFAULT_INTEGRITY_IDLE_MINUTES = 45;

export type IntegrityIssueKind =
  | "open_check"
  | "occupied_no_check"
  | "empty_open_check"
  | "stale_open_no_item"
  | "cash_not_closed"
  | "late_comp_cash"
  | "hold_bucket"
  | "clockout_open_checks";

export type IntegrityIssue = {
  id: string;
  kind: IntegrityIssueKind;
  label: string;
  detail: string;
  tableId?: string;
  tableLabel?: string;
  orderId?: string;
  orderNumber?: number;
  employeeId?: string;
  employeeName?: string;
  at: number;
};

export const INTEGRITY_KIND_LABEL: Record<IntegrityIssueKind, string> = {
  open_check: "Open check",
  occupied_no_check: "Table occupied, no check",
  empty_open_check: "Table empty/dirty, check still open",
  stale_open_no_item: "Open with no new item",
  cash_not_closed: "Cash recorded, check not closed",
  late_comp_cash: "Late comp + cash close",
  hold_bucket: "Hold-bucket ticket",
  clockout_open_checks: "Clock-out with open checks",
};

export function isCheckHoldKind(v: string | null | undefined): v is CheckHoldKind {
  return !!v && (CHECK_HOLDS as readonly string[]).includes(v);
}

export function openCheckOnTable(table: Table, orders: Order[]): Order | undefined {
  if (table.orderId) {
    const o = orders.find((x) => x.id === table.orderId && x.status === "open");
    if (o) return o;
  }
  return orders.find((o) => o.status === "open" && o.tableId === table.id && !o.holdKind);
}

/** Empty or dirty table that still has an open check attached. */
export function tableEmptyWithOpenCheck(table: Table, orders: Order[]): boolean {
  const st = normalizeTableStatus(table.status);
  const vacant = st === "empty" || st === "closed_not_cleaned";
  if (!vacant) return false;
  return orders.some(
    (o) => o.status === "open" && !o.holdKind && (o.tableId === table.id || table.orderId === o.id),
  );
}

export function tableOccupiedNoCheck(table: Table, orders: Order[]): boolean {
  const st = normalizeTableStatus(table.status);
  if (st === "empty" || st === "closed_not_cleaned" || st === "reserved") return false;
  const open = openCheckOnTable(table, orders);
  return !open;
}

export function lastItemAt(order: Order): number {
  let max = order.createdAt;
  for (const l of order.lines) {
    if (l.voided) continue;
    const t = l.createdAt || 0;
    if (t > max) max = t;
  }
  return max;
}

export function buildNightlyIntegrityPack(opts: {
  tables: Table[];
  orders: Order[];
  employees: Employee[];
  auditLog?: { at: number; action: string; employeeId?: string; orderId?: string; amountCents?: number; overrideEmployeeName?: string; employeeName?: string }[];
  cfg: LossPreventionConfig;
  now?: number;
}): IntegrityIssue[] {
  const now = opts.now ?? Date.now();
  const idleMs = (opts.cfg.integrityIdleMinutes ?? DEFAULT_INTEGRITY_IDLE_MINUTES) * 60_000;
  const out: IntegrityIssue[] = [];

  for (const order of opts.orders.filter((o) => o.status === "open")) {
    const table = order.tableId ? opts.tables.find((t) => t.id === order.tableId) : undefined;
    out.push({
      id: `open:${order.id}`,
      kind: "open_check",
      label: INTEGRITY_KIND_LABEL.open_check,
      detail: `#${order.number} · ${order.serverName || "—"}${table ? ` · T${table.label}` : order.holdKind ? ` · ${CHECK_HOLD_LABEL[order.holdKind]}` : ""}`,
      tableId: table?.id,
      tableLabel: table?.label,
      orderId: order.id,
      orderNumber: order.number,
      employeeId: order.serverId,
      employeeName: order.serverName,
      at: order.createdAt,
    });
    if (order.holdKind) {
      out.push({
        id: `hold:${order.id}`,
        kind: "hold_bucket",
        label: INTEGRITY_KIND_LABEL.hold_bucket,
        detail: `#${order.number} · ${CHECK_HOLD_LABEL[order.holdKind]}${order.holdReason ? ` · ${order.holdReason}` : ""} · ${order.holdOwner === "house" ? "House" : order.serverName}`,
        orderId: order.id,
        orderNumber: order.number,
        employeeId: order.serverId,
        employeeName: order.serverName,
        at: order.holdAt ?? order.createdAt,
      });
    }
    const last = lastItemAt(order);
    if (now - last >= idleMs) {
      const mins = Math.round((now - last) / 60_000);
      out.push({
        id: `stale:${order.id}`,
        kind: "stale_open_no_item",
        label: INTEGRITY_KIND_LABEL.stale_open_no_item,
        detail: `#${order.number} · no new item for ${mins} min`,
        tableId: table?.id,
        tableLabel: table?.label,
        orderId: order.id,
        orderNumber: order.number,
        employeeId: order.serverId,
        employeeName: order.serverName,
        at: last,
      });
    }
    const cash = order.payments.filter((p) => p.method === "cash");
    if (cash.length) {
      const cashCents = cash.reduce((s, p) => s + p.amountCents, 0);
      out.push({
        id: `cashopen:${order.id}`,
        kind: "cash_not_closed",
        label: INTEGRITY_KIND_LABEL.cash_not_closed,
        detail: `#${order.number} · cash on check, still open`,
        tableId: table?.id,
        tableLabel: table?.label,
        orderId: order.id,
        orderNumber: order.number,
        employeeId: order.serverId,
        employeeName: order.serverName,
        at: Math.max(...cash.map((p) => p.at)),
      });
      void cashCents;
    }
  }

  for (const table of opts.tables) {
    if (tableOccupiedNoCheck(table, opts.orders)) {
      out.push({
        id: `occ:${table.id}`,
        kind: "occupied_no_check",
        label: INTEGRITY_KIND_LABEL.occupied_no_check,
        detail: `T${table.label} · ${normalizeTableStatus(table.status).replace(/_/g, " ")}`,
        tableId: table.id,
        tableLabel: table.label,
        employeeId: table.serverId,
        at: table.statusSince ?? now,
      });
    }
    if (tableEmptyWithOpenCheck(table, opts.orders)) {
      const order = openCheckOnTable(table, opts.orders);
      out.push({
        id: `emptyopen:${table.id}:${order?.id ?? ""}`,
        kind: "empty_open_check",
        label: INTEGRITY_KIND_LABEL.empty_open_check,
        detail: `T${table.label} · check #${order?.number ?? "?"} still open`,
        tableId: table.id,
        tableLabel: table.label,
        orderId: order?.id,
        orderNumber: order?.number,
        employeeId: order?.serverId,
        employeeName: order?.serverName,
        at: table.statusSince ?? now,
      });
    }
  }

  const clockedOut = opts.employees.filter((e) => e.active && !e.clockedIn && e.role !== "kiosk");
  for (const emp of clockedOut) {
    const mine = opts.orders.filter((o) => o.status === "open" && o.serverId === emp.id && !o.holdKind);
    if (!mine.length) continue;
    out.push({
      id: `clock:${emp.id}`,
      kind: "clockout_open_checks",
      label: INTEGRITY_KIND_LABEL.clockout_open_checks,
      detail: `${emp.name} · ${mine.length} open check${mine.length === 1 ? "" : "s"}`,
      employeeId: emp.id,
      employeeName: emp.name,
      orderNumber: mine[0]?.number,
      at: now,
    });
  }

  const late = findLateCompCashEvents({
    orders: opts.orders,
    auditLog: opts.auditLog ?? [],
    cfg: opts.cfg,
    from: now - 36 * 3_600_000,
    to: now + 1,
  });
  for (const ev of late) {
    out.push({
      id: ev.id,
      kind: "late_comp_cash",
      label: INTEGRITY_KIND_LABEL.late_comp_cash,
      detail: `#${ev.orderNumber} · dwell ${ev.dwellMinutes}m · ${ev.secondsCompToClose}s to cash · ${ev.tender}`,
      orderId: ev.orderId,
      orderNumber: ev.orderNumber,
      employeeId: ev.employeeId,
      employeeName: ev.employeeName,
      at: ev.closeAt,
    });
  }

  const rank: Record<IntegrityIssueKind, number> = {
    empty_open_check: 0,
    cash_not_closed: 1,
    late_comp_cash: 2,
    occupied_no_check: 3,
    clockout_open_checks: 4,
    stale_open_no_item: 5,
    hold_bucket: 6,
    open_check: 7,
  };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || b.at - a.at);
}

export function blockingNightlyIssues(issues: IntegrityIssue[]): IntegrityIssue[] {
  return issues.filter((i) => i.kind !== "open_check" || issues.some((x) => x.orderId === i.orderId && x.kind !== "open_check"));
}
