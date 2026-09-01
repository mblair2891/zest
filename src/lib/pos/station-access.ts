import type { Employee } from "./types";
import type { Vendor } from "./types";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import type { SessionModeId } from "@/lib/lifecycle/types";
import {
  DEVICE_ROLE_LABEL,
  deviceRoleFromSessionMode,
  sessionModeForDeviceRole,
  type DeviceRole,
} from "@/lib/pos/device-roles";

/** Change-device kinds — only the three device roles. */
export const DEVICE_ROLE_KINDS: SessionModeId[] = [
  sessionModeForDeviceRole("order"),
  sessionModeForDeviceRole("ods"),
  sessionModeForDeviceRole("host"),
];

export const STATION_KIND_LABEL: Record<SessionModeId, string> = {
  floor_pos: DEVICE_ROLE_LABEL.order,
  host_stand: DEVICE_ROLE_LABEL.host,
  kitchen_kds: DEVICE_ROLE_LABEL.ods,
  bar_kds: DEVICE_ROLE_LABEL.ods,
  expo: DEVICE_ROLE_LABEL.ods,
  cashier: DEVICE_ROLE_LABEL.order,
  bar_pos: DEVICE_ROLE_LABEL.order,
  kiosk: DEVICE_ROLE_LABEL.host,
  busser: DEVICE_ROLE_LABEL.host,
};

export const STATION_GROUPS: Array<{
  id: DeviceRole;
  label: string;
  kinds: SessionModeId[];
}> = [
  { id: "order", label: DEVICE_ROLE_LABEL.order, kinds: [sessionModeForDeviceRole("order")] },
  { id: "ods", label: DEVICE_ROLE_LABEL.ods, kinds: [sessionModeForDeviceRole("ods")] },
  { id: "host", label: DEVICE_ROLE_LABEL.host, kinds: [sessionModeForDeviceRole("host")] },
];

const ALL_KINDS: SessionModeId[] = [...DEVICE_ROLE_KINDS];

export function canChangeDevice(emp: Employee | null | undefined): boolean {
  return emp?.role === "owner" || emp?.role === "manager";
}

export function stationsAllowedForEmployee(
  emp: Employee | null | undefined,
  _opts?: { training?: boolean },
): SessionModeId[] {
  if (emp?.role === "owner" || emp?.role === "manager") return ALL_KINDS;
  return [];
}

export function deviceRolesAllowedForEmployee(
  emp: Employee | null | undefined,
): DeviceRole[] {
  return stationsAllowedForEmployee(emp).map(deviceRoleFromSessionMode);
}

export type StationEntityOption = { id: string; name: string };

export function entitiesAllowedForEmployee(
  emp: Employee | null | undefined,
  vendors: Vendor[],
  hostName: string,
): StationEntityOption[] {
  const host: StationEntityOption = { id: HOST_SCOPE, name: hostName || "Host" };
  const ops = vendors.filter((v) => v.active).map((v) => ({ id: v.id, name: v.name }));
  if (!emp || emp.role === "owner" || emp.role === "manager" || emp.role === "host") {
    return [host, ...ops];
  }
  if (emp.operatorId) {
    const mine = ops.filter((o) => o.id === emp.operatorId);
    return mine.length ? mine : [host, ...ops];
  }
  return [host, ...ops];
}

export function stationKindLabel(kind: SessionModeId): string {
  return STATION_KIND_LABEL[kind] ?? kind;
}

export function isOdsKind(kind: SessionModeId): boolean {
  return kind === "kitchen_kds" || kind === "bar_kds" || kind === "expo";
}
