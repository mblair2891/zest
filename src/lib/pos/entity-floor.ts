/**
 * Who may edit which floor sections. Location contact edits the whole floor.
 * An entity password login edits rooms that entity owns, plus tables with an
 * active seating loan for that entity’s staff. A loan does not change the owner.
 * Publish for a peer venue writes owned rooms only. House and other entities stay.
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

type MergeSection = { id: string; name: string; operatorId?: string | null };
type MergeTable = {
  id: string;
  section?: string | null;
  sectionId?: string | null;
  kind?: string | null;
  railBarId?: string | null;
};

function ownedIndex(sections: readonly MergeSection[], entityId: string) {
  const owned = sections.filter((section) => section.operatorId === entityId);
  return {
    ids: new Set(owned.map((section) => section.id)),
    names: new Set(owned.map((section) => section.name)),
  };
}

export type ClearSlateTable = {
  id: string;
  kind?: string | null;
  section?: string | null;
  sectionId?: string | null;
  railBarId?: string | null;
};

/**
 * Location contact clears every piece. An entity clears pieces in rooms it owns,
 * plus stools bound to a bar in those rooms. Other rooms, loans, and the section
 * list stay. Rooms are not in this list.
 */
export function tablesAfterClearSlate<T extends ClearSlateTable>(
  tables: readonly T[],
  input: {
    whole: boolean;
    entityId: string | null;
    sections: ReadonlyArray<{ id: string; name: string; operatorId?: string | null }>;
  },
): T[] {
  if (input.whole) return [];
  const entityId = String(input.entityId ?? "").trim();
  if (!entityId) return [...tables];
  const drop = new Set<string>();
  for (const table of tables) {
    if (tableInOwnedRooms(table, input.sections, entityId)) drop.add(table.id);
  }
  for (const table of tables) {
    const rail = String(table.railBarId ?? "").trim();
    if (!rail || !drop.has(rail) || drop.has(table.id)) continue;
    const sectionId = String(table.sectionId ?? "").trim();
    const name = String(table.section ?? "").trim();
    if (!sectionId && !name) drop.add(table.id);
  }
  return tables.filter((table) => !drop.has(table.id));
}

/** A table is in this entity’s rooms by section id, or by name when the id is blank. */
function tableInOwnedRooms(
  table: MergeTable,
  sections: readonly MergeSection[],
  entityId: string,
): boolean {
  const { ids, names } = ownedIndex(sections, entityId);
  const sectionId = String(table.sectionId ?? "").trim();
  if (sectionId) return ids.has(sectionId);
  const name = String(table.section ?? "").trim();
  if (!name || !names.has(name)) return false;
  const sameName = sections.filter((section) => section.name === name);
  return sameName.length > 0 && sameName.every((section) => section.operatorId === entityId);
}

/**
 * Peer-venue publish. Start from the stored plan. Replace tables in rooms this
 * entity owns (position, seats, shape, and the rest of the piece). Keep every
 * other room, its tables, and the room size. A seating loan is editable on the
 * map and is not written here, because that table lives in another room.
 */
export function mergeEntityFloor<T extends MergeTable, S extends MergeSection, R>(input: {
  stored: { tables: T[]; sections: S[]; room?: R };
  draft: { tables: T[]; sections: S[] };
  entityId: string;
}): { tables: T[]; sections: S[]; room?: R } {
  const entityId = input.entityId.trim();
  const storedSections = input.stored.sections ?? [];
  const storedTables = input.stored.tables ?? [];
  const draftSections = input.draft.sections ?? [];
  const draftTables = input.draft.tables ?? [];
  if (!entityId) {
    return { tables: storedTables, sections: storedSections, room: input.stored.room };
  }

  const nextSections: S[] = [];
  for (const section of storedSections) {
    if (section.operatorId !== entityId) {
      nextSections.push(section);
      continue;
    }
    const edited = draftSections.find((row) => row.id === section.id);
    if (!edited) {
      nextSections.push({ ...section, operatorId: entityId });
      continue;
    }
    nextSections.push({
      ...section,
      ...edited,
      id: section.id,
      operatorId: entityId,
    });
  }

  const byId = new Map(nextSections.map((section) => [section.id, section]));
  const normalize = (table: T): T => {
    const sectionId = String(table.sectionId ?? "").trim();
    const bySection = sectionId ? byId.get(sectionId) : undefined;
    if (bySection && bySection.operatorId === entityId) {
      return { ...table, sectionId: bySection.id, section: bySection.name };
    }
    const name = String(table.section ?? "").trim();
    const byName = nextSections.find((section) => section.operatorId === entityId && section.name === name);
    if (byName) return { ...table, sectionId: byName.id, section: byName.name };
    return { ...table };
  };

  const draftById = new Map(draftTables.map((table) => [table.id, table]));
  const tables: T[] = [];
  const used = new Set<string>();
  for (const table of storedTables) {
    const owned = tableInOwnedRooms(table, storedSections, entityId);
    if (!owned) {
      tables.push(table);
      used.add(table.id);
      continue;
    }
    const edited = draftById.get(table.id);
    if (!edited) continue;
    if (!tableInOwnedRooms(edited, nextSections, entityId)) {
      tables.push(table);
      used.add(table.id);
      continue;
    }
    tables.push(normalize(edited));
    used.add(table.id);
  }
  for (const table of draftTables) {
    if (used.has(table.id)) continue;
    if (!tableInOwnedRooms(table, nextSections, entityId)) continue;
    tables.push(normalize(table));
    used.add(table.id);
  }

  const present = new Set(tables.map((table) => table.id));
  const kept = tables.filter((table) => {
    const rail = String(table.railBarId ?? "").trim();
    if (!rail || present.has(rail)) return true;
    const bar = storedTables.find((row) => row.id === rail);
    if (!bar || !tableInOwnedRooms(bar, storedSections, entityId)) return true;
    const sectionId = String(table.sectionId ?? "").trim();
    const name = String(table.section ?? "").trim();
    return Boolean(sectionId || name);
  });

  return { tables: kept, sections: nextSections, room: input.stored.room };
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
