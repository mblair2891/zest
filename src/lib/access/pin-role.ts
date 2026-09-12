/**
 * PIN session capabilities. Leaf module (no store) so node:test can load it.
 * After PIN, UI and APIs use this — not a dropdown of every view.
 */
import type { EmployeeRole, PosView } from "@/lib/pos/types";
import type { DeviceRole } from "@/lib/pos/device-roles";

export const PIN_ROLES = [
  "host",
  "server",
  "bartender",
  "kitchen",
  "busser",
  "supervisor",
  "manager",
  "owner",
  "cashier",
  "vendor_operator",
  "accountant",
  "kiosk",
] as const satisfies readonly EmployeeRole[];

export type PinAction =
  | "orders.create"
  | "orders.send"
  | "payments.take"
  | "ods.start"
  | "ods.bump"
  | "table.seat"
  | "table.bus"
  | "table.transfer"
  | "waitlist.manage"
  | "menu.write"
  | "devices.manage"
  | "publish"
  | "till.close.own"
  | "till.approve"
  | "clock.exceptions"
  | "comps.void"
  | "item.86"
  | "item.86.other_entity"
  | "schedule.write"
  | "platform";

const ALL_ACTIONS: PinAction[] = [
  "orders.create",
  "orders.send",
  "payments.take",
  "ods.start",
  "ods.bump",
  "table.seat",
  "table.bus",
  "table.transfer",
  "waitlist.manage",
  "menu.write",
  "devices.manage",
  "publish",
  "till.close.own",
  "till.approve",
  "clock.exceptions",
  "comps.void",
  "item.86",
  "item.86.other_entity",
  "schedule.write",
];

const ROLE_ACTIONS: Record<EmployeeRole, PinAction[] | "all"> = {
  owner: "all",
  manager: ALL_ACTIONS.filter((a) => a !== "platform"),
  supervisor: [
    "orders.create",
    "orders.send",
    "payments.take",
    "ods.start",
    "ods.bump",
    "table.seat",
    "table.bus",
    "table.transfer",
    "waitlist.manage",
    "clock.exceptions",
    "comps.void",
    "item.86",
    "till.approve",
  ],
  host: [
    "table.seat",
    "table.bus",
    "waitlist.manage",
    "orders.create",
    "orders.send",
    "payments.take",
  ],
  server: [
    "orders.create",
    "orders.send",
    "payments.take",
    "table.transfer",
    "table.seat",
    "till.close.own",
  ],
  bartender: [
    "orders.create",
    "orders.send",
    "payments.take",
    "ods.start",
    "ods.bump",
    "till.close.own",
    "item.86",
  ],
  kitchen: ["ods.start", "ods.bump", "item.86"],
  busser: ["table.bus"],
  cashier: ["orders.create", "orders.send", "payments.take", "till.close.own"],
  vendor_operator: [
    "orders.create",
    "ods.start",
    "ods.bump",
    "item.86",
    "menu.write",
    "schedule.write",
  ],
  accountant: [],
  kiosk: ["orders.create", "waitlist.manage"],
};

/** Job screens after PIN. Live stations do not list every module. */
export const PIN_VIEWS: Record<EmployeeRole, PosView[] | "all"> = {
  owner: "all",
  manager: [
    "hq",
    "floor",
    "order",
    "kitchen",
    "bar",
    "waitlist",
    "takeout",
    "online",
    "hall",
    "settlement",
    "ledger",
    "reports",
    "inventory",
    "menu",
    "labor",
    "hr",
    "employees",
    "customers",
    "cash",
    "settings",
    "floor_editor",
    "schedule",
    "recipes",
    "promos",
    "catering",
    "purchasing",
    "payouts",
    "delivery",
    "checklists",
    "truck_pod",
    "vendor_portal",
    "inventory_ai",
    "drink_ai",
  ],
  supervisor: [
    "hq",
    "floor",
    "order",
    "kitchen",
    "bar",
    "waitlist",
    "takeout",
    "labor",
    "cash",
    "customers",
  ],
  host: ["hq", "floor", "waitlist", "takeout", "customers", "labor"],
  server: ["hq", "floor", "order", "takeout", "cash", "customers", "labor"],
  bartender: ["hq", "floor", "order", "bar", "takeout", "cash", "labor", "drink_ai"],
  kitchen: ["kitchen", "labor"],
  busser: ["floor"],
  cashier: ["hq", "order", "takeout", "cash", "labor"],
  vendor_operator: [
    "hq",
    "vendor_portal",
    "kitchen",
    "bar",
    "menu",
    "employees",
    "labor",
    "schedule",
    "reports",
    "ledger",
    "recipes",
    "purchasing",
    "inventory",
  ],
  accountant: ["hq", "reports", "ledger", "settlement", "cash", "labor"],
  kiosk: ["waitlist", "order"],
};

