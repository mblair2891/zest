/**
 * After PIN, the station home is a short list of jobs this DEVICE × PIN allows.
 * Hide what the intersection denies. Never a grid of greyed-out extras.
 */
import type { DeviceRole } from "./device-roles";
import type { EmployeeRole } from "./types";
import { staffCustody, takeDrawerLabel, type CashCustodyKind } from "./cash-custody";
import { stationCan, type StationCapSettings } from "./station-pin-gate";
import {
  resolveStationServiceStyle,
  type StationServiceStyle,
} from "./station-home";

export const STATION_MENU_JOBS = [
  "my_tables",
  "pick_table",
  "new_ticket",
  "floor_seat",
  "waitlist",
  "togo",
  "bar_tab",
  "clock",
  "no_sale",
  "closeout",
  "take_drawer",
  "hand_off",
  "gift",
  "done",
] as const;
export type StationMenuJob = (typeof STATION_MENU_JOBS)[number];

export type StationMenuItem = {
  id: StationMenuJob;
  label: string;
};

/** End-of-shift on the order tablet. Not host, kitchen, or busser. */
const CLOSEOUT_ROLES = new Set<EmployeeRole>([
  "server",
  "bartender",
  "cashier",
  "manager",
  "owner",
  "supervisor",
]);

export function stationMenuItems(opts: {
  deviceRole: DeviceRole | null | undefined;
  employeeRole: EmployeeRole | null | undefined;
  employeeId?: string | null;
  settings?: StationCapSettings | null;
  serviceStyle?: string | null;
  operatingModel?: string | null;
  hasFloor?: boolean;
  hasBarRail?: boolean;
  custody?: CashCustodyKind | null;
  hasPossession?: boolean;
  roleDefaults?: Record<string, CashCustodyKind> | null;
  employeeOverride?: CashCustodyKind | null;
  cashEnabled?: boolean;
  giftEnabled?: boolean;
  /** Bound to a receipt printer: print check, tender, no sale. */
  canPayStation?: boolean;
}): StationMenuItem[] {
  const device = opts.deviceRole ?? "order";
  const role = opts.employeeRole;
  const cap = { deviceRole: device, employeeRole: role, settings: opts.settings };
  const style: StationServiceStyle = resolveStationServiceStyle({
    serviceStyle: opts.serviceStyle,
    operatingModel: opts.operatingModel,
    hasFloor: opts.hasFloor,
  });
  const out: StationMenuItem[] = [];
  const add = (id: StationMenuJob, label: string) => {
    if (out.length >= 9) return;
    if (out.some((x) => x.id === id)) return;
    out.push({ id, label });
  };

  const custody =
    opts.custody ??
    staffCustody({
      role,
      roleDefaults: opts.roleDefaults,
      employeeOverride: opts.employeeOverride,
    });
  const cashJobs =
    opts.cashEnabled !== false &&
    custody !== "none" &&
    device !== "ods" &&
    device !== "kiosk";

  if (device === "kiosk") return [];
  if (device === "ods") return [{ id: "clock", label: "Clock in/out" }];

  if (device === "host") {
    if (stationCan(cap, "floor") || stationCan(cap, "seat")) add("floor_seat", "Floor / seat");
    if (stationCan(cap, "waitlist")) add("waitlist", "Waitlist");
    if (stationCan(cap, "togo")) add("togo", "To-go");
    add("clock", "Clock in/out");
    if (opts.canPayStation) add("no_sale", "No sale");
    if (opts.giftEnabled) add("gift", "Gift cards");
    if (cashJobs && !opts.hasPossession) add("take_drawer", takeDrawerLabel(custody));
    if (opts.cashEnabled === false) add("closeout", "Closeout");
    else if (cashJobs && opts.hasPossession) add("closeout", "Closeout");
    return out;
  }

  const work = stationCan(cap, "floor") || stationCan(cap, "order_entry") || stationCan(cap, "togo") || stationCan(cap, "bar_tab");
  if (!work) {
    add("clock", "Clock in/out");
    add("done", "Done");
    return out;
  }

  const diningFloor =
    Boolean(opts.hasFloor) &&
    (style === "full_service" || style === "hybrid") &&
    stationCan(cap, "floor");

  if (diningFloor) {
    add("my_tables", "My tables");
    if (stationCan(cap, "seat") || stationCan(cap, "order_entry")) add("pick_table", "New table");
  } else if (stationCan(cap, "order_entry")) {
    add("new_ticket", "New ticket");
  }

  if (stationCan(cap, "togo")) add("togo", "To-go");
  if (stationCan(cap, "bar_tab") && opts.hasBarRail) add("bar_tab", "Bar tab");
  add("clock", "Clock in/out");
  if (opts.canPayStation) add("no_sale", "No sale");
  if (opts.giftEnabled) add("gift", "Gift cards");
  if (cashJobs && !opts.hasPossession) add("take_drawer", takeDrawerLabel(custody));
  const closeoutOk =
    role &&
    CLOSEOUT_ROLES.has(role) &&
    device === "order" &&
    (opts.cashEnabled === false || (cashJobs && opts.hasPossession));
  if (closeoutOk) add("closeout", "Closeout");
  return out.slice(0, 9);
}

export function stationMenuTitle(device: DeviceRole | null | undefined): string {
  if (device === "host") return "Host stand";
  if (device === "ods") return "Order display";
  return "Station";
}
