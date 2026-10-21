import type { EmployeeRole, KitchenTicket, Order, Table, TableStatus } from "./types";

/** Canonical dining pipeline. Legacy persist values are mapped in `normalizeTableStatus`. */
export const FLOOR_PIPELINE = [
  "empty",
  "sat_no_order",
  "ordered_drinks",
  "ordered_food",
  "food_delivered",
  "food_completed",
  "closed_not_cleaned",
] as const;

export type FloorPipelineStatus = (typeof FLOOR_PIPELINE)[number];

export const FLOOR_STATUS_LABEL: Record<FloorPipelineStatus, string> = {
  empty: "Empty",
  sat_no_order: "Sat · no order",
  ordered_drinks: "Drinks fired",
  ordered_food: "Food fired",
  food_delivered: "Food delivered",
  food_completed: "Dining · unpaid",
  closed_not_cleaned: "Closed · needs bus",
};

export const DEFAULT_FLOOR_COLORS: Record<FloorPipelineStatus, string> = {
  empty: "#ffffff",
  sat_no_order: "#93c5fd",
  ordered_drinks: "#fcd34d",
  ordered_food: "#6ee7b7",
  food_delivered: "#5eead4",
  food_completed: "#c4b5fd",
  closed_not_cleaned: "#fda4af",
};

/** Minutes until the table flashes. Null/0 = no SLA. Demo laundry uses short values. */
export const DEFAULT_FLASH_MINUTES: Record<FloorPipelineStatus, number | null> = {
  empty: null,
  sat_no_order: 10,
  ordered_drinks: 15,
  ordered_food: 20,
  food_delivered: 25,
  food_completed: 20,
  closed_not_cleaned: 5,
};

export type FloorStatusConfig = {
  enabled: Record<FloorPipelineStatus, boolean>;
  colors: Record<FloorPipelineStatus, string>;
  flashMinutes: Record<FloorPipelineStatus, number | null>;
  /** Who may tap a status on the floor. */
  changeRoles: EmployeeRole[];
  seatingRole: "host" | "manager" | "host_or_manager";
  /** Auto-advance from seat / fire / deliver / pay. Default on. */
  autoStatus?: boolean;
  /** Assigned server always hears QR pay. Expo only when this is on. */
  notifyExpoOnQrPay?: boolean;
};

export const DEFAULT_FLOOR_STATUS_CONFIG: FloorStatusConfig = {
  enabled: {
    empty: true,
    sat_no_order: true,
    ordered_drinks: true,
    ordered_food: true,
    food_delivered: true,
    food_completed: true,
    closed_not_cleaned: true,
  },
  colors: { ...DEFAULT_FLOOR_COLORS },
  flashMinutes: { ...DEFAULT_FLASH_MINUTES },
  changeRoles: ["owner", "manager", "host", "server", "busser"],
  seatingRole: "host_or_manager",
  autoStatus: true,
  notifyExpoOnQrPay: false,
};

export function parseFloorStatusConfig(raw: unknown): FloorStatusConfig {
  const base = DEFAULT_FLOOR_STATUS_CONFIG;
  if (!raw || typeof raw !== "object") return { ...base, colors: { ...base.colors }, flashMinutes: { ...base.flashMinutes }, enabled: { ...base.enabled }, changeRoles: [...base.changeRoles] };
  const o = raw as Record<string, unknown>;
  const enabled = { ...base.enabled };
  const colors = { ...base.colors };
  const flashMinutes = { ...base.flashMinutes };
  if (o.enabled && typeof o.enabled === "object") {
    for (const k of FLOOR_PIPELINE) {
      const v = (o.enabled as Record<string, unknown>)[k];
      if (typeof v === "boolean") enabled[k] = v;
    }
  }
  if (o.colors && typeof o.colors === "object") {
    for (const k of FLOOR_PIPELINE) {
      const v = (o.colors as Record<string, unknown>)[k];
      if (typeof v === "string" && v.startsWith("#")) colors[k] = v;
    }
  }
  if (o.flashMinutes && typeof o.flashMinutes === "object") {
    for (const k of FLOOR_PIPELINE) {
      const v = (o.flashMinutes as Record<string, unknown>)[k];
      if (v === null || v === "") flashMinutes[k] = null;
      else if (typeof v === "number") flashMinutes[k] = v;
      else if (typeof v === "string" && v.trim()) flashMinutes[k] = Number(v) || null;
    }
  }
  const changeRoles = Array.isArray(o.changeRoles)
    ? (o.changeRoles.filter((r) => typeof r === "string") as EmployeeRole[])
    : base.changeRoles;
  const seatingRole =
    o.seatingRole === "host" || o.seatingRole === "manager" || o.seatingRole === "host_or_manager"
      ? o.seatingRole
      : base.seatingRole;
  return {
    enabled,
    colors,
    flashMinutes,
    changeRoles,
    seatingRole,
    autoStatus: o.autoStatus === false ? false : true,
    notifyExpoOnQrPay: o.notifyExpoOnQrPay === true,
  };
}

