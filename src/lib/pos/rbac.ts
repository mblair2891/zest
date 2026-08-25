import type { Employee, EmployeeRole, PosView } from "./types";

/** Human labels for login chips & header */
export const ROLE_LABEL: Record<EmployeeRole, string> = {
  owner: "Owner",
  manager: "Manager",
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
  owner: "Full location control, settings, staff, settlement",
  manager: "Ops, floor, most settings — not org delete/billing",
  server: "Assigned sections, checks, pay — no settings",
  bartender: "Bar tickets, tabs, drink 86",
  host: "Waitlist, reservations, seating",
  kitchen: "ODS, Start/Bump, item 86",
  busser: "Table turns",
  cashier: "Counter queue and pay",
  vendor_operator: "Own menu, tickets, reports — peer menus view-only unless host grants",
  accountant: "Reports and ledger, limited ops",
  kiosk: "Device identity — guest kiosk",
};

/** Default landing screen after PIN — role dashboard lives on hq */
export const ROLE_HOME: Record<EmployeeRole, PosView> = {
  owner: "hq",
  manager: "hq",
  server: "hq",
  bartender: "hq",
  host: "hq",
  kitchen: "hq",
  busser: "hq",
  cashier: "hq",
  vendor_operator: "hq",
  accountant: "hq",
  kiosk: "waitlist",
};

/**
 * Views each role may open. Owner = all.
 * Unknown views fall through to owner-only via canAccessView.
 */
const ROLE_VIEWS: Record<EmployeeRole, PosView[] | "all"> = {
  owner: "all",
  manager: [
    "hq",
    "floor",
    "order",
    "kitchen",
    "bar",
    "waitlist",
    "takeout",
    "online",
    "hall",
    "settlement",
    "ledger",
    "vendor_portal",
    "integrations",
    "reports",
    "inventory",
    "menu",
    "labor",
    "inventory_ai",
    "drink_ai",
    "employees",
    "customers",
    "cash",
    "settings",
    "floor_editor",
    "schedule",
    "promos",
    "catering",
    "recipes",
    "purchasing",
    "payouts",
    "delivery",
    "campaigns",
    "marketing",
    "website",
    "checklists",
    "truck_pod",
    "package",
    "features",
  ],
  server: ["hq", "floor", "order", "takeout", "hall", "waitlist", "customers", "drink_ai", "online", "reports", "schedule", "labor"],
  bartender: ["hq", "bar", "order", "takeout", "drink_ai", "customers", "inventory", "reports", "schedule", "labor"],
  host: ["hq", "waitlist", "floor", "floor_editor", "customers", "online", "reports", "schedule", "labor"],
  kitchen: ["hq", "kitchen", "recipes", "checklists", "inventory", "reports", "schedule", "labor"],
  busser: ["hq", "floor", "schedule"],
  cashier: ["hq", "order", "takeout", "cash", "online", "schedule", "labor"],
  vendor_operator: [
    "hq",
    "vendor_portal",
    "kitchen",
    "bar",
    "menu",
    "employees",
    "labor",
    "schedule",
    "reports",
    "ledger",
  ],
  accountant: ["hq", "reports", "ledger", "settlement", "cash"],
  kiosk: ["waitlist", "order"],
};

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
