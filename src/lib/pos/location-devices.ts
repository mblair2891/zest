import type { Employee, EmployeeRole, PosView } from "./types";
import { HOST_SCOPE } from "@/lib/access/entity-grants";

export type LocationDeviceType =
  | "tablet_pos"
  | "kds"
  | "kiosk"
  | "printer"
  | "host_stand"
  | "terminal"
  | "other";

export type DeviceFunction =
  | "floor_pos"
  | "bar_pos"
  | "kitchen_kds"
  | "bar_kds"
  | "expo"
  | "kiosk"
  | "host_stand"
  | "cashier"
  | "busser"
  | "split";

export type DeviceAssignment = {
  operatorId: string;
  function: DeviceFunction;
};

export type LocationDeviceStatus = "online" | "offline" | "pending" | "inactive";

export type PrinterFamily = "star" | "epson" | "generic";
export type PrinterConnection = "lan" | "bluetooth" | "browser";
export type PrintStation = "kitchen" | "bar" | "receipt" | "expo";

export type PrinterConfig = {
  family: PrinterFamily;
  connection: PrinterConnection;
  /** LAN host:port (default :9100) or Bluetooth address. Empty for browser fallback. */
  target: string;
  station: PrintStation;
};

export const PRINTER_FAMILIES: PrinterFamily[] = ["star", "epson", "generic"];
export const PRINTER_CONNECTIONS: PrinterConnection[] = ["lan", "bluetooth", "browser"];
export const PRINT_STATIONS: PrintStation[] = ["kitchen", "bar", "receipt", "expo"];

export const PRINTER_FAMILY_LABEL: Record<PrinterFamily, string> = {
  star: "Star Micronics",
  epson: "Epson",
  generic: "Generic ESC/POS",
};

export const PRINTER_CONNECTION_LABEL: Record<PrinterConnection, string> = {
  lan: "LAN (Ethernet / Wi‑Fi)",
  bluetooth: "Bluetooth",
  browser: "This browser (window.print)",
};

export const PRINT_STATION_LABEL: Record<PrintStation, string> = {
  kitchen: "Kitchen tickets",
  bar: "Bar tickets",
  receipt: "Guest receipt",
  expo: "Expo / bump chit",
};

export type LocationDevice = {
  id: string;
  locationId: string;
  label: string;
  type: LocationDeviceType;
  status: LocationDeviceStatus;
  lastSeenAt: number;
  serial?: string;
  claimCode?: string;
  assignment: DeviceAssignment;
  print?: PrinterConfig;
};

export const DEVICE_TYPES: LocationDeviceType[] = [
  "tablet_pos",
  "kds",
  "kiosk",
  "printer",
  "host_stand",
  "terminal",
  "other",
];

export const STATION_DEVICE_TYPES: LocationDeviceType[] = [
  "tablet_pos",
  "kds",
  "kiosk",
  "host_stand",
  "other",
];

export const HARDWARE_DEVICE_TYPES: LocationDeviceType[] = ["terminal", "printer"];

export const DEVICE_FUNCTIONS: DeviceFunction[] = [
  "floor_pos",
  "bar_pos",
  "kitchen_kds",
  "bar_kds",
  "expo",
  "kiosk",
  "host_stand",
  "cashier",
  "busser",
  "split",
];

export const STATION_DEVICE_FUNCTIONS: DeviceFunction[] = [
  "floor_pos",
  "host_stand",
  "kitchen_kds",
  "bar_kds",
  "split",
  "cashier",
  "expo",
  "busser",
  "bar_pos",
  "kiosk",
];

export const DEVICE_TYPE_LABEL: Record<LocationDeviceType, string> = {
  tablet_pos: "Tablet",
  kds: "Order display",
  kiosk: "Kiosk",
  printer: "Printer",
  host_stand: "Host stand",
  terminal: "Terminal",
  other: "Other",
};

