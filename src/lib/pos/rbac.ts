import type { Employee, EmployeeRole, PosView } from "./types";

/** Human labels for login chips & header */
export const ROLE_LABEL: Record<EmployeeRole, string> = {
  owner: "Owner",
  manager: "Manager",
  server: "Server",
  bartender: "Bartender",
  host: "Host",
  kitchen: "Kitchen",
  busser: "Busser",
};

export const ROLE_BLURB: Record<EmployeeRole, string> = {
  owner: "Full platform & site control",
  manager: "Site ops, labor, money & reports",
  server: "Floor, orders & guests",
  bartender: "Bar KDS, tabs & drink assist",
  host: "Waitlist, reservations & seating",
  kitchen: "Expo / kitchen display",
  busser: "Table turns & cleanliness",
};

/** Default landing screen after login */
export const ROLE_HOME: Record<EmployeeRole, PosView> = {
  owner: "hq",
  manager: "hq",
  server: "floor",
  bartender: "bar",
  host: "waitlist",
  kitchen: "kitchen",
  busser: "floor",
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
    // no saas (platform console)
  ],
  server: [
    "floor",
    "order",
    "takeout",
    "hall",
    "waitlist",
    "customers",
    "drink_ai",
    "online",
  ],
  bartender: [
    "bar",
    "order",
    "takeout",
    "drink_ai",
    "customers",
    "inventory", // 86 board awareness
  ],
  host: ["waitlist", "floor", "customers", "online"],
  kitchen: ["kitchen", "recipes", "checklists", "inventory"],
  busser: ["floor"],
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
    "bartender",
    "host",
    "kitchen",
    "busser",
  ];
  const out: T[] = [];
  for (const role of order) {
    const hit = employees.find((e) => e.active && e.role === role);
    if (hit) out.push(hit);
  }
  return out;
}
