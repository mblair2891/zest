import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Employee, EmployeeRole, VenueEntityId } from "@/lib/pos/types";
import { homeViewForEmployee } from "@/lib/pos/rbac";
import { rolesForVenue } from "@/lib/access/entity-roles";
import { usePosStore } from "@/lib/pos/store";
import { getDemoType, isProspectDemo } from "./session";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  DEVICE_FUNCTION_LABEL,
  pickStaffForAssignment,
  viewForDeviceFunction,
  type LocationDevice,
} from "@/lib/pos/location-devices";

export type DemoDevice = "pos" | "kiosk" | "kds_kitchen" | "kds_bar" | "expo";

export type DemoStationId =
  | "owner"
  | "hostess"
  | "server"
  | "expo"
  | "kitchen"
  | "bar_kds"
  | "bartender"
  | "cashier"
  | "busser"
  | "vendor"
  | "kiosk";

type DemoDeviceState = {
  entered: boolean;
  device: DemoDevice;
  station: DemoStationId;
  employeeId: string | null;
  displayName: string;
  enter: () => void;
  leave: () => void;
  setDevice: (d: DemoDevice) => void;
  setStation: (s: DemoStationId) => void;
  setEmployeeId: (id: string | null) => void;
  setDisplayName: (n: string) => void;
};

export const useDemoDeviceStore = create<DemoDeviceState>()(
  persist(
    (set) => ({
      entered: false,
      device: "pos",
      station: "owner",
      employeeId: null,
      displayName: "Owner / Manager",
      enter: () => set({ entered: true, device: "pos", station: "owner" }),
      leave: () =>
        set({
          entered: false,
          device: "pos",
          station: "owner",
          employeeId: null,
          displayName: "Owner / Manager",
        }),
      setDevice: (device) => set({ device }),
      setStation: (station) => set({ station }),
      setEmployeeId: (employeeId) => set({ employeeId }),
      setDisplayName: (displayName) => set({ displayName }),
    }),
    { name: "summex-demo-device" },
  ),
);

export function isDemoOperatorSession(): boolean {
  return isProspectDemo() && useDemoDeviceStore.getState().entered;
}

export function enterDemoOperator(): void {
  useDemoDeviceStore.getState().enter();
}

const ROLE_DEVICE_NAME: Record<DemoDevice, string> = {
  pos: "Floor POS",
  kiosk: "Guest kiosk",
  kds_kitchen: "Kitchen ODS",
  kds_bar: "Bar ODS",
  expo: "Expo",
};

export function pickEmployeeForRole(
  employees: Employee[],
  role: EmployeeRole,
  operatorId?: string,
): Employee | undefined {
  const active = employees.filter((e) => e.active);
  if (role === "vendor_operator" && operatorId) {
    return active.find((e) => e.role === "vendor_operator" && e.operatorId === operatorId);
  }
  return active.find((e) => e.role === role);
}

export function loginDemoEmployee(emp: Employee, kind?: "pin" | "backoffice"): void {
  const sessionKind = kind ?? "pin";
  usePosStore.getState().loginAs(emp.id, { kind: sessionKind });
  useDemoDeviceStore.getState().setEmployeeId(emp.id);
}

export type DemoStationOption = {
  id: string;
  station: DemoStationId;
  label: string;
  employeeId?: string;
};

