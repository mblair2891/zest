import type { SessionModeId } from "@/lib/lifecycle/types";
import type { DeviceFunction, LocationDeviceType } from "@/lib/pos/location-devices";
import type { PosView } from "@/lib/pos/types";
import { readStationPair } from "./station-pair";

/** Native / station device roles. PIN identifies the person; this is the screen. */
export const DEVICE_ROLES = ["order", "ods", "host", "kiosk"] as const;
export type DeviceRole = (typeof DEVICE_ROLES)[number];

export const DEVICE_ROLE_LABEL: Record<DeviceRole, string> = {
  order: "Order",
  ods: "Order Display",
  host: "Host",
  kiosk: "Kiosk",
};

export const DEVICE_ROLE_BLURB: Record<DeviceRole, string> = {
  order: "Order entry on handhelds and bar stations. Pay and gift when the PIN allows.",
  ods: "Kitchen tickets only — Start and Bump. No menu, no pay.",
  host: "Floor map, seat, table status, and to-go order entry.",
  kiosk: "Guest self-order. No staff PIN on the glass.",
};

const SESSION_FOR_ROLE: Record<DeviceRole, SessionModeId> = {
  order: "cashier",
  ods: "kitchen_kds",
  host: "host_stand",
  kiosk: "kiosk",
};

const VIEW_FOR_ROLE: Record<DeviceRole, PosView> = {
  order: "order",
  ods: "kitchen",
  host: "floor",
  kiosk: "waitlist",
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
  kiosk: "kiosk",
};

export function isDeviceRole(v: string | null | undefined): v is DeviceRole {
  return v === "order" || v === "ods" || v === "host" || v === "kiosk";
}

export function parseStationQuery(raw: string | null | undefined): DeviceRole | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATION_ALIASES[key] ?? null;
}

/** `/station/order` · `/station/ods` · `/station/host` (and aliases). */
export function parseStationPath(pathname: string | null | undefined): DeviceRole | null {
  if (!pathname) return null;
  const m = pathname.trim().match(/^\/station\/([^/]+)\/?$/);
  return m ? parseStationQuery(m[1]) : null;
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
    case "busser":
      return "host";
    case "kiosk":
      return "kiosk";
    case "floor_pos":
    case "bar_pos":
    case "cashier":
    default:
      return "order";
  }
}

export function functionForDeviceRole(role: DeviceRole): DeviceFunction {
  switch (role) {
    case "ods":
      return "kitchen_kds";
    case "host":
      return "host_stand";
    case "kiosk":
      return "kiosk";
    default:
      return "floor_pos";
  }
}

export function typeForDeviceRole(role: DeviceRole): LocationDeviceType {
  switch (role) {
    case "ods":
      return "kds";
    case "host":
      return "host_stand";
    case "kiosk":
      return "kiosk";
    default:
      return "tablet_pos";
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
    case "busser":
      return "host";
    case "kiosk":
      return "kiosk";
    case "floor_pos":
    case "bar_pos":
    case "cashier":
    default:
      return "order";
  }
}

export {
  PAIRED_ROLE_LABEL,
  confirmPairedRoleChange,
  functionForPairedRole,
  listPairedRoleOptions,
  locationHasDualOds,
  locationHasKioskRole,
  pairedRoleFromFunction,
  typeForPairedRole,
  type PairedStationRole,
} from "./paired-station-role";

export function readStationDeviceRole(): DeviceRole | null {
  if (typeof window === "undefined") return null;
  try {
    const fromPath = parseStationPath(window.location.pathname);
    if (fromPath) return fromPath;
    const fromQuery = parseStationQuery(new URLSearchParams(window.location.search).get("station"));
    if (fromQuery) return fromQuery;
    return readStationPair()?.station ?? null;
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
