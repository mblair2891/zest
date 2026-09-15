import type { Employee, EmployeeRole, PosView } from "./types";
import { HOST_SCOPE } from "@/lib/access/entity-grants";

export type LocationDeviceType =
  | "tablet_pos"
  | "kds"
  | "kiosk"
  | "printer"
  | "receipt_printer"
  | "kitchen_printer"
  | "bar_printer"
  | "label_printer"
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
export type PrintStation = "kitchen" | "bar" | "receipt" | "expo" | "label";
export type PrinterLink = "wifi" | "ethernet";
export type PrinterModelPreset =
  | "epson_tm_t20"
  | "epson_tm_t88"
  | "epson_tm_m30"
  | "epson_tm_u220"
  | "generic_escpos";
export type PrinterDrawerKick = "none" | "attached";
export type PrintRoute = "receipts" | "kitchen_tickets" | "bar_tickets" | "labels";
export type PrinterReachability = "unreachable" | "idle" | "last_print";

export type PrinterConfig = {
  family: PrinterFamily;
  connection: PrinterConnection;
  /** LAN host:port (default :9100) or Bluetooth address. Empty for browser fallback. */
  target: string;
  station: PrintStation;
  link?: PrinterLink;
  ip?: string;
  port?: number;
  modelPreset?: PrinterModelPreset;
  drawerKick?: PrinterDrawerKick;
  routes?: PrintRoute[];
  boundStationIds?: string[];
  lastPrintAt?: number;
  reachability?: PrinterReachability;
};

export const PRINTER_FAMILIES: PrinterFamily[] = ["star", "epson", "generic"];
export const PRINTER_CONNECTIONS: PrinterConnection[] = ["lan", "bluetooth", "browser"];
export const PRINT_STATIONS: PrintStation[] = ["kitchen", "bar", "receipt", "expo", "label"];
export const PRINTER_LINKS: PrinterLink[] = ["ethernet", "wifi"];
export const PRINTER_MODEL_PRESETS: PrinterModelPreset[] = [
  "epson_tm_t20",
  "epson_tm_t88",
  "epson_tm_m30",
  "epson_tm_u220",
  "generic_escpos",
];
export const PRINT_ROUTES: PrintRoute[] = [
  "receipts",
  "kitchen_tickets",
  "bar_tickets",
  "labels",
];

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

export const PRINTER_LINK_LABEL: Record<PrinterLink, string> = {
  ethernet: "Ethernet",
  wifi: "Wi-Fi",
};

export const PRINTER_MODEL_LABEL: Record<PrinterModelPreset, string> = {
  epson_tm_t20: "Epson TM-T20",
  epson_tm_t88: "Epson TM-T88",
  epson_tm_m30: "Epson TM-m30",
  epson_tm_u220: "Epson TM-U220",
  generic_escpos: "Generic ESC/POS",
};

export const PRINT_STATION_LABEL: Record<PrintStation, string> = {
  kitchen: "Kitchen tickets",
  bar: "Bar tickets",
  receipt: "Guest receipt",
  expo: "Expo / bump chit",
  label: "Labels",
};

export const PRINT_ROUTE_LABEL: Record<PrintRoute, string> = {
  receipts: "Receipts",
  kitchen_tickets: "Kitchen tickets",
  bar_tickets: "Bar tickets",
  labels: "Labels",
};

export const PRINTER_DEVICE_TYPES: LocationDeviceType[] = [
  "printer",
  "receipt_printer",
  "kitchen_printer",
  "bar_printer",
  "label_printer",
];

export function isPrinterType(type: string | null | undefined): boolean {
  return PRINTER_DEVICE_TYPES.includes(type as LocationDeviceType);
}

export function isPrinterDevice(d: { type: string } | null | undefined): boolean {
  return Boolean(d && isPrinterType(d.type));
}

export type DeviceRoleChange = {
  at: number;
  actorName: string;
  deviceId: string;
  deviceLabel: string;
  from: string;
  to: string;
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
  /** Station tablet → guest receipt printer. Empty = venue default receipt printer. */
  receiptPrinterId?: string | null;
  /** Owner asked the idle PIN pad to take the new role now. */
  applyRoleNow?: boolean;
  roleRevision?: number;
  /** Epoch ms when the one-time pair code dies. */
  claimExpiresAt?: number;
};