export const DEVICE_FUNCTION_LABEL: Record<DeviceFunction, string> = {
  floor_pos: "Order",
  bar_pos: "Order",
  kitchen_kds: "Order Display",
  bar_kds: "Order Display",
  expo: "Order Display",
  kiosk: "Host",
  host_stand: "Host",
  cashier: "Order",
  busser: "Host",
  split: "Split display",
};

export function parseDeviceAssignment(raw: unknown): DeviceAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const operatorId = String(o.operatorId ?? "").trim() || HOST_SCOPE;
  const fn = String(o.function ?? "").trim() as DeviceFunction;
  if (!DEVICE_FUNCTIONS.includes(fn)) return null;
  return { operatorId, function: fn };
}

export function parseLocationDevice(raw: unknown): LocationDevice | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const label = String(o.label ?? o.name ?? "").trim();
  if (!id || !label) return null;
  const typeRaw = String(o.type ?? "other");
  const type: LocationDeviceType =
    typeRaw === "pos" || typeRaw === "handheld"
      ? "tablet_pos"
      : DEVICE_TYPES.includes(typeRaw as LocationDeviceType)
        ? (typeRaw as LocationDeviceType)
        : "other";
  const assignment =
    parseDeviceAssignment(o.assignment) ?? {
      operatorId: HOST_SCOPE,
      function: defaultFunctionForType(type),
    };
  const status: LocationDeviceStatus =
    o.status === "online" ||
    o.status === "offline" ||
    o.status === "pending" ||
    o.status === "inactive"
      ? o.status
      : "pending";
  return {
    id,
    locationId: String(o.locationId ?? "").trim(),
    label,
    type,
    status,
    lastSeenAt: Number(o.lastSeenAt) || Date.now(),
    serial: o.serial ? String(o.serial) : undefined,
    claimCode: o.claimCode ? String(o.claimCode) : undefined,
    assignment,
    print: type === "printer" ? parsePrinterConfig(o.print ?? o) : undefined,
  };
}

export function parsePrinterConfig(raw: unknown): PrinterConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const familyRaw = String(o.family ?? o.printerFamily ?? "generic");
  const family: PrinterFamily = PRINTER_FAMILIES.includes(familyRaw as PrinterFamily)
    ? (familyRaw as PrinterFamily)
    : "generic";
  const connRaw = String(o.connection ?? o.printerConnection ?? "browser");
  const connection: PrinterConnection = PRINTER_CONNECTIONS.includes(connRaw as PrinterConnection)
    ? (connRaw as PrinterConnection)
    : "browser";
  const stRaw = String(o.station ?? o.printStation ?? "");
  const station: PrintStation = PRINT_STATIONS.includes(stRaw as PrintStation)
    ? (stRaw as PrintStation)
    : "receipt";
  const target = String(o.target ?? o.printerTarget ?? o.ip ?? "").trim().slice(0, 120);
  return { family, connection, station, target };
}

export function parseLocationDevices(raw: unknown): LocationDevice[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseLocationDevice).filter((d): d is LocationDevice => !!d);
}

export function defaultFunctionForType(type: LocationDeviceType): DeviceFunction {
  switch (type) {
    case "kds":
      return "kitchen_kds";
    case "kiosk":
      return "kiosk";
    case "host_stand":
      return "host_stand";
    case "printer":
      return "expo";
    case "terminal":
      return "cashier";
    default:
      return "floor_pos";
  }
}

export function makeClaimCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function viewForDeviceFunction(fn: DeviceFunction): PosView | "kiosk" {
  switch (fn) {
    case "kiosk":
      return "kiosk";
    case "kitchen_kds":
    case "expo":
    case "split":
      return "kitchen";
    case "bar_kds":
      return "kitchen";
    case "host_stand":
    case "busser":
      return "floor";
    case "cashier":
    case "bar_pos":
    case "floor_pos":
    default:
      return "order";
  }
}

