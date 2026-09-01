import type { SessionModeId } from "@/lib/lifecycle/types";
import type { DeviceFunction } from "@/lib/pos/location-devices";
import type { PosView } from "@/lib/pos/types";

/** Native / station device roles. PIN identifies the person; this is the screen. */
export const DEVICE_ROLES = ["order", "ods", "host"] as const;
export type DeviceRole = (typeof DEVICE_ROLES)[number];

export const DEVICE_ROLE_LABEL: Record<DeviceRole, string> = {
  order: "Order",
  ods: "Order Display",
  host: "Host",
};

export const DEVICE_ROLE_BLURB: Record<DeviceRole, string> = {
  order: "Order entry on handhelds and bar stations. Pay and gift when the PIN allows.",
  ods: "Kitchen tickets only — Start and Bump. No menu, no pay.",
  host: "Floor map, seat, table status, and to-go order entry.",
};

const SESSION_FOR_ROLE: Record<DeviceRole, SessionModeId> = {
  order: "cashier",
  ods: "kitchen_kds",
  host: "host_stand",
};

const VIEW_FOR_ROLE: Record<DeviceRole, PosView> = {
  order: "order",
  ods: "kitchen",
  host: "floor",
};

const STATION_ALIASES: Record<string, DeviceRole> = {
  order: "order",
  cashier: "order",
  bar_pos: "order",
  handheld: "order",
  ods: "ods",
  kitchen: "ods",
  bar: "ods",
  kds: "ods",
  expo: "ods",
  kitchen_kds: "ods",
  bar_kds: "ods",
  host: "host",
  floor: "host",
  waitlist: "host",
  host_stand: "host",
  busser: "host",
};

export function isDeviceRole(v: string | null | undefined): v is DeviceRole {
  return v === "order" || v === "ods" || v === "host";
}

export function parseStationQuery(raw: string | null | undefined): DeviceRole | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATION_ALIASES[key] ?? null;
}

export function sessionModeForDeviceRole(role: DeviceRole): SessionModeId {
  return SESSION_FOR_ROLE[role];
}

export function viewForDeviceRole(role: DeviceRole): PosView {
  return VIEW_FOR_ROLE[role];
}

export function deviceRoleFromSessionMode(kind: SessionModeId): DeviceRole {
  switch (kind) {
    case "kitchen_kds":
    case "bar_kds":
    case "expo":
      return "ods";
    case "host_stand":
    case "kiosk":
    case "busser":
      return "host";
    case "floor_pos":
    case "bar_pos":
    case "cashier":
    default:
      return "order";
  }
}

export function deviceRoleFromFunction(fn: DeviceFunction): DeviceRole {
  switch (fn) {
    case "kitchen_kds":
    case "bar_kds":
    case "expo":
    case "split":
      return "ods";
    case "host_stand":
    case "kiosk":
    case "busser":
      return "host";
    case "floor_pos":
    case "bar_pos":
    case "cashier":
    default:
      return "order";
  }
}

export function readStationDeviceRole(): DeviceRole | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStationQuery(new URLSearchParams(window.location.search).get("station"));
  } catch {
    return null;
  }
}

export function isStationPinPath(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const path = window.location.pathname;
    if (path === "/station" || path.startsWith("/station/")) return true;
    return readStationDeviceRole() != null;
  } catch {
    return false;
  }
}

const PIN_GATE_KEY = "summex-station-pin-gate";

/** True once this document session already showed the station PIN pad. */
export function consumeStationPinGate(): boolean {
  if (typeof window === "undefined") return false;
  if (!isStationPinPath()) return false;
  try {
    if (sessionStorage.getItem(PIN_GATE_KEY)) return false;
    sessionStorage.setItem(PIN_GATE_KEY, "1");
    return true;
  } catch {
    return true;
  }
}
