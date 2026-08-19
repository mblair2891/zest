import type {
  Employee,
  EmployeeRole,
  ExtraTableGrant,
  FloorSection,
  SectionAccess,
  SectionPolicy,
  Table,
} from "./types";

export const SECTION_SWATCHES = [
  { id: "sec-1", css: "var(--color-sec-1)", label: "Green" },
  { id: "sec-2", css: "var(--color-sec-2)", label: "Blue" },
  { id: "sec-3", css: "var(--color-sec-3)", label: "Amber" },
  { id: "sec-4", css: "var(--color-sec-4)", label: "Citrus" },
  { id: "sec-5", css: "var(--color-sec-5)", label: "Rose" },
  { id: "sec-6", css: "var(--color-sec-6)", label: "Violet" },
] as const;

export type SectionSwatchId = (typeof SECTION_SWATCHES)[number]["id"];

export const DEFAULT_SECTION_POLICY: SectionPolicy = {
  enforceForRoles: ["server"],
  serversCannotOrderOutsideSection: true,
  serversCannotSeatOutsideSection: true,
  hideUnassignedSections: false,
  allowViewOnlyOutside: true,
  allowManagerOverride: true,
  extraTableGrantsEnabled: true,
  lockBartenderToAssigned: true,
};

export const DEFAULT_FLOOR_SECTIONS: FloorSection[] = [
  { id: "sec_dining", name: "Dining", color: "sec-1", sort: 0 },
  { id: "sec_booth", name: "Booth", color: "sec-2", sort: 1 },
  { id: "sec_bar", name: "Bar", color: "sec-3", sort: 2 },
];

export const SECTION_ENFORCE_ROLES: EmployeeRole[] = [
  "server",
  "bartender",
  "host",
  "busser",
];

export function swatchCss(colorId: string): string {
  return (
    SECTION_SWATCHES.find((s) => s.id === colorId)?.css ?? "var(--color-sec-1)"
  );
}

export function canManageSections(role: EmployeeRole | undefined): boolean {
  return role === "owner" || role === "manager";
}

export function sectionForTable(
  table: Pick<Table, "section">,
  sections: FloorSection[],
): FloorSection | undefined {
  const name = table.section.trim().toLowerCase();
  return (
    sections.find((s) => s.name.toLowerCase() === name) ??
    sections.find((s) => s.id === table.section)
  );
}

export function sectionColorForTable(
  table: Pick<Table, "section">,
  sections: FloorSection[],
): string {
  return swatchCss(sectionForTable(table, sections)?.color ?? "sec-1");
}

export function policyOf(
  settingsPolicy: SectionPolicy | undefined,
): SectionPolicy {
  return { ...DEFAULT_SECTION_POLICY, ...settingsPolicy };
}

export function roleIsLocked(
  role: EmployeeRole,
  policy: SectionPolicy,
): boolean {
  if (role === "owner" || role === "manager") return false;
  if (role === "bartender" && policy.lockBartenderToAssigned) return true;
  return policy.enforceForRoles.includes(role);
}

export function employeeHomeSectionIds(emp: Employee): string[] {
  return emp.homeSectionIds ?? [];
}

export function hasHomeSection(
  emp: Employee,
  table: Table,
  sections: FloorSection[],
): boolean {
  const sec = sectionForTable(table, sections);
  if (!sec) return false;
  const homes = employeeHomeSectionIds(emp);
  return homes.includes(sec.id) || homes.includes(sec.name);
}

export function activeGrantForTable(
  grants: ExtraTableGrant[],
  employeeId: string,
  tableId: string,
): ExtraTableGrant | undefined {
  return grants.find(
    (g) => g.employeeId === employeeId && g.tableId === tableId,
  );
}

export function canAccessTable(opts: {
  emp: Employee | null;
  table: Table;
  action: "view" | "order" | "seat";
  sections: FloorSection[];
  grants: ExtraTableGrant[];
  policy: SectionPolicy;
  overrideTableIds?: string[];
}): SectionAccess {
  const { emp, table, action, sections, grants, policy, overrideTableIds } =
    opts;
  if (!emp) return { ok: false, reason: "Not signed in", code: "blocked_order" };
  if (!roleIsLocked(emp.role, policy)) {
    return { ok: true, code: "unrestricted" };
  }

  const homes = employeeHomeSectionIds(emp);
  if (homes.length === 0) {
    return {
      ok: false,
      reason: "No section assigned — ask a manager to assign you a section.",
      code: "no_sections",
    };
  }

  if (hasHomeSection(emp, table, sections)) {
    return { ok: true, code: "home" };
  }

  if (policy.extraTableGrantsEnabled) {
    const grant = activeGrantForTable(grants, emp.id, table.id);
    if (grant) return { ok: true, code: "grant" };
  }

  if (overrideTableIds?.includes(table.id)) {
    return { ok: true, code: "override" };
  }

  if (action === "view" && policy.allowViewOnlyOutside) {
    return {
      ok: true,
      viewOnly: true,
      reason: `View only — ${table.section} is not your section.`,
      code: "view_only",
    };
  }

  if (action === "seat" && policy.serversCannotSeatOutsideSection) {
    return {
      ok: false,
      reason: `Cannot seat ${table.section}. Ask a manager to grant this table.`,
      code: "blocked_seat",
    };
  }

  if (action === "order" && policy.serversCannotOrderOutsideSection) {
    return {
      ok: false,
      reason: `Cannot enter orders on ${table.label} (${table.section}). Grant a table or override.`,
      code: "blocked_order",
    };
  }

  return { ok: true, code: "ok" };
}

export function defaultHomeSectionsForRole(
  role: EmployeeRole,
  empId: string,
): string[] {
  if (role === "bartender") return ["sec_bar"];
  if (empId === "emp_srv2") return ["sec_booth"];
  if (role === "server") return ["sec_dining"];
  return [];
}
