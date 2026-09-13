/**
 * Station UI = device role ∩ employee PIN.
 * Device role is the hardware envelope. PIN is which of those actions this person may use.
 * If either side denies, hide the action or stay on the clock sheet.
 */
import type { DeviceRole } from "./device-roles";
import type { EmployeeRole } from "./types";

export const STATION_ACTIONS = [
  "clock",
  "floor",
  "waitlist",
  "seat",
  "togo",
  "bar_tab",
  "order_entry",
  "pay",
  "ods",
  "bus_clean",
] as const;
export type StationAction = (typeof STATION_ACTIONS)[number];

export type StationCapSettings = {
  hostMayOpenBarTabs?: boolean;
  serversAtHostStand?: boolean;
  /** Default on. False hides bar tab on order tablets even if the house has a rail. */
  orderMayOpenBarTabs?: boolean;
};

export type StationCapInput = {
  deviceRole: DeviceRole | null | undefined;
  employeeRole: EmployeeRole | null | undefined;
  settings?: StationCapSettings | null;
};

const ALL = new Set<StationAction>(STATION_ACTIONS);

export function isBackOfHousePin(role: EmployeeRole | null | undefined): boolean {
  return role === "kitchen";
}

export function hostMayOpenBarTabs(settings?: StationCapSettings | null): boolean {
  return Boolean(settings?.hostMayOpenBarTabs);
}

export function serversMayUseHostStand(settings?: StationCapSettings | null): boolean {
  return Boolean(settings?.serversAtHostStand);
}

/** Order tablets may open bar tabs unless the venue turns this off. */
export function orderMayOpenBarTabs(settings?: StationCapSettings | null): boolean {
  return settings?.orderMayOpenBarTabs !== false;
}

export function capSettingsOf(settings?: StationCapSettings | null): StationCapSettings {
  return {
    hostMayOpenBarTabs: Boolean(settings?.hostMayOpenBarTabs),
    serversAtHostStand: Boolean(settings?.serversAtHostStand),
    orderMayOpenBarTabs: settings?.orderMayOpenBarTabs !== false,
  };
}

/** What this tablet is allowed to do, before PIN. */
export function deviceEnvelope(
  device: DeviceRole | null | undefined,
  settings?: StationCapSettings | null,
): Set<StationAction> {
  const d = device ?? "order";
  if (d === "kiosk") return new Set();
  if (d === "ods") return new Set<StationAction>(["clock", "ods"]);
  if (d === "host") {
    const s = new Set<StationAction>(["clock", "floor", "waitlist", "seat", "togo", "pay", "bus_clean"]);
    if (hostMayOpenBarTabs(settings)) s.add("bar_tab");
    return s;
  }
  const s = new Set<StationAction>(["clock", "floor", "order_entry", "togo", "pay", "bus_clean", "seat"]);
  if (orderMayOpenBarTabs(settings)) s.add("bar_tab");
  return s;
}

/** What this PIN may use, before device envelope. */
export function employeeEnvelope(
  role: EmployeeRole | null | undefined,
  device: DeviceRole | null | undefined,
  settings?: StationCapSettings | null,
): Set<StationAction> {
  if (!role) return new Set();
  const d = device ?? "order";
  if (role === "owner" || role === "manager" || role === "supervisor") return new Set(ALL);
  if (role === "kitchen") return new Set<StationAction>(["clock", "ods"]);
  if (role === "busser") return new Set<StationAction>(["clock", "floor", "bus_clean"]);
  if (role === "host") {
    return new Set<StationAction>([
      "clock",
      "floor",
      "waitlist",
      "seat",
      "togo",
      "bar_tab",
      "order_entry",
      "pay",
    ]);
  }
  if (role === "server") {
    if (d === "host") {
      if (serversMayUseHostStand(settings)) {
        return new Set<StationAction>(["clock", "floor", "waitlist", "seat", "togo"]);
      }
      return new Set<StationAction>(["clock"]);
    }
    return new Set<StationAction>([
      "clock",
      "floor",
      "order_entry",
      "togo",
      "pay",
      "bar_tab",
      "seat",
    ]);
  }
  if (role === "bartender") {
    return new Set<StationAction>([
      "clock",
      "floor",
      "order_entry",
      "togo",
      "pay",
      "bar_tab",
      "ods",
    ]);
  }
  if (role === "cashier") {
    return new Set<StationAction>(["clock", "order_entry", "togo", "pay"]);
  }
  if (role === "vendor_operator") {
    return new Set<StationAction>(["clock", "ods", "order_entry", "togo"]);
  }
  return new Set<StationAction>(["clock"]);
}

export function stationActions(opts: StationCapInput): Set<StationAction> {
  const device = opts.deviceRole ?? "order";
  const d = deviceEnvelope(device, opts.settings);
  const e = employeeEnvelope(opts.employeeRole, device, opts.settings);
  const out = new Set<StationAction>();
  for (const a of d) {
    if (e.has(a)) out.add(a);
  }
  return out;
}

export function stationCan(opts: StationCapInput, action: StationAction): boolean {
  return stationActions(opts).has(action);
}

export function stationWorkActions(opts: StationCapInput): StationAction[] {
  return [...stationActions(opts)].filter((a) => a !== "clock");
}

export type StationPinFit =
  | { ok: true }
  | { ok: false; message: string; hint: string };

export function pinFitsDevice(opts: StationCapInput & { serversAtHostStand?: boolean }): StationPinFit {
  const settings: StationCapSettings = {
    ...capSettingsOf(opts.settings),
    serversAtHostStand:
      opts.serversAtHostStand ?? opts.settings?.serversAtHostStand,
  };
  const device = opts.deviceRole ?? "order";
  const role = opts.employeeRole;
  if (!role) {
    return {
      ok: false,
      message: "Sign in with a PIN.",
      hint: "This station waits for a staff PIN. Clock in is a separate control.",
    };
  }
  if (device === "kiosk") return { ok: true };

  const work = stationWorkActions({ deviceRole: device, employeeRole: role, settings });
  if (work.length > 0) return { ok: true };

  if (isBackOfHousePin(role)) {
    return {
      ok: false,
      message: "This tablet is not a kitchen display.",
      hint: "Clock in or out here, then use the kitchen display. This PIN cannot open to-go, a bar tab, or a table order.",
    };
  }
  if (device === "host" && role === "server") {
    return {
      ok: false,
      message: "This tablet is the host stand.",
      hint: "Use an order tablet. Clock in or out here if you need to punch.",
    };
  }
  if (device === "ods") {
    return {
      ok: false,
      message: "This tablet is a kitchen display.",
      hint: "Your PIN cannot run the rail. Use an order or host station. Clock in or out here if you need to punch.",
    };
  }
  return {
    ok: false,
    message: "This PIN cannot run this station.",
    hint: "Clock in or out here. Ask a manager if you need a different station.",
  };
}

export function denyReason(opts: StationCapInput, action: StationAction): string | null {
  if (stationCan(opts, action)) return null;
  const device = opts.deviceRole ?? "order";
  if (action === "bar_tab" && device === "host" && !hostMayOpenBarTabs(opts.settings)) {
    return "Host may open bar tabs is off.";
  }
  if (action === "bar_tab" && device === "order" && !orderMayOpenBarTabs(opts.settings)) {
    return "Bar tabs on order devices is off.";
  }
  if (action === "togo" && isBackOfHousePin(opts.employeeRole)) {
    return "Use the kitchen display.";
  }
  if (action === "order_entry" && device === "ods") {
    return "This display cannot open a new order.";
  }
  return "This PIN cannot do that on this tablet.";
}
