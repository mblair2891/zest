/**
 * Staff floor section filter. A view preference for one person.
 * It does not write the published floor.
 */

export type StaffFloorPiece = {
  id: string;
  section?: string | null;
  kind?: string | null;
  mergedIntoId?: string | null;
  railBarId?: string | null;
};

export function staffFloorSectionKey(locationId: string, employeeId: string): string {
  return `summex-floor-section:${locationId || "house"}:${employeeId}`;
}

/** Seats in one section, plus the bar rail those stools belong to. */
export function tablesForStaffSection<T extends StaffFloorPiece>(tables: T[], sectionName: string): T[] {
  const open = tables.filter((table) => !table.mergedIntoId);
  const wanted = sectionName.trim().toLowerCase();
  if (!wanted || wanted === "all" || wanted === "mine") return open;
  const matched = open.filter((table) => String(table.section ?? "").trim().toLowerCase() === wanted);
  const railIds = new Set(matched.map((table) => table.railBarId).filter((id): id is string => Boolean(id)));
  const rails = open.filter(
    (table) =>
      table.kind === "bar_top" &&
      (String(table.section ?? "").trim().toLowerCase() === wanted || railIds.has(table.id)),
  );
  const ids = new Set([...matched, ...rails].map((table) => table.id));
  return open.filter((table) => ids.has(table.id));
}

export function readStaffFloorSection(
  storage: { getItem(key: string): string | null },
  locationId: string,
  employeeId: string,
  sectionNames: string[],
): string | null {
  const raw = storage.getItem(staffFloorSectionKey(locationId, employeeId))?.trim() ?? "";
  if (!raw) return null;
  if (raw.toLowerCase() === "all") return "All";
  return sectionNames.find((name) => name.toLowerCase() === raw.toLowerCase()) ?? "All";
}

export function writeStaffFloorSection(
  storage: { setItem(key: string, value: string): void },
  locationId: string,
  employeeId: string,
  sectionName: string,
): void {
  storage.setItem(staffFloorSectionKey(locationId, employeeId), sectionName.trim() || "All");
}

/** Saved choice wins. Otherwise one home section opens on that section. */
export function initialStaffFloorSection(opts: {
  saved: string | null;
  sections: Array<{ id: string; name: string }>;
  homeSectionIds?: string[];
}): string {
  if (opts.saved) return opts.saved;
  const homes = opts.homeSectionIds ?? [];
  const matched = opts.sections.filter(
    (section) =>
      homes.includes(section.id) || homes.some((home) => home.toLowerCase() === section.name.toLowerCase()),
  );
  if (matched.length === 1) return matched[0]!.name;
  return "All";
}
