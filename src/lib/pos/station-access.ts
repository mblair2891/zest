import type { Employee } from "./types";
import type { Vendor } from "./types";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { SESSION_MODES, type SessionModeId } from "@/lib/lifecycle/types";

export const STATION_KIND_LABEL: Record<SessionModeId, string> = {
  floor_pos: "Server",
  host_stand: "Host",
  kitchen_kds: "Kitchen Order Display",
  bar_kds: "Bar Order Display",
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
  opts?: { training?: boolean },
): SessionModeId[] {
  if (!emp) return ALL_KINDS;
  let base: SessionModeId[];
  switch (emp.role) {
    case "owner":
    case "manager":
      base = ALL_KINDS;
      break;
    case "server":
      base = ["floor_pos", "expo", "cashier", "host_stand"];
      break;
    case "host":
      base = ["host_stand", "floor_pos", "expo", "kiosk"];
      break;
    case "bartender":
      base = ["bar_pos", "bar_kds", "expo", "cashier"];
      break;
    case "kitchen":
      base = ["kitchen_kds", "expo"];
      break;
    case "busser":
      base = ["busser", "floor_pos"];
      break;
    case "cashier":
      base = ["cashier", "floor_pos", "expo"];
      break;
    case "vendor_operator":
      base = ["floor_pos", "bar_pos", "kitchen_kds", "bar_kds", "expo", "cashier"];
      break;
    case "kiosk":
      base = ["kiosk"];
      break;
    case "accountant":
      base = ["floor_pos", "cashier"];
      break;
    default:
      base = ["floor_pos"];
  }
  return withTrainingLoop(base, opts?.training, emp.role);
}

function withTrainingLoop(
  base: SessionModeId[],
  training: boolean | undefined,
  role: Employee["role"],
): SessionModeId[] {
  if (!training) return base;
  if (role === "owner" || role === "manager") return ALL_KINDS;
  const trainingCore: SessionModeId[] = [
    "floor_pos",
    "host_stand",
    "kitchen_kds",
    "bar_kds",
    "kiosk",
    "cashier",
  ];
  return [...new Set([...base, ...trainingCore])];
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
