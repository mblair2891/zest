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
  sat_no_order: "#dbeafe",
  ordered_drinks: "#fef3c7",
  ordered_food: "#d1fae5",
  food_delivered: "#ccfbf1",
  food_completed: "#ede9fe",
  closed_not_cleaned: "#fee2e2",
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
  return { enabled, colors, flashMinutes, changeRoles, seatingRole };
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

export function tableFlash(
  table: Pick<Table, "status" | "statusSince">,
  cfg: FloorStatusConfig,
  now = Date.now(),
): boolean {
  const st = normalizeTableStatus(table.status);
  if (st === "reserved" || st === "empty") return false;
  const mins = cfg.flashMinutes[st];
  if (mins == null || mins <= 0) return false;
  const since = table.statusSince ?? now;
  return now - since >= mins * 60_000;
}

export function deriveTableStatus(
  order: Order | undefined,
  tickets: KitchenTicket[],
  cfg: FloorStatusConfig,
): FloorPipelineStatus {
  if (!order || order.status === "voided" || order.status === "cancelled") return "empty";
  if (order.status === "closed") return "closed_not_cleaned";
  const lines = order.lines.filter((l) => !l.voided);
  const drinks = lines.filter((l) => l.station === "bar" || l.course === "drink");
  const food = lines.filter((l) => l.station !== "bar" && l.course !== "drink");
  const foodTickets = tickets.filter((t) => t.orderId === order.id && t.station === "kitchen");
  const drinkSent = drinks.some((l) => l.sent);
  const foodSent = food.some((l) => l.sent);
  const anyFoodReady = foodTickets.some((t) => t.status === "ready" || t.status === "bumped");
  const allFoodBumped =
    foodTickets.length > 0 && foodTickets.every((t) => t.status === "bumped") && foodSent;

  let raw: FloorPipelineStatus = "sat_no_order";
  if (allFoodBumped) raw = "food_completed";
  else if (anyFoodReady && foodSent) raw = "food_delivered";
  else if (foodSent) raw = "ordered_food";
  else if (drinkSent) raw = "ordered_drinks";
  else raw = "sat_no_order";

  const enabled = enabledPipeline(cfg);
  if (enabled.includes(raw)) return raw;
  const orderPipe = ["sat_no_order", "ordered_drinks", "ordered_food", "food_delivered", "food_completed"] as const;
  const idx = orderPipe.indexOf(raw as (typeof orderPipe)[number]);
  for (let i = idx; i >= 0; i--) {
    const c = orderPipe[i];
    if (c && enabled.includes(c)) return c;
  }
  return enabled.includes("sat_no_order") ? "sat_no_order" : enabled[0] ?? "empty";
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
