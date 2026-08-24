import type { Employee, EmployeeRole } from "@/lib/pos/types";

/** Host location scope (subscriber), not a guest operator id. */
export const HOST_SCOPE = "host";

export type EntityGrantKey =
  | "view_menu"
  | "edit_menu"
  | "view_tickets"
  | "view_sales_reports"
  | "view_settlement"
  | "manage_devices";

export const ENTITY_GRANT_KEYS: EntityGrantKey[] = [
  "view_menu",
  "edit_menu",
  "view_tickets",
  "view_sales_reports",
  "view_settlement",
  "manage_devices",
];

export const ENTITY_GRANT_LABEL: Record<EntityGrantKey, string> = {
  view_menu: "View menu",
  edit_menu: "Edit menu",
  view_tickets: "View tickets",
  view_sales_reports: "View sales reports",
  view_settlement: "View settlement",
  manage_devices: "Manage devices",
};

export type EntityGrantFlags = Record<EntityGrantKey, boolean>;

export type EntityGrantRow = {
  subjectOperatorId: string;
  targetOperatorId: string;
} & EntityGrantFlags;

/** Peer defaults: see menus, never edit others; tickets/reports/settlement own-only; devices host-only. */
export function defaultGrantFlags(subjectId: string, targetId: string): EntityGrantFlags {
  if (subjectId === HOST_SCOPE) {
    return {
      view_menu: true,
      edit_menu: true,
      view_tickets: true,
      view_sales_reports: true,
      view_settlement: true,
      manage_devices: true,
    };
  }
  if (subjectId === targetId) {
    return {
      view_menu: true,
      edit_menu: true,
      view_tickets: true,
      view_sales_reports: true,
      view_settlement: true,
      manage_devices: false,
    };
  }
  return {
    view_menu: true,
    edit_menu: false,
    view_tickets: false,
    view_sales_reports: false,
    view_settlement: false,
    manage_devices: false,
  };
}

export function defaultGrantRow(subjectId: string, targetId: string): EntityGrantRow {
  return {
    subjectOperatorId: subjectId,
    targetOperatorId: targetId,
    ...defaultGrantFlags(subjectId, targetId),
  };
}

export function parseGrantRow(raw: unknown): EntityGrantRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const subject = String(o.subjectOperatorId ?? "").trim();
  const target = String(o.targetOperatorId ?? "").trim();
  if (!subject || !target) return null;
  const base = defaultGrantFlags(subject, target);
  const flags = { ...base };
  for (const k of ENTITY_GRANT_KEYS) {
    if (typeof o[k] === "boolean") flags[k] = o[k] as boolean;
  }
  return { subjectOperatorId: subject, targetOperatorId: target, ...flags };
}

export function parseGrantMatrix(raw: unknown): EntityGrantRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseGrantRow).filter((r): r is EntityGrantRow => !!r);
}

export function resolveGrant(
  matrix: EntityGrantRow[] | null | undefined,
  subjectId: string,
  targetId: string,
): EntityGrantRow {
  const stored = (matrix ?? []).find(
    (r) => r.subjectOperatorId === subjectId && r.targetOperatorId === targetId,
  );
  const base = defaultGrantRow(subjectId, targetId);
  if (!stored) return base;
  return { ...base, ...stored, subjectOperatorId: subjectId, targetOperatorId: targetId };
}

export function canEntityGrant(
  matrix: EntityGrantRow[] | null | undefined,
  subjectId: string,
  targetId: string,
  key: EntityGrantKey,
): boolean {
  return resolveGrant(matrix, subjectId, targetId)[key];
}

export function upsertGrant(
  matrix: EntityGrantRow[],
  subjectId: string,
  targetId: string,
  patch: Partial<EntityGrantFlags>,
): EntityGrantRow[] {
  const next = resolveGrant(matrix, subjectId, targetId);
  const row: EntityGrantRow = { ...next, ...patch };
  const rest = matrix.filter(
    (r) => !(r.subjectOperatorId === subjectId && r.targetOperatorId === targetId),
  );
  return [...rest, row];
}

const HOST_ROLES: EmployeeRole[] = ["owner", "manager"];

export function isHostPrivileged(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
): boolean {
  if (!emp) return false;
  if (!HOST_ROLES.includes(emp.role)) return false;
  return !emp.operatorId || emp.operatorId === HOST_SCOPE;
}

/** Login scope: host | Steam | Diamond | … */
export function subjectIdForEmployee(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
): string {
  if (!emp) return HOST_SCOPE;
  if (isHostPrivileged(emp)) return HOST_SCOPE;
  return emp.operatorId || HOST_SCOPE;
}

export function resourceOperatorId(vendorId?: string | null): string {
  if (!vendorId || vendorId === HOST_SCOPE) return HOST_SCOPE;
  return vendorId;
}

export function canViewMenu(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
  matrix: EntityGrantRow[] | null | undefined,
  targetOperatorId?: string | null,
): boolean {
  if (isHostPrivileged(emp)) return true;
  const subject = subjectIdForEmployee(emp);
  const target = resourceOperatorId(targetOperatorId);
  return canEntityGrant(matrix, subject, target, "view_menu");
}

export function canEditMenu(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
  matrix: EntityGrantRow[] | null | undefined,
  targetOperatorId?: string | null,
): boolean {
  if (isHostPrivileged(emp)) return true;
  const subject = subjectIdForEmployee(emp);
  const target = resourceOperatorId(targetOperatorId);
  if (subject === target) return true;
  return canEntityGrant(matrix, subject, target, "edit_menu");
}

export function canViewTickets(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
  matrix: EntityGrantRow[] | null | undefined,
  targetOperatorId?: string | null,
): boolean {
  if (isHostPrivileged(emp)) return true;
  const subject = subjectIdForEmployee(emp);
  const target = resourceOperatorId(targetOperatorId);
  if (subject === target) return true;
  return canEntityGrant(matrix, subject, target, "view_tickets");
}

export function canViewSalesReports(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
  matrix: EntityGrantRow[] | null | undefined,
  targetOperatorId?: string | null,
): boolean {
  if (isHostPrivileged(emp)) return true;
  const subject = subjectIdForEmployee(emp);
  const target = resourceOperatorId(targetOperatorId);
  if (subject === target) return true;
  return canEntityGrant(matrix, subject, target, "view_sales_reports");
}

export function canViewSettlementSlice(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
  matrix: EntityGrantRow[] | null | undefined,
  targetOperatorId?: string | null,
): boolean {
  if (isHostPrivileged(emp)) return true;
  const subject = subjectIdForEmployee(emp);
  const target = resourceOperatorId(targetOperatorId);
  if (subject === target) return true;
  return canEntityGrant(matrix, subject, target, "view_settlement");
}

export function canManageDevicesFor(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
  matrix: EntityGrantRow[] | null | undefined,
  targetOperatorId?: string | null,
): boolean {
  if (isHostPrivileged(emp)) return true;
  const subject = subjectIdForEmployee(emp);
  const target = resourceOperatorId(targetOperatorId);
  return canEntityGrant(matrix, subject, target, "manage_devices");
}

export function operatorScopeIds(
  vendors: { id: string }[],
  includeHost = true,
): string[] {
  const ids = vendors.map((v) => v.id);
  return includeHost ? [HOST_SCOPE, ...ids] : ids;
}
