import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Employee, EmployeeRole, VenueEntityId } from "@/lib/pos/types";
import { homeViewForEmployee } from "@/lib/pos/rbac";
import { rolesForVenue } from "@/lib/access/entity-roles";
import { usePosStore } from "@/lib/pos/store";
import { getDemoType, isProspectDemo } from "./session";

export type DemoDevice = "pos" | "kiosk" | "kds_kitchen" | "kds_bar";

type DemoDeviceState = {
  entered: boolean;
  device: DemoDevice;
  employeeId: string | null;
  displayName: string;
  enter: () => void;
  leave: () => void;
  setDevice: (d: DemoDevice) => void;
  setEmployeeId: (id: string | null) => void;
  setDisplayName: (n: string) => void;
};

export const useDemoDeviceStore = create<DemoDeviceState>()(
  persist(
    (set) => ({
      entered: false,
      device: "pos",
      employeeId: null,
      displayName: "Floor POS",
      enter: () => set({ entered: true, device: "pos" }),
      leave: () => set({ entered: false, device: "pos", employeeId: null, displayName: "Floor POS" }),
      setDevice: (device) => set({ device }),
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
  kds_kitchen: "Kitchen KDS",
  kds_bar: "Bar KDS",
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

export function loginDemoEmployee(emp: Employee): void {
  usePosStore.getState().loginAs(emp.id);
  useDemoDeviceStore.getState().setEmployeeId(emp.id);
}

export type DemoSwitcherOption =
  | { kind: "role"; key: string; label: string; employeeId: string; role: EmployeeRole }
  | { kind: "device"; key: DemoDevice; label: string };

export function demoSwitcherOptions(
  employees: Employee[],
  venue: VenueEntityId | null,
  hasBar: boolean,
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
  out.push({ kind: "device", key: "pos", label: "Device · Floor POS" });
  out.push({ kind: "device", key: "kiosk", label: "Device · Kiosk" });
  out.push({ kind: "device", key: "kds_kitchen", label: "Device · KDS Kitchen" });
  if (hasBar) out.push({ kind: "device", key: "kds_bar", label: "Device · KDS Bar" });
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
  loginDemoEmployee(emp);
  s.setView(homeViewForEmployee(emp));
  const type = getDemoType();
  return type ? { to: "/demo/$type", type } : {};
}