export function normalizeTableStatus(raw: string | undefined | null): FloorPipelineStatus | "reserved" {
  switch (raw) {
    case "empty":
    case "available":
      return "empty";
    case "sat_no_order":
    case "seated":
    case "ordering":
      return raw === "ordering" ? "sat_no_order" : "sat_no_order";
    case "ordered_drinks":
      return "ordered_drinks";
    case "ordered_food":
    case "ordered":
      return "ordered_food";
    case "food_delivered":
      return "food_delivered";
    case "food_completed":
    case "check":
      return "food_completed";
    case "closed_not_cleaned":
    case "paid":
    case "dirty":
      return "closed_not_cleaned";
    case "reserved":
      return "reserved";
    default:
      return "empty";
  }
}

export function isEmptyTable(status: string | undefined): boolean {
  const n = normalizeTableStatus(status);
  return n === "empty";
}

export function enabledPipeline(cfg: FloorStatusConfig): FloorPipelineStatus[] {
  return FLOOR_PIPELINE.filter((s) => cfg.enabled[s] !== false);
}

export function nextEnabled(from: FloorPipelineStatus, cfg: FloorStatusConfig): FloorPipelineStatus {
  const list = enabledPipeline(cfg);
  const i = list.indexOf(from);
  if (i < 0) return list[0] ?? "empty";
  return list[Math.min(list.length - 1, i + 1)] ?? from;
}

export function canChangeTableStatus(role: EmployeeRole | null | undefined, cfg: FloorStatusConfig): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  return cfg.changeRoles.includes(role);
}

/** Who may seat an empty table. Owner always can. */
export function canSeatTable(role: EmployeeRole | null | undefined, cfg: FloorStatusConfig): boolean {
  if (!role) return false;
  if (role === "owner" || role === "manager") return true;
  if (cfg.seatingRole === "manager") return false;
  if (role === "host") return true;
  if (role === "server" || role === "cashier") return cfg.seatingRole === "host_or_manager";
  return false;
}

export function canEditFloorplan(role: EmployeeRole | null | undefined): boolean {
  return role === "owner" || role === "manager" || role === "host";
}

export function contrastInk(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#0a0a0a";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.62 ? "#0a0a0a" : "#f7f6f3";
}

/**
 * When the current status began. A missing clock does not flash.
 * Seat time counts only for Sat · no order. A later status that still
 * carries that stamp has not started its own clock.
 */
export function statusClockMs(
  table: { status?: string | null; statusSince?: number | null; seatedAt?: number | null },
  now = Date.now(),
): number | null {
  const st = normalizeTableStatus(table.status);
  if (st === "reserved") return null;
  const since = table.statusSince;
  if (typeof since !== "number" || !Number.isFinite(since) || since <= 0) return null;
  if (since > now + 5_000) return null;
  const seated = table.seatedAt;
  if (st !== "sat_no_order" && typeof seated === "number" && seated > 0 && since <= seated) return null;
  return since;
}

export function tableFlash(
  table: Pick<Table, "status" | "statusSince" | "seatedAt">,
  cfg: FloorStatusConfig,
  now = Date.now(),
  painted?: FloorPipelineStatus | "reserved",
): boolean {
  const stored = normalizeTableStatus(table.status);
  const st = painted && painted !== "reserved" ? painted : stored;
  if (st === "reserved") return false;
  const mins = cfg.flashMinutes[st];
  if (mins == null || mins <= 0) return false;
  if (st !== stored) {
    if (st !== "sat_no_order") return false;
    const seated = table.seatedAt;
    if (typeof seated !== "number" || !Number.isFinite(seated) || seated <= 0) return false;
    return now - seated >= mins * 60_000;
  }
  const since = statusClockMs(table, now);
  if (since == null) return false;
  return now - since >= mins * 60_000;
}

/**
 * Move a table onto the status it is actually in and restart a bad clock.
 * Paid, closed, and cleaned tables stop flashing until that status's own minutes elapse.
 */
