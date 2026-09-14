/**
 * After PIN, home is device role ∩ staff role ∩ venue service style.
 * Kitchen PIN on an order tablet is gated elsewhere (station-pin-gate).
 */
import type { DeviceRole } from "./device-roles";
import type { EmployeeRole, PosView } from "./types";

type HomeSettings = {
  hostMayOpenBarTabs?: boolean;
  serversAtHostStand?: boolean;
  orderMayOpenBarTabs?: boolean;
};

export const STATION_SERVICE_STYLES = [
  "full_service",
  "counter",
  "hybrid",
  "drive_through",
] as const;
export type StationServiceStyle = (typeof STATION_SERVICE_STYLES)[number];

export type StationHomeSurface =
  | "floor"
  | "queue"
  | "drive_through"
  | "ods"
  | "kiosk"
  | "host";

export function parseStationServiceStyle(raw: unknown): StationServiceStyle | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (s === "counter" || s === "qsr" || s === "cafe" || s === "café") return "counter";
  if (s === "hybrid" || s === "mixed" || s === "hall") return "hybrid";
  if (
    s === "drive_through" ||
    s === "drive" ||
    s === "dt" ||
    s === "lane" ||
    s === "window"
  ) {
    return "drive_through";
  }
  if (
    s === "full_service" ||
    s === "table_service" ||
    s === "dining" ||
    s === "full"
  ) {
    return "full_service";
  }
  return null;
}

export function resolveStationServiceStyle(opts: {
  serviceStyle?: string | null;
  operatingModel?: string | null;
  hasFloor?: boolean;
}): StationServiceStyle {
  const explicit = parseStationServiceStyle(opts.serviceStyle);
  if (explicit) return explicit;
  if (opts.operatingModel === "host_operators") return "hybrid";
  if (opts.hasFloor) return "full_service";
  return "counter";
}

export function locationHasFloor(opts: {
  tableCount?: number;
  sectionCount?: number;
  floorLater?: boolean;
}): boolean {
  if (opts.floorLater) return false;
  return (opts.tableCount ?? 0) > 0 || (opts.sectionCount ?? 0) > 0;
}

/** Order / host glass after PIN. ODS and kiosk ignore service style. */
export function stationHomeSurface(opts: {
  deviceRole: DeviceRole | null | undefined;
  employeeRole?: EmployeeRole | null;
  serviceStyle?: string | null;
  operatingModel?: string | null;
  hasFloor?: boolean;
  settings?: HomeSettings | null;
}): StationHomeSurface {
  const device = opts.deviceRole ?? "order";
  if (device === "kiosk") return "kiosk";
  if (device === "ods") return "ods";

  const style = resolveStationServiceStyle({
    serviceStyle: opts.serviceStyle,
    operatingModel: opts.operatingModel,
    hasFloor: opts.hasFloor,
  });

  const role = opts.employeeRole;
  const canFloor =
    !role ||
    (role !== "kitchen" &&
      role !== "cashier" &&
      role !== "accountant" &&
      role !== "kiosk");
  const canQueue =
    !role ||
    (role !== "kitchen" && role !== "busser" && role !== "accountant" && role !== "kiosk");

  if (device === "host") {
    if (style === "drive_through") return "drive_through";
    return "host";
  }

  if (style === "drive_through") return "drive_through";
  if (style === "counter") return "queue";
  if (style === "full_service" || (style === "hybrid" && opts.hasFloor)) {
    if (canFloor) return "floor";
    if (canQueue) return "queue";
    return "floor";
  }
  if (style === "hybrid") return opts.hasFloor && canFloor ? "floor" : "queue";
  return opts.hasFloor && canFloor ? "floor" : "queue";
}

/** PosView used for nav highlight. Bartender still lists order; the glass is the floor. */
export function viewForStationHome(
  surface: StationHomeSurface,
  employeeRole?: EmployeeRole | null,
): PosView {
  if (surface === "ods") return employeeRole === "bartender" ? "bar" : "kitchen";
  if (surface === "kiosk") return "waitlist";
  if (surface === "host") return "floor";
  if (surface === "floor") return "floor";
  if (surface === "drive_through") return "order";
  return "order";
}