export const DEVICE_TYPES: LocationDeviceType[] = [
  "tablet_pos",
  "kds",
  "kiosk",
  "printer",
  "receipt_printer",
  "kitchen_printer",
  "bar_printer",
  "label_printer",
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

export const HARDWARE_DEVICE_TYPES: LocationDeviceType[] = [
  "terminal",
  "printer",
  "receipt_printer",
  "kitchen_printer",
  "bar_printer",
  "label_printer",
];

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
  tablet_pos: "Order tablet",
  kds: "Order display",
  kiosk: "Kiosk",
  printer: "Printer",
  receipt_printer: "Receipt printer",
  kitchen_printer: "Kitchen printer",
  bar_printer: "Bar printer",
  label_printer: "Label printer",
  host_stand: "Host tablet",
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
  let type: LocationDeviceType =
    typeRaw === "pos" || typeRaw === "handheld"
      ? "tablet_pos"
      : DEVICE_TYPES.includes(typeRaw as LocationDeviceType)
        ? (typeRaw as LocationDeviceType)
        : "other";
  const print = isPrinterType(type) ? parsePrinterConfig(o.print ?? o) : undefined;
  if (isPrinterType(type)) type = printerTypeFromStation(type, print?.station);
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
    claimCode: isPrinterType(type) ? undefined : o.claimCode ? String(o.claimCode) : undefined,
    assignment,
    print,
    receiptPrinterId:
      isPrinterType(type)
        ? undefined
        : o.receiptPrinterId
          ? String(o.receiptPrinterId).trim().slice(0, 80)
          : null,
    applyRoleNow: o.applyRoleNow === true,
    roleRevision: Number(o.roleRevision) > 0 ? Math.round(Number(o.roleRevision)) : undefined,
    claimExpiresAt:
      Number(o.claimExpiresAt) > 0 ? Math.round(Number(o.claimExpiresAt)) : undefined,
  };
}

export function isPairedActivatedStation(d: LocationDevice): boolean {
  if (isPrinterType(d.type) || d.type === "terminal") return false;
  return d.status === "online" || d.status === "offline";
}

export function printerTypeFromStation(
  type: LocationDeviceType,
  station?: PrintStation,
): LocationDeviceType {
  if (type === "receipt_printer" || type === "kitchen_printer" || type === "bar_printer" || type === "label_printer") {
    return type;
  }
  if (station === "kitchen") return "kitchen_printer";
  if (station === "bar") return "bar_printer";
  if (station === "label") return "label_printer";
  return "receipt_printer";
}

export function stationFromPrinterType(type: LocationDeviceType): PrintStation {
  if (type === "kitchen_printer") return "kitchen";
  if (type === "bar_printer") return "bar";
  if (type === "label_printer") return "label";
  return "receipt";
}

export function defaultRoutesForPrinterType(type: LocationDeviceType): PrintRoute[] {
  if (type === "kitchen_printer") return ["kitchen_tickets"];
  if (type === "bar_printer") return ["bar_tickets"];
  if (type === "label_printer") return ["labels"];
  return ["receipts"];
}

export function routeForPrintStation(station: PrintStation): PrintRoute {
  if (station === "kitchen") return "kitchen_tickets";
  if (station === "bar") return "bar_tickets";
  if (station === "label" || station === "expo") return "labels";
  return "receipts";
}

export function familyFromModelPreset(preset: PrinterModelPreset): PrinterFamily {
  return preset === "generic_escpos" ? "generic" : "epson";
}

export function modelPresetFromFamily(family: PrinterFamily, station?: PrintStation): PrinterModelPreset {
  if (family === "generic") return "generic_escpos";
  if (station === "kitchen") return "epson_tm_u220";
  return "epson_tm_t20";
}

export function printerHasDrawerKick(d: LocationDevice): boolean {
  if (!isPrinterDevice(d) || !d.print) return false;
  if (d.print.drawerKick === "attached") return true;
  if (d.print.drawerKick === "none") return false;
  return d.print.station === "receipt" || d.type === "receipt_printer" || d.type === "printer";
}

export function printerStatusLabel(
  d: LocationDevice,
): "pending" | "unreachable" | "idle" | "last-print" | LocationDeviceStatus {
  if (!isPrinterDevice(d)) return d.status;
  if (d.status === "inactive") return "inactive";
  const ip = (d.print?.ip || d.print?.target || "").trim();
  if (!ip) return "pending";
  if (d.print?.reachability === "unreachable") return "unreachable";
  if (d.print?.lastPrintAt) return "last-print";
  return "idle";
}