export function demoStationsForVenue(
  employees: Employee[],
  venue: VenueEntityId | null,
  opts?: { hasBar?: boolean; expoEnabled?: boolean },
): DemoStationOption[] {
  const type = venue ?? "restaurant";
  const hasBar = opts?.hasBar ?? true;
  const expoOn = opts?.expoEnabled !== false;
  const out: DemoStationOption[] = [
    { id: "owner", station: "owner", label: "Owner / Manager" },
  ];
  const has = (role: EmployeeRole) => employees.some((e) => e.active && e.role === role);
  if (has("host") && (type === "restaurant" || type === "food_hall" || type === "bar_lounge")) {
    out.push({ id: "hostess", station: "hostess", label: "Host stand" });
  }
  if (has("server") && type !== "qsr" && type !== "cafe" && type !== "ghost_kitchen") {
    const servers = employees.filter((e) => e.active && e.role === "server");
    for (const e of servers) {
      out.push({
        id: servers.length > 1 ? `server:${e.id}` : "server",
        station: "server",
        label: servers.length > 1 ? `Server · ${e.name}` : "Server",
        employeeId: e.id,
      });
    }
  }
  if (expoOn && has("kitchen") && (type === "restaurant" || type === "food_hall" || type === "bar_lounge")) {
    out.push({ id: "expo", station: "expo", label: "Expo" });
  }
  if (has("kitchen")) {
    out.push({ id: "kitchen", station: "kitchen", label: "Kitchen ODS" });
  }
  if (hasBar && (has("bartender") || has("kitchen"))) {
    out.push({ id: "bar_kds", station: "bar_kds", label: "Bar ODS" });
  }
  if (has("bartender")) {
    out.push({ id: "bartender", station: "bartender", label: "Bartender" });
  }
  if (has("cashier") || type === "qsr" || type === "cafe" || type === "ghost_kitchen") {
    out.push({ id: "cashier", station: "cashier", label: "Cashier / Counter" });
  }
  if (has("busser") && (type === "restaurant" || type === "food_hall" || type === "bar_lounge")) {
    out.push({ id: "busser", station: "busser", label: "Busser" });
  }
  for (const e of employees.filter((x) => x.active && x.role === "vendor_operator")) {
    out.push({
      id: `vendor:${e.id}`,
      station: "vendor",
      label: `Vendor · ${e.title || e.name}`,
      employeeId: e.id,
    });
  }
  out.push({ id: "kiosk", station: "kiosk", label: "Kiosk (guest)" });
  return out;
}

export function applyDemoStation(
  station: DemoStationId,
  employeeId?: string,
): { to?: "/kiosk" | "/demo/$type"; type?: string } {
  const s = usePosStore.getState();
  const emps = s.employees;
  const store = useDemoDeviceStore.getState();
  store.setStation(station);
  s.setActiveDeviceId(null);

  const loginRole = (role: EmployeeRole, view: Parameters<typeof s.setView>[0], device: DemoDevice, label: string) => {
    const emp =
      (employeeId ? emps.find((e) => e.id === employeeId) : undefined) ??
      pickEmployeeForRole(emps, role) ??
      pickEmployeeForRole(emps, "owner") ??
      emps[0];
    if (emp) loginDemoEmployee(emp, "pin");
    store.setDevice(device);
    store.setDisplayName(label);
    s.setView(view);
  };

  switch (station) {
    case "owner":
      loginRole("owner", "hq", "pos", "Owner / Manager");
      break;
    case "hostess":
      loginRole("host", "floor", "pos", "Hostess / Host stand");
      break;
    case "server":
      loginRole("server", "floor", "pos", "Server");
      break;
    case "expo":
      loginRole("kitchen", "kitchen", "expo", "Expo");
      break;
    case "kitchen":
      loginRole("kitchen", "kitchen", "kds_kitchen", "Kitchen ODS");
      break;
    case "bar_kds":
      loginRole("bartender", "bar", "kds_bar", "Bar ODS");
      break;
    case "bartender":
      loginRole("bartender", "bar", "pos", "Bartender");
      break;
    case "cashier":
      loginRole("cashier", "takeout", "pos", "Cashier / Counter");
      break;
    case "busser":
      loginRole("busser", "floor", "pos", "Busser");
      break;
    case "vendor":
      loginRole("vendor_operator", "hq", "pos", "Vendor operator");
      break;
    case "kiosk":
      store.setDevice("kiosk");
      store.setDisplayName("Kiosk (guest)");
      return { to: "/kiosk" };
  }
  const type = getDemoType();
  return type ? { to: "/demo/$type", type } : {};
}

export type DemoSwitcherOption =
  | { kind: "role"; key: string; label: string; employeeId: string; role: EmployeeRole }
  | { kind: "device"; key: DemoDevice; label: string }
  | { kind: "assignment"; key: string; label: string; deviceId: string };

