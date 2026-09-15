/**
 * After PIN, the station home is a short list of jobs this DEVICE × PIN allows.
 * Hide what the intersection denies. Never a grid of greyed-out extras.
 */
import type { DeviceRole } from "./device-roles";
import type { EmployeeRole } from "./types";
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
  "closeout",
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
  settings?: StationCapSettings | null;
  serviceStyle?: string | null;
  operatingModel?: string | null;
  hasFloor?: boolean;
  hasBarRail?: boolean;
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
    if (out.length >= 6) return;
    if (out.some((x) => x.id === id)) return;
    out.push({ id, label });
  };

  if (device === "kiosk") return [];
  if (device === "ods") return [{ id: "clock", label: "Clock in/out" }];

  if (device === "host") {
    if (stationCan(cap, "floor") || stationCan(cap, "seat")) add("floor_seat", "Floor / seat");
    if (stationCan(cap, "waitlist")) add("waitlist", "Waitlist");
    if (stationCan(cap, "togo")) add("togo", "To-go");
    add("clock", "Clock in/out");
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
  if (role && CLOSEOUT_ROLES.has(role) && device === "order") add("closeout", "Closeout");
  return out.slice(0, 6);
}

export function stationMenuTitle(device: DeviceRole | null | undefined): string {
  if (device === "host") return "Host stand";
  if (device === "ods") return "Order display";
  return "Station";
}
