/** Cash drawer open gate. Leaf module: no @/ imports. */

export const DRAWER_STAYS_CLOSED = "Drawer stays closed.";
export const DRAWER_PIN_DENIED = "That PIN does not approve the drawer.";
export const DRAWER_NOT_ASSIGNED = "This drawer is assigned to someone else.";
export const DRAWER_OWN_BANK = "This PIN uses a personal bank.";
export const DRAWER_NONE = "This PIN is not assigned a drawer.";
export const DRAWER_NO_STATION = "No drawer on this station.";

export type DrawerAssignment = "ok" | "no_drawer" | "own_bank" | "not_assigned" | "none";

export type DrawerCustody = "house_drawer" | "personal_bank" | "none";
export type DrawerSinkKind = "drawer" | "bank" | "blocked";

export function classifyDrawerAssignment(opts: {
  stationHasDrawer: boolean;
  custody: DrawerCustody;
  sink: DrawerSinkKind;
  assignedEmployeeIds?: readonly string[] | null;
  employeeId?: string | null;
  isManager?: boolean;
}): DrawerAssignment {
  if (!opts.stationHasDrawer) return "no_drawer";
  if (opts.custody === "none" || opts.sink === "blocked") return "none";
  if (opts.sink === "drawer") {
    const assigned = opts.assignedEmployeeIds ?? [];
    if (
      assigned.length > 0 &&
      opts.employeeId &&
      !assigned.includes(opts.employeeId) &&
      !opts.isManager
    ) {
      return "not_assigned";
    }
    return "ok";
  }
  return "own_bank";
}

export function drawerAssignmentMessage(kind: DrawerAssignment): string | null {
  switch (kind) {
    case "ok":
      return null;
    case "no_drawer":
      return DRAWER_NO_STATION;
    case "own_bank":
      return DRAWER_OWN_BANK;
    case "not_assigned":
      return DRAWER_NOT_ASSIGNED;
    case "none":
      return DRAWER_NONE;
  }
}

export type DrawerOpenPhase = "blocked" | "prompt" | "open";

/** Assignment runs first. On asks for a manager. Off opens when the assignment allows it. */
export function decideDrawerOpen(opts: {
  assignment: DrawerAssignment;
  requiresManager: boolean;
  approved: boolean;
  cancelled?: boolean;
  invalidPin?: boolean;
}): { phase: DrawerOpenPhase; message?: string; approverRequired: boolean } {
  const blocked = drawerAssignmentMessage(opts.assignment);
  if (blocked) return { phase: "blocked", message: blocked, approverRequired: false };
  if (opts.cancelled) {
    return { phase: "blocked", message: DRAWER_STAYS_CLOSED, approverRequired: opts.requiresManager };
  }
  if (opts.invalidPin) {
    return { phase: "blocked", message: DRAWER_PIN_DENIED, approverRequired: opts.requiresManager };
  }
  if (!opts.requiresManager) return { phase: "open", approverRequired: false };
  if (opts.approved) return { phase: "open", approverRequired: true };
  return { phase: "prompt", approverRequired: true };
}
