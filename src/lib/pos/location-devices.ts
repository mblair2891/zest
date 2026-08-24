import type { Employee, EmployeeRole, PosView } from "./types";
import { HOST_SCOPE } from "@/lib/access/entity-grants";

export type LocationDeviceType =
  | "tablet_pos"
  | "kds"
  | "kiosk"
  | "printer"
  | "host_stand"
  | "other";

export type DeviceFunction =
  | "floor_pos"
  | "bar_pos"
  | "kitchen_kds"
  | "bar_kds"
  | "expo"
  | "kiosk"
  | "host_stand"
  | "cashier";

export type DeviceAssignment = {
  operatorId: string;
  function: DeviceFunction;
};

export type LocationDevice = {
  id: string;
  locationId: string;
  label: string;
  type: LocationDeviceType;
  status: "online" | "offline" | "pending";
  lastSeenAt: number;
  serial?: string;
  claimCode?: string;
  assignment: DeviceAssignment;
};

export const DEVICE_TYPES: LocationDeviceType[] = [
  "tablet_pos",
  "kds",
  "kiosk",
  "printer",
  "host_stand",
  "other",
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
];

export const DEVICE_TYPE_LABEL: Record<LocationDeviceType, string> = {
  tablet_pos: "Tablet POS",
  kds: "KDS display",
  kiosk: "Kiosk",
  printer: "Printer",
  host_stand: "Host stand",
  other: "Other",
};

export const DEVICE_FUNCTION_LABEL: Record<DeviceFunction, string> = {
  floor_pos: "Floor POS",
  bar_pos: "Bar POS",
  kitchen_kds: "Kitchen KDS",
  bar_kds: "Bar KDS",
  expo: "Expo",
  kiosk: "Kiosk",
  host_stand: "Host stand",
  cashier: "Cashier",
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
    typeRaw === "pos" || typeRaw === "handheld" || typeRaw === "terminal"
      ? "tablet_pos"
      : DEVICE_TYPES.includes(typeRaw as LocationDeviceType)
        ? (typeRaw as LocationDeviceType)
        : "other";
  const assignment =
    parseDeviceAssignment(o.assignment) ?? {
      operatorId: HOST_SCOPE,
      function: defaultFunctionForType(type),
    };
  const status =
    o.status === "online" || o.status === "offline" || o.status === "pending"
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
  };
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
      return "kitchen";
    case "bar_kds":
    case "bar_pos":
      return "bar";
    case "host_stand":
      return "waitlist";
    case "cashier":
      return "order";
    case "floor_pos":
    default:
      return "floor";
  }
}

export function stationForDeviceFunction(
  fn: DeviceFunction,
): "kitchen" | "bar" | null {
  if (fn === "kitchen_kds" || fn === "expo") return "kitchen";
  if (fn === "bar_kds" || fn === "bar_pos") return "bar";
  return null;
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