export function stationForDeviceFunction(
  fn: DeviceFunction,
): "kitchen" | "bar" | null {
  if (fn === "kitchen_kds" || fn === "expo" || fn === "split") return "kitchen";
  if (fn === "bar_kds" || fn === "bar_pos") return "bar";
  return null;
}

export function functionForPrintStation(station: PrintStation): DeviceFunction {
  switch (station) {
    case "kitchen":
      return "kitchen_kds";
    case "bar":
      return "bar_kds";
    case "expo":
      return "expo";
    case "receipt":
    default:
      return "cashier";
  }
}

export function browserDeviceStorageKey(locationId: string): string {
  return `summex-browser-device:${locationId || "loc"}`;
}

export const BROWSER_DEVICE_GLOBAL_KEY = "summex-browser-device-id";

export function pairedDeviceStorageKey(locationId: string): string {
  return `summex-paired-device:${locationId || "loc"}`;
}

export function readPairedDeviceId(locationId: string): string | null {
  try {
    const v = localStorage.getItem(pairedDeviceStorageKey(locationId));
    return v && v.startsWith("dev_") ? v : null;
  } catch {
    return null;
  }
}

export function writePairedDeviceId(locationId: string, deviceId: string): void {
  if (!deviceId) return;
  try {
    localStorage.setItem(pairedDeviceStorageKey(locationId), deviceId);
  } catch {
    /* private mode */
  }
}

export function readOrCreateBrowserDeviceId(locationId: string): string {
  const key = browserDeviceStorageKey(locationId);
  try {
    let global = localStorage.getItem(BROWSER_DEVICE_GLOBAL_KEY);
    if (!global || !global.startsWith("dev_")) {
      global = `dev_browser_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
      localStorage.setItem(BROWSER_DEVICE_GLOBAL_KEY, global);
    }
    const existing = localStorage.getItem(key);
    if (existing && existing.startsWith("dev_")) return existing;
    localStorage.setItem(key, global);
    return global;
  } catch {
    return `dev_browser_${Date.now().toString(36)}`;
  }
}

export function findPairedDevice(
  devices: LocationDevice[],
  locationId: string,
): LocationDevice | undefined {
  const browserId = readOrCreateBrowserDeviceId(locationId);
  const paired = readPairedDeviceId(locationId);
  return (
    devices.find((d) => d.id === paired) ||
    devices.find((d) => d.id === browserId) ||
    devices.find((d) => d.serial === browserId)
  );
}

export function pickStaffForAssignment(
  employees: Employee[],
  assignment: DeviceAssignment,
): Employee | undefined {
  const active = employees.filter((e) => e.active);
  const op = assignment.operatorId;
  const byOp = (role: EmployeeRole) =>
    active.find((e) => e.role === role && (op === HOST_SCOPE ? !e.operatorId : e.operatorId === op));
  switch (assignment.function) {
    case "kiosk":
      return byOp("kiosk") ?? active.find((e) => e.role === "kiosk");
    case "host_stand":
      return byOp("host") ?? active.find((e) => e.role === "host") ?? byOp("owner");
    case "cashier":
      return byOp("cashier") ?? active.find((e) => e.role === "cashier");
    case "bar_kds":
    case "bar_pos":
      return (
        byOp("bartender") ??
        byOp("vendor_operator") ??
        active.find((e) => e.role === "bartender")
      );
    case "kitchen_kds":
    case "expo":
      return (
        byOp("kitchen") ??
        byOp("vendor_operator") ??
        active.find((e) => e.role === "kitchen")
      );
    case "busser":
      return byOp("busser") ?? active.find((e) => e.role === "busser") ?? byOp("server");
    case "split":
    case "floor_pos":
    default:
      return (
        byOp("vendor_operator") ??
        byOp("server") ??
        byOp("owner") ??
        active[0]
      );
  }
}

export function assignmentLabel(
  device: LocationDevice,
  operatorName: (id: string) => string,
): string {
  return `${device.label} · ${operatorName(device.assignment.operatorId)} · ${DEVICE_FUNCTION_LABEL[device.assignment.function]}`;
}