export function parsePinRole(raw: string | null | undefined): EmployeeRole | null {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if ((PIN_ROLES as readonly string[]).includes(s)) return s as EmployeeRole;
  if (s === "expo") return "kitchen";
  if (s === "supervisor_manager") return "supervisor";
  return null;
}

export function pinRoleActions(role: EmployeeRole): PinAction[] {
  const a = ROLE_ACTIONS[role];
  if (a === "all") return [...ALL_ACTIONS, "platform"];
  return a;
}

export function pinRoleCan(
  role: EmployeeRole | null | undefined,
  action: PinAction,
  opts?: { deviceRole?: DeviceRole | null; seatGranted?: boolean },
): boolean {
  if (!role) return false;
  if (action === "platform") return false;
  const allowed = ROLE_ACTIONS[role];
  if (allowed === "all") return true;
  if (action === "table.seat" && role === "bartender") {
    return Boolean(opts?.seatGranted);
  }
  if ((action === "ods.bump" || action === "ods.start") && role === "bartender") {
    const device = opts?.deviceRole;
    if (device && device !== "ods") return false;
  }
  if (action === "item.86.other_entity") {
    return role === "owner" || role === "manager";
  }
  return allowed.includes(action);
}

export function assertPinAction(
  role: EmployeeRole | null | undefined,
  action: PinAction,
  opts?: { deviceRole?: DeviceRole | null; seatGranted?: boolean },
): void {
  if (!pinRoleCan(role, action, opts)) {
    throw new Error("This PIN cannot do that. Ask a manager.");
  }
}

export function pinRoleViews(role: EmployeeRole): PosView[] | "all" {
  return PIN_VIEWS[role];
}

/** Screen this PIN is allowed to run on a paired device. */
export function viewForDevicePin(
  device: DeviceRole | null | undefined,
  role: EmployeeRole,
): PosView {
  if (device === "host") return "waitlist";
  if (device === "ods") return role === "bartender" ? "bar" : "kitchen";
  if (role === "host") return "waitlist";
  if (role === "kitchen") return "kitchen";
  if (role === "busser") return "floor";
  return "order";
}

/** Change-device (Order / ODS / Host) is training/demo for managers only — not live. */
export function canChangeDeviceOnStation(opts: {
  role: EmployeeRole | null | undefined;
  training?: boolean;
  demo?: boolean;
}): boolean {
  if (opts.role !== "owner" && opts.role !== "manager") return false;
  return Boolean(opts.training || opts.demo);
}

export function helpBlocksAction(role: EmployeeRole | null | undefined, question: string): {
  blocked: boolean;
  whoCan: string | null;
  note: string;
} | null {
  const q = question.toLowerCase();
  const asks = (re: RegExp) => re.test(q);
  const deny = (whoCan: string, note: string) => ({ blocked: true, whoCan, note });
  if (asks(/\b(crm|pipeline|tenant wipe|factory reset|billing key)\b/)) {
    return deny("Platform Admin", "That is platform work, not a floor PIN.");
  }
  if (asks(/\b(publish|devices|menu edit|edit menu|price edit)\b/) && !pinRoleCan(role, "menu.write") && !pinRoleCan(role, "publish") && !pinRoleCan(role, "devices.manage")) {
    if (asks(/publish/) && !pinRoleCan(role, "publish")) {
      return deny("manager", "Publish is a manager action. This PIN cannot publish.");
    }
    if (asks(/devices/) && !pinRoleCan(role, "devices.manage")) {
      return deny("manager", "Devices is a manager action. This PIN cannot open Devices.");
    }
    if (asks(/menu|price/) && !pinRoleCan(role, "menu.write")) {
      return deny("manager", "This PIN cannot edit menus or prices.");
    }
  }
  if (asks(/\b(bump|ods)\b/) && !pinRoleCan(role, "ods.bump")) {
    return deny("kitchen or bartender on ODS", "This PIN cannot bump Order Display tickets.");
  }
  if (asks(/\b(pay|tender|card|cash drawer)\b/) && !pinRoleCan(role, "payments.take")) {
    return deny("server, bartender, or cashier", "This PIN cannot take payment or open a cash drawer.");
  }
  if (asks(/\b(order|send ticket|ring)\b/) && !pinRoleCan(role, "orders.create")) {
    return deny("server or bartender", "This PIN cannot open a check or send tickets.");
  }
  if (asks(/\b(seat|waitlist)\b/) && role === "bartender" && !pinRoleCan(role, "table.seat")) {
    return deny("host", "A bartender PIN cannot seat the dining room unless a host grant is on.");
  }
  return null;
}