export function alignTableFlashClock<T extends {
  status: string;
  statusSince?: number;
  seatedAt?: number;
  orderId?: string;
  flashNotified?: boolean;
}>(
  table: T,
  opts: {
    now: number;
    cfg: FloorStatusConfig;
    openOrders: { createdAt?: number }[];
    linked?: { status?: string } | null;
    derived?: FloorPipelineStatus | "reserved" | null;
  },
): T {
  const now = opts.now;
  let row = table;
  const stored = () => normalizeTableStatus(row.status);
  const linkedStatus = opts.linked?.status;
  if (!opts.openOrders.length && linkedStatus && linkedStatus !== "open") {
    const next: FloorPipelineStatus =
      linkedStatus === "voided" || linkedStatus === "cancelled" ? "empty" : paidTableStatus(opts.cfg);
    if (stored() !== next) {
      row = {
        ...row,
        status: next,
        statusSince: now,
        flashNotified: false,
        seatedAt: next === "empty" ? undefined : row.seatedAt,
        orderId: next === "empty" ? undefined : row.orderId,
      };
    }
  } else if (opts.openOrders.length && opts.derived && opts.derived !== "reserved") {
    const next = nextAutoTableStatus({
      current: row.status,
      derived: opts.derived,
      cfg: opts.cfg,
    });
    if (stored() !== next) {
      const since =
        next === "sat_no_order" ? (row.seatedAt || opts.openOrders[0]?.createdAt || now) : now;
      row = { ...row, status: next, statusSince: since, flashNotified: false };
    }
  }
  const since = row.statusSince;
  const missing = typeof since !== "number" || !Number.isFinite(since) || since <= 0;
  if (stored() !== "reserved" && missing) {
    row = { ...row, statusSince: now, flashNotified: false };
  } else if (
    stored() !== "sat_no_order" &&
    stored() !== "reserved" &&
    typeof since === "number" &&
    since > 0 &&
    statusClockMs(row, now) == null
  ) {
    row = { ...row, statusSince: now, flashNotified: false };
  }
  return row;
}

export const PIPELINE_RANK: Record<FloorPipelineStatus, number> = {
  empty: 0,
  sat_no_order: 1,
  ordered_drinks: 2,
  ordered_food: 3,
  food_delivered: 4,
  food_completed: 5,
  closed_not_cleaned: 6,
};

export function paidTableStatus(cfg: FloorStatusConfig): FloorPipelineStatus {
  return cfg.enabled.closed_not_cleaned !== false ? "closed_not_cleaned" : "empty";
}

function pickEnabled(raw: FloorPipelineStatus, cfg: FloorStatusConfig): FloorPipelineStatus {
  const enabled = enabledPipeline(cfg);
  if (enabled.includes(raw)) return raw;
  const orderPipe = [
    "sat_no_order",
    "ordered_drinks",
    "ordered_food",
    "food_delivered",
    "food_completed",
    "closed_not_cleaned",
  ] as const;
  const idx = orderPipe.indexOf(raw as (typeof orderPipe)[number]);
  for (let i = idx; i >= 0; i--) {
    const c = orderPipe[i];
    if (c && enabled.includes(c)) return c;
  }
  return enabled.includes("sat_no_order") ? "sat_no_order" : enabled[0] ?? "empty";
}

export function deriveTableStatus(
  order: Order | undefined,
  tickets: KitchenTicket[],
  cfg: FloorStatusConfig,
): FloorPipelineStatus {
  if (!order || order.status === "voided" || order.status === "cancelled") return "empty";
  if (order.status === "closed") return pickEnabled(paidTableStatus(cfg), cfg);
  const lines = order.lines.filter((l) => !l.voided);
  const drinks = lines.filter((l) => l.station === "bar" || l.course === "drink");
  const food = lines.filter((l) => l.station !== "bar" && l.course !== "drink");
  const foodTickets = tickets.filter((t) => t.orderId === order.id && t.station === "kitchen");
  const drinkTickets = tickets.filter((t) => t.orderId === order.id && t.station === "bar");
  const drinkSent = drinks.some((l) => l.sent);
  const foodSent = food.some((l) => l.sent);
  const allFoodDelivered =
    foodSent && foodTickets.length > 0 && foodTickets.every((t) => t.status === "bumped");
  const allDrinksDelivered =
    !drinkSent ||
    (drinkTickets.length > 0 && drinkTickets.every((t) => t.status === "bumped"));
  const allItemsDelivered =
    (foodSent || drinkSent) &&
    (!foodSent || allFoodDelivered) &&
    allDrinksDelivered;

  let raw: FloorPipelineStatus = "sat_no_order";
  if (allItemsDelivered) raw = "food_completed";
  else if (allFoodDelivered) raw = "food_delivered";
  else if (foodSent) raw = "ordered_food";
  else if (drinkSent) raw = "ordered_drinks";
  else raw = "sat_no_order";

  return pickEnabled(raw, cfg);
}

/**
 * Auto-advance stored status from an event. Does not go backwards
 * (manual SET STATUS still wins until a later event). Pay/clean may force.
 */
export function nextAutoTableStatus(opts: {
  current: string | undefined;
  derived: FloorPipelineStatus;
  cfg: FloorStatusConfig;
  force?: boolean;
}): FloorPipelineStatus {
  const derived = opts.derived;
  if (opts.force) return derived;
  const cur = normalizeTableStatus(opts.current);
  if (cur === "reserved") return derived;
  if (opts.cfg.autoStatus === false) return cur;
  if (cur === derived) return derived;
  if (PIPELINE_RANK[derived] >= PIPELINE_RANK[cur]) return derived;
  return cur;
}

export const DEMO_FLASH_MINUTES: Record<FloorPipelineStatus, number | null> = {
  empty: null,
  sat_no_order: 0.15,
  ordered_drinks: 0.4,
  ordered_food: 0.5,
  food_delivered: 0.5,
  food_completed: 0.4,
  closed_not_cleaned: 0.12,
};