export function demoSwitcherOptions(
  employees: Employee[],
  venue: VenueEntityId | null,
  hasBar: boolean,
  devices: LocationDevice[] = [],
  operatorName?: (id: string) => string,
): DemoSwitcherOption[] {
  const allowed = new Set(rolesForVenue(venue));
  const out: DemoSwitcherOption[] = [];
  const seen = new Set<string>();
  const order: EmployeeRole[] = [
    "owner",
    "manager",
    "server",
    "host",
    "bartender",
    "kitchen",
    "cashier",
    "vendor_operator",
    "accountant",
  ];
  for (const role of order) {
    if (!allowed.has(role)) continue;
    const matches = employees.filter((e) => e.active && e.role === role);
    for (const e of matches) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const extra =
        role === "vendor_operator" && e.title ? ` · ${e.title}` : matches.length > 1 ? ` · ${e.name}` : "";
      out.push({
        kind: "role",
        key: `role:${e.id}`,
        label: roleLabel(role) + extra,
        employeeId: e.id,
        role,
      });
    }
  }
  const nameOf =
    operatorName ??
    ((id: string) => (id === HOST_SCOPE ? "Host" : id));
  for (const d of devices) {
    out.push({
      kind: "assignment",
      key: `assign:${d.id}`,
      label: `Assigned · ${d.label} · ${nameOf(d.assignment.operatorId)} · ${DEVICE_FUNCTION_LABEL[d.assignment.function]}`,
      deviceId: d.id,
    });
  }
  out.push({ kind: "device", key: "pos", label: "Device · Floor POS" });
  out.push({ kind: "device", key: "kiosk", label: "Device · Kiosk" });
  out.push({ kind: "device", key: "kds_kitchen", label: "Device · Kitchen ODS" });
  if (hasBar) out.push({ kind: "device", key: "kds_bar", label: "Device · Bar ODS" });
  return out;
}

function roleLabel(role: EmployeeRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "manager":
      return "Manager";
    case "server":
      return "Server / floor";
    case "host":
      return "Host stand";
    case "bartender":
      return "Bartender / bar";
    case "kitchen":
      return "Kitchen / expo";
    case "cashier":
      return "Cashier / counter";
    case "vendor_operator":
      return "Vendor operator";
    case "accountant":
      return "Accountant / reports";
    default:
      return role;
  }
}

export function applyDemoDevice(
  device: DemoDevice,
): { to?: "/kiosk" | "/demo/$type"; type?: string } {
  const s = usePosStore.getState();
  const emps = s.employees;
  const store = useDemoDeviceStore.getState();
  store.setDevice(device);
  store.setDisplayName(ROLE_DEVICE_NAME[device]);
  s.setActiveDeviceId(null);
  if (device === "kiosk") {
    return { to: "/kiosk" };
  }
  if (device === "kds_kitchen") {
    const kit = pickEmployeeForRole(emps, "kitchen") ?? pickEmployeeForRole(emps, "owner");
    if (kit) loginDemoEmployee(kit);
    s.setView("kitchen");
  } else if (device === "kds_bar") {
    const bar = pickEmployeeForRole(emps, "bartender") ?? pickEmployeeForRole(emps, "owner");
    if (bar) loginDemoEmployee(bar);
    s.setView("bar");
  } else {
    const emp =
      emps.find((e) => e.id === store.employeeId) ??
      pickEmployeeForRole(emps, "owner") ??
      emps[0];
    if (emp) {
      loginDemoEmployee(emp);
      s.setView(homeViewForEmployee(emp));
    }
  }
  const type = getDemoType();
  return type ? { to: "/demo/$type", type } : {};
}

export function applyDemoRole(employeeId: string): { to?: "/demo/$type"; type?: string } {
  const s = usePosStore.getState();
  const emp = s.employees.find((e) => e.id === employeeId);
  if (!emp) return {};
  useDemoDeviceStore.getState().setDevice("pos");
  useDemoDeviceStore.getState().setDisplayName("Floor POS");
  s.setActiveDeviceId(null);
  loginDemoEmployee(emp);
  s.setView(homeViewForEmployee(emp));
  const type = getDemoType();
  return type ? { to: "/demo/$type", type } : {};
}

export function applyDemoAssignment(
  deviceId: string,
): { to?: "/kiosk" | "/demo/$type"; type?: string } {
  const s = usePosStore.getState();
  const device = (s.locationDevices ?? []).find((d) => d.id === deviceId);
  if (!device) return {};
  s.setActiveDeviceId(device.id);
  const fn = device.assignment.function;
  const view = viewForDeviceFunction(fn);
  const store = useDemoDeviceStore.getState();
  store.setDisplayName(
    `${device.label} · ${DEVICE_FUNCTION_LABEL[fn]}`,
  );
  if (fn === "kiosk" || view === "kiosk") {
    store.setDevice("kiosk");
    return { to: "/kiosk" };
  }
  if (fn === "kitchen_kds" || fn === "expo") store.setDevice("kds_kitchen");
  else if (fn === "bar_kds") store.setDevice("kds_bar");
  else store.setDevice("pos");
  const staff = pickStaffForAssignment(s.employees, device.assignment);
  if (staff) loginDemoEmployee(staff, "pin");
  s.setView(view);
  const type = getDemoType();
  return type ? { to: "/demo/$type", type } : {};
}
