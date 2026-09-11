import type { Employee, EmployeeRole, PosView } from "./types";
import { PIN_VIEWS } from "@/lib/access/pin-role";

/** Human labels for login chips & header */
export const ROLE_LABEL: Record<EmployeeRole, string> = {
  owner: "Owner",
  manager: "Manager",
  supervisor: "Supervisor",
  server: "Server",
  bartender: "Bartender",
  host: "Host stand",
  kitchen: "Kitchen / expo",
  busser: "Busser",
  cashier: "Cashier",
  vendor_operator: "Vendor operator",
  accountant: "Accountant",
  kiosk: "Kiosk",
};

export const ROLE_BLURB: Record<EmployeeRole, string> = {
  owner: "Full location control, settings, staff, settlement — not platform CRM",
  manager: "Venue back office, floor, Devices, Publish, closeout approve — not platform CRM",
  supervisor: "Floor, expedite, voids/comp within limits, clock exceptions — not Publish",
  server: "Assigned sections, one check, send, pay if allowed, own closeout",
  bartender: "Bar well orders, drink send, own drawer, bar ODS if that station",
  host: "Floor, seat, waitlist/reservations, to-go — not server till close",
  kitchen: "ODS Start/Bump only — no pay, no drawer, no price edits",
  busser: "Dirty → clean tables only — no orders, no pay",
  cashier: "Counter queue and pay",
  vendor_operator: "Own menu, tickets, reports — peer menus view-only unless host grants",
  accountant: "Reports and ledger, limited ops",
  kiosk: "Device identity — guest kiosk",
};

/** Default landing screen after PIN — role dashboard lives on hq */
export const ROLE_HOME: Record<EmployeeRole, PosView> = {
  owner: "hq",
  manager: "hq",
  supervisor: "hq",
  server: "floor",
  bartender: "order",
  host: "waitlist",
  kitchen: "kitchen",
  busser: "floor",
  cashier: "order",
  vendor_operator: "hq",
  accountant: "hq",
  kiosk: "waitlist",
};

/**
 * Views each role may open. Owner = all venue tools, not platform CRM.
 * Live stations list only this job’s screens.
 */
const ROLE_VIEWS: Record<EmployeeRole, PosView[] | "all"> = PIN_VIEWS;

export function canAccessView(role: EmployeeRole, view: PosView): boolean {
  const allowed = ROLE_VIEWS[role];
  if (allowed === "all") return true;
  return allowed.includes(view);
}

export function viewsForRole(role: EmployeeRole): PosView[] | "all" {
  return ROLE_VIEWS[role];
}

export function staffTitle(emp: Pick<Employee, "role" | "title">): string {
  return emp.title || ROLE_LABEL[emp.role];
}

export function canAccessViewForEmployee(
  emp: Employee,
  view: PosView,
): boolean {
  if (canAccessView(emp.role, view)) return true;
  return !!emp.extraViews?.includes(view);
}

/** Prefer a known home; if somehow blocked, first allowed view */
export function homeViewForRole(role: EmployeeRole): PosView {
  const home = ROLE_HOME[role];
  if (canAccessView(role, home)) return home;
  const allowed = ROLE_VIEWS[role];
  if (allowed === "all") return "hq";
  return allowed[0] ?? "floor";
}

export function homeViewForEmployee(emp: Employee): PosView {
  if (emp.homeView && canAccessViewForEmployee(emp, emp.homeView)) {
    return emp.homeView;
  }
  return homeViewForRole(emp.role);
}

/** One demo employee per role for quick login (first match wins) */
export function pickRoleRepresentatives<
  T extends { id: string; role: EmployeeRole; active: boolean },
>(employees: T[]): T[] {
  const order: EmployeeRole[] = [
    "owner",
    "manager",
    "supervisor",
    "server",
    "host",
    "bartender",
    "kitchen",
    "cashier",
    "vendor_operator",
    "accountant",
    "busser",
  ];
  const out: T[] = [];
  for (const role of order) {
    const hit = employees.find((e) => e.active && e.role === role);
    if (hit) out.push(hit);
  }
  return out;
}
