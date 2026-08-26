import type { Employee } from "./types";
import type { Vendor } from "./types";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { SESSION_MODES, type SessionModeId } from "@/lib/lifecycle/types";

export const STATION_KIND_LABEL: Record<SessionModeId, string> = {
  floor_pos: "Server",
  host_stand: "Host",
  kitchen_kds: "Kitchen ODS",
  bar_kds: "Bar ODS",
  expo: "Expo",
  cashier: "Cashier",
  bar_pos: "Bar POS",
  kiosk: "Kiosk",
  busser: "Busser",
};

export const STATION_GROUPS: Array<{
  id: "floor" | "ods";
  label: string;
  kinds: SessionModeId[];
}> = [
  {
    id: "floor",
    label: "Stations",
    kinds: ["host_stand", "floor_pos", "bar_pos", "expo", "cashier", "busser", "kiosk"],
  },
  {
    id: "ods",
    label: "Order display",
    kinds: ["kitchen_kds", "bar_kds"],
  },
];

const ALL_KINDS: SessionModeId[] = SESSION_MODES.map((m) => m.id);

export function stationsAllowedForEmployee(
  emp: Employee | null | undefined,
): SessionModeId[] {
  if (!emp) return ALL_KINDS;
  switch (emp.role) {
    case "owner":
    case "manager":
      return ALL_KINDS;
    case "server":
      return ["floor_pos", "expo", "cashier", "host_stand"];
    case "host":
      return ["host_stand", "floor_pos", "expo", "kiosk"];
    case "bartender":
      return ["bar_pos", "bar_kds", "expo", "cashier"];
    case "kitchen":
      return ["kitchen_kds", "expo"];
    case "busser":
      return ["busser", "floor_pos"];
    case "cashier":
      return ["cashier", "floor_pos", "expo"];
    case "vendor_operator":
      return ["floor_pos", "bar_pos", "kitchen_kds", "bar_kds", "expo", "cashier"];
    case "kiosk":
      return ["kiosk"];
    case "accountant":
      return ["floor_pos", "cashier"];
    default:
      return ["floor_pos"];
  }
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
