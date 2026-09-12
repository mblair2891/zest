import type { Employee, EmployeeRole, FloorSection, Table } from "./types";
import { employeeHomeSectionIds, hasHomeSection } from "./section-control";

/** Stool or bar rail — not a dining table. */
export function isBarRailSeat(table: Pick<Table, "kind" | "shape" | "section">): boolean {
  const kind =
    table.kind ??
    (table.shape === "bar" ? "barstool" : table.shape === "booth" ? "booth" : "table");
  if (kind === "barstool" || table.shape === "bar") return true;
  return /\bbar\b/i.test(table.section);
}

/** Owner, manager, and supervisor see every bar section. */
export function canSeeAllBarSections(role: EmployeeRole | null | undefined): boolean {
  return role === "owner" || role === "manager" || role === "supervisor" || role === "host";
}

/** Opening a well tab on a stool is not dining-room host seating. */
export function canOpenBarTabOnStool(role: EmployeeRole | null | undefined): boolean {
  if (!role) return false;
  return (
    role === "owner" ||
    role === "manager" ||
    role === "supervisor" ||
    role === "bartender" ||
    role === "server" ||
    role === "host" ||
    role === "cashier"
  );
}

export function barTabVisibleTables(opts: {
  tables: Table[];
  emp: Employee | null;
  sections: FloorSection[];
}): Table[] {
  const rail = opts.tables.filter((t) => !t.mergedIntoId && isBarRailSeat(t));
  if (canSeeAllBarSections(opts.emp?.role)) return rail;
  if (!opts.emp) return [];
  const homes = employeeHomeSectionIds(opts.emp);
  if (homes.length === 0) return [];
  return rail.filter((t) => hasHomeSection(opts.emp!, t, opts.sections));
}
