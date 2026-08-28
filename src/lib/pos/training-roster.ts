import type { EmployeeRole } from "./types";

/** Suggested floor PINs for a training location that has no staff yet. Location-scoped hashes. */
export const TRAINING_ROSTER: readonly {
  pin: string;
  name: string;
  role: EmployeeRole;
  color: string;
}[] = [
  { pin: "0000", name: "Manager", role: "manager", color: "#2C4A6E" },
  { pin: "1111", name: "Server", role: "server", color: "#1F7A4C" },
  { pin: "2222", name: "Host", role: "host", color: "#9A6700" },
  { pin: "3333", name: "Bartender", role: "bartender", color: "#5C5C5C" },
  { pin: "4444", name: "Kitchen", role: "kitchen", color: "#A61B1B" },
  { pin: "5555", name: "Busser", role: "busser", color: "#4A5568" },
];

export const TRAINING_PIN_HINT =
  "0000 manager · 1111 server · 2222 host · 3333 bar · 4444 kitchen · 5555 busser";

export function trainingStaffId(locationId: string, pin: string): string {
  const key = locationId.replace(/[^a-zA-Z0-9]/g, "").slice(-20) || "loc";
  return `emp_tr_${key}_${pin}`;
}

export function isTrainingRosterId(id: string): boolean {
  return id.startsWith("emp_tr_");
}
