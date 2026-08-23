import type { Employee, EmployeeRole } from "@/lib/pos/types";

/** Fine-grained capabilities. Views still use rbac; these gate writes and widgets. */
export type Permission =
  | "settings:read"
  | "settings:write"
  | "menu:write"
  | "floor:write"
  | "orders:create"
  | "payments:take"
  | "comps:approve"
  | "waitlist:manage"
  | "staff:invite"
  | "reports:read"
  | "settlement:read"
  | "settlement:write"
  | "ledger:read"
  | "tickets:bump"
  | "item:86"
  | "demo:admin";

const ALL: Permission[] = [
  "settings:read",
  "settings:write",
  "menu:write",
  "floor:write",
  "orders:create",
  "payments:take",
  "comps:approve",
  "waitlist:manage",
  "staff:invite",
  "reports:read",
  "settlement:read",
  "settlement:write",
  "ledger:read",
  "tickets:bump",
  "item:86",
];

const ROLE_PERMS: Record<EmployeeRole, Permission[] | "all"> = {
  owner: "all",
  manager: ALL.filter((p) => p !== "demo:admin"),
  server: ["orders:create", "payments:take", "floor:write", "reports:read"],
  host: ["waitlist:manage", "floor:write", "reports:read"],
  bartender: ["orders:create", "tickets:bump", "item:86", "payments:take", "reports:read"],
  kitchen: ["tickets:bump", "item:86", "reports:read"],
  busser: ["floor:write"],
  cashier: ["orders:create", "payments:take"],
  vendor_operator: [
    "item:86",
    "tickets:bump",
    "settlement:read",
    "menu:write",
    "reports:read",
  ],
  accountant: ["reports:read", "settlement:read", "ledger:read", "settings:read"],
  kiosk: ["orders:create", "waitlist:manage"],
};

export function permissionsForRole(role: EmployeeRole): Permission[] {
  const p = ROLE_PERMS[role];
  if (p === "all") return [...ALL, "demo:admin"];
  return p;
}

export function can(role: EmployeeRole | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  const p = ROLE_PERMS[role];
  if (p === "all") return true;
  return p.includes(perm);
}

export function canEmployee(
  emp: Pick<Employee, "role"> | null | undefined,
  perm: Permission,
): boolean {
  return can(emp?.role, perm);
}

export function canAny(
  role: EmployeeRole | null | undefined,
  perms: Permission[],
): boolean {
  return perms.some((p) => can(role, p));
}