export function parsePrinterConfig(raw: unknown): PrinterConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const presetRaw = String(o.modelPreset ?? "");
  const modelPreset: PrinterModelPreset | undefined = PRINTER_MODEL_PRESETS.includes(
    presetRaw as PrinterModelPreset,
  )
    ? (presetRaw as PrinterModelPreset)
    : undefined;
  const familyRaw = String(o.family ?? o.printerFamily ?? (modelPreset ? familyFromModelPreset(modelPreset) : "generic"));
  const family: PrinterFamily = PRINTER_FAMILIES.includes(familyRaw as PrinterFamily)
    ? (familyRaw as PrinterFamily)
    : "generic";
  const linkRaw = String(o.link ?? "");
  const link: PrinterLink | undefined = PRINTER_LINKS.includes(linkRaw as PrinterLink)
    ? (linkRaw as PrinterLink)
    : undefined;
  const connRaw = String(o.connection ?? o.printerConnection ?? (link ? "lan" : "lan"));
  const connection: PrinterConnection = PRINTER_CONNECTIONS.includes(connRaw as PrinterConnection)
    ? (connRaw as PrinterConnection)
    : "lan";
  const stRaw = String(o.station ?? o.printStation ?? "");
  const station: PrintStation = PRINT_STATIONS.includes(stRaw as PrintStation)
    ? (stRaw as PrintStation)
    : "receipt";
  const ip = String(o.ip ?? "").trim().slice(0, 45);
  const portNum = Number(o.port);
  const port = portNum > 0 && portNum < 65536 ? Math.round(portNum) : 9100;
  const targetRaw = String(o.target ?? o.printerTarget ?? "").trim().slice(0, 120);
  const target =
    targetRaw ||
    (ip ? `${ip}:${port}` : "");
  const ipFromTarget = !ip && target.includes(":") ? target.split(":")[0] : ip;
  const routesRaw = Array.isArray(o.routes) ? o.routes : [];
  const routes = routesRaw
    .map((r) => String(r))
    .filter((r): r is PrintRoute => PRINT_ROUTES.includes(r as PrintRoute));
  const bound = Array.isArray(o.boundStationIds)
    ? o.boundStationIds.map((x) => String(x).trim()).filter(Boolean).slice(0, 40)
    : [];
  const kickRaw = String(o.drawerKick ?? "");
  const drawerKick: PrinterDrawerKick | undefined =
    kickRaw === "attached" || kickRaw === "none" ? kickRaw : undefined;
  const reachRaw = String(o.reachability ?? "");
  const reachability: PrinterReachability | undefined =
    reachRaw === "unreachable" || reachRaw === "idle" || reachRaw === "last_print"
      ? reachRaw
      : undefined;
  return {
    family,
    connection,
    station,
    target,
    link: link ?? (connection === "lan" ? "ethernet" : undefined),
    ip: ipFromTarget || undefined,
    port,
    modelPreset: modelPreset ?? modelPresetFromFamily(family, station),
    drawerKick: drawerKick ?? (station === "receipt" ? "attached" : "none"),
    routes: routes.length ? routes : [routeForPrintStation(station)],
    boundStationIds: bound,
    lastPrintAt: Number(o.lastPrintAt) > 0 ? Math.round(Number(o.lastPrintAt)) : undefined,
    reachability,
  };
}

export function pendingPrinterDevice(opts: {
  id: string;
  locationId: string;
  label: string;
  kind: "receipt" | "kitchen" | "bar" | "label";
  operatorId?: string;
}): LocationDevice {
  const type: LocationDeviceType =
    opts.kind === "kitchen"
      ? "kitchen_printer"
      : opts.kind === "bar"
        ? "bar_printer"
        : opts.kind === "label"
          ? "label_printer"
          : "receipt_printer";
  const station = stationFromPrinterType(type);
  return {
    id: opts.id,
    locationId: opts.locationId,
    label: opts.label,
    type,
    status: "pending",
    lastSeenAt: Date.now(),
    assignment: {
      operatorId: opts.operatorId || HOST_SCOPE,
      function: defaultFunctionForType(type),
    },
    print: {
      family: opts.kind === "kitchen" ? "epson" : "epson",
      connection: "lan",
      target: "",
      station,
      link: "ethernet",
      ip: "",
      port: 9100,
      modelPreset: opts.kind === "kitchen" ? "epson_tm_u220" : "epson_tm_t20",
      drawerKick: opts.kind === "receipt" ? "attached" : "none",
      routes: defaultRoutesForPrinterType(type),
      boundStationIds: [],
    },
  };
}

export function defaultOnboardingPrinters(locationId: string): LocationDevice[] {
  return [
    pendingPrinterDevice({
      id: `prn_${locationId || "loc"}_receipt`,
      locationId,
      label: "Receipt printer",
      kind: "receipt",
    }),
    pendingPrinterDevice({
      id: `prn_${locationId || "loc"}_kitchen`,
      locationId,
      label: "Kitchen printer",
      kind: "kitchen",
    }),
    pendingPrinterDevice({
      id: `prn_${locationId || "loc"}_bar`,
      locationId,
      label: "Bar printer",
      kind: "bar",
    }),
  ];
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
    case "receipt_printer":
      return "cashier";
    case "kitchen_printer":
      return "kitchen_kds";
    case "bar_printer":
      return "bar_kds";
    case "label_printer":
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
    case "label":
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
