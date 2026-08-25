import type { Employee, EmployeeRole } from "@/lib/pos/types";
import { HOST_SCOPE } from "@/lib/access/entity-grants";

export type CostPerm =
  | "invoice:post"
  | "po:create"
  | "po:approve"
  | "po:receive"
  | "count"
  | "waste"
  | "alert:respond"
  | "price:recommend"
  | "settings";

const ALL: CostPerm[] = [
  "invoice:post",
  "po:create",
  "po:approve",
  "po:receive",
  "count",
  "waste",
  "alert:respond",
  "price:recommend",
  "settings",
];

const ROLE: Record<EmployeeRole, CostPerm[] | "all"> = {
  owner: "all",
  manager: ALL,
  accountant: ["invoice:post", "po:approve", "alert:respond", "price:recommend"],
  vendor_operator: [
    "invoice:post",
    "po:create",
    "po:receive",
    "count",
    "waste",
    "alert:respond",
    "price:recommend",
  ],
  bartender: ["count", "waste"],
  kitchen: ["count", "waste"],
  server: [],
  host: [],
  busser: [],
  cashier: [],
  kiosk: [],
};

export function canCost(
  emp: Pick<Employee, "role"> | null | undefined,
  perm: CostPerm,
): boolean {
  if (!emp) return false;
  const list = ROLE[emp.role];
  if (list === "all") return true;
  return list.includes(perm);
}

export function costEntityScope(emp: Employee | null | undefined): string | null {
  if (!emp) return null;
  if (emp.role === "owner" || emp.role === "manager" || emp.role === "accountant") {
    return null;
  }
  if (emp.role === "vendor_operator") return emp.operatorId ?? HOST_SCOPE;
  return emp.operatorId ?? null;
}

export function canSeeEntity(
  emp: Employee | null | undefined,
  entityId: string,
): boolean {
  const scope = costEntityScope(emp);
  if (!scope) return true;
  return entityId === scope || entityId === HOST_SCOPE;
}
