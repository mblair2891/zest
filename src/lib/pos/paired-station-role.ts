/** Paired-device dropdown: Order / Host / ODS, plus kiosk and split ODS when those exist. */

export type PairedStationRole = "order" | "host" | "ods" | "ods_kitchen" | "ods_bar" | "kiosk";

export const PAIRED_ROLE_LABEL: Record<PairedStationRole, string> = {
  order: "Order",
  host: "Host",
  ods: "ODS",
  ods_kitchen: "ODS kitchen",
  ods_bar: "ODS bar",
  kiosk: "Kiosk",
};

export function confirmPairedRoleChange(role: PairedStationRole): string {
  return `This tablet will become ${PAIRED_ROLE_LABEL[role]}. Staff must PIN in again.`;
}

export function functionForPairedRole(
  role: PairedStationRole,
): "floor_pos" | "host_stand" | "kitchen_kds" | "bar_kds" | "kiosk" {
  switch (role) {
    case "host":
      return "host_stand";
    case "ods":
    case "ods_kitchen":
      return "kitchen_kds";
    case "ods_bar":
      return "bar_kds";
    case "kiosk":
      return "kiosk";
    default:
      return "floor_pos";
  }
}

export function typeForPairedRole(
  role: PairedStationRole,
): "tablet_pos" | "host_stand" | "kds" | "kiosk" {
  switch (role) {
    case "host":
      return "host_stand";
    case "ods":
    case "ods_kitchen":
    case "ods_bar":
      return "kds";
    case "kiosk":
      return "kiosk";
    default:
      return "tablet_pos";
  }
}

export function pairedRoleFromFunction(fn: string, dualOds: boolean): PairedStationRole {
  switch (fn) {
    case "kitchen_kds":
    case "expo":
    case "split":
      return dualOds ? "ods_kitchen" : "ods";
    case "bar_kds":
      return dualOds ? "ods_bar" : "ods";
    case "host_stand":
    case "busser":
      return "host";
    case "kiosk":
      return "kiosk";
    default:
      return "order";
  }
}

export function listPairedRoleOptions(opts: {
  dualOds: boolean;
  includeKiosk: boolean;
}): PairedStationRole[] {
  const roles: PairedStationRole[] = ["order", "host"];
  if (opts.dualOds) roles.push("ods_kitchen", "ods_bar");
  else roles.push("ods");
  if (opts.includeKiosk) roles.push("kiosk");
  return roles;
}

export function locationHasDualOds(
  devices: Array<{ assignment: { function: string } }>,
  operators: Array<{ stationType?: string | null }>,
): boolean {
  const kitchenOp = operators.some((o) => o.stationType === "kitchen" || o.stationType === "both");
  const barOp = operators.some((o) => o.stationType === "bar" || o.stationType === "both");
  if (kitchenOp && barOp) return true;
  const fns = new Set(devices.map((d) => d.assignment.function));
  return fns.has("kitchen_kds") && fns.has("bar_kds");
}

export function locationHasKioskRole(
  devices: Array<{ type?: string; assignment: { function: string } }>,
): boolean {
  return devices.some((d) => d.type === "kiosk" || d.assignment.function === "kiosk");
}
