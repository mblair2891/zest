/**
 * Who may edit which floor sections. Location contact edits the whole floor.
 * An entity password login edits rooms that entity owns, plus tables with an
 * active seating loan for that entity’s staff. A loan does not change the owner.
 * No @/ value imports so node:test can load this file.
 */

const HOST_SCOPE = "host";

export type FloorScopeSection = { id: string; name: string; operatorId?: string | null };
export type FloorScopeTable = { id: string; section?: string; sectionId?: string | null };
export type FloorScopeGrant = { employeeId: string; tableId: string; scope: string };
export type FloorScopeEmployee = { id: string; operatorId?: string | null; role?: string | null };

export type FloorEditMode = "whole" | "entity" | "none";

export function entityFloorEditorId(
  emp: { role?: string | null; operatorId?: string | null } | null | undefined,
  sessionKind: string | null | undefined,
): string | null {
  if (!emp || sessionKind !== "backoffice") return null;
  const role = emp.role ?? "";
  if (role !== "vendor_operator" && role !== "manager" && role !== "owner") return null;
  const op = String(emp.operatorId ?? "").trim();
  if (!op || op === HOST_SCOPE) return null;
  return op;
}

/** Whole floor for the location contact. Entity scope for a back-office entity login. */
export function floorEditMode(
  emp: { role?: string | null; operatorId?: string | null } | null | undefined,
  sessionKind: string | null | undefined,
): FloorEditMode {
  if (entityFloorEditorId(emp, sessionKind)) return "entity";
  if (!emp) return "none";
  const role = emp.role ?? "";
  const op = String(emp.operatorId ?? "").trim();
  const locationContact =
    (role === "owner" || role === "manager") && (!op || op === HOST_SCOPE);
  if (locationContact && (sessionKind === "backoffice" || sessionKind === "pin")) return "whole";
  if (role === "host" && sessionKind === "pin") return "whole";
  return "none";
}

export type FloorEditScope = {
  whole: boolean;
  sectionIds: string[];
  tableIds: string[];
};

/**
 * entityId null = whole floor. A set id edits sections with that operatorId
 * and tables on those sections (by sectionId or section name), plus seating
 * loans for staff whose operatorId is this entity. Shift grants do not edit.
 * Loans add table ids only. They do not write section.operatorId.
 */
export function floorEditScope(input: {
  entityId: string | null;
  sections: FloorScopeSection[];
  tables: FloorScopeTable[];
  grants: FloorScopeGrant[];
  employees: FloorScopeEmployee[];
}): FloorEditScope {
  if (input.entityId == null) {
    return {
      whole: true,
      sectionIds: input.sections.map((s) => s.id),
      tableIds: input.tables.map((t) => t.id),
    };
  }
  const entityId = input.entityId;
  const owned = input.sections.filter((s) => s.operatorId === entityId);
  const sectionIds = owned.map((s) => s.id);
  const names = new Set(owned.map((s) => s.name));
  const staff = new Set(
    input.employees.filter((e) => e.operatorId === entityId).map((e) => e.id),
  );
  const loans = new Set(
    input.grants
      .filter((g) => g.scope === "seating" && staff.has(g.employeeId))
      .map((g) => g.tableId),
  );
  const tableIds = input.tables
    .filter((t) => {
      if (t.sectionId && sectionIds.includes(t.sectionId)) return true;
      if (t.section && names.has(t.section)) return true;
      return loans.has(t.id);
    })
    .map((t) => t.id);
  return { whole: false, sectionIds, tableIds };
}

/** Section a new piece lands in. Null when this entity has no assigned section. */
export function placeSectionName(
  room: string,
  sections: Array<{ id: string; name: string }>,
  editableSectionIds: string[] | null,
): { name: string; id?: string } | null {
  const pool = editableSectionIds
    ? sections.filter((s) => editableSectionIds.includes(s.id))
    : sections;
  if (room !== "All") {
    const hit = pool.find((s) => s.name === room);
    if (hit) return { name: hit.name, id: hit.id };
    if (!editableSectionIds) return { name: room };
  }
  const first = pool[0];
  if (!first) return null;
  return { name: first.name, id: first.id };
}
