import type { EmployeeRole } from "@/lib/pos/types";

/** Host-controlled: which PIN roles may use the mic on working devices. */
export type VoiceRoleKey = EmployeeRole;

export const VOICE_ROLE_KEYS: VoiceRoleKey[] = [
  "owner",
  "manager",
  "server",
  "host",
  "bartender",
  "kitchen",
  "cashier",
  "vendor_operator",
  "busser",
  "accountant",
  "kiosk",
];

export const VOICE_ROLE_LABEL: Record<VoiceRoleKey, string> = {
  owner: "Owner",
  manager: "Manager",
  server: "Server",
  host: "Host stand",
  bartender: "Bartender",
  kitchen: "Kitchen / expo",
  cashier: "Cashier",
  vendor_operator: "Vendor operator",
  busser: "Busser",
  accountant: "Accountant",
  kiosk: "Kiosk (guest)",
};

/** Defaults: floor service on; kiosk guest off; accountant/busser off. Kitchen is on but command-limited. */
export const DEFAULT_VOICE_BY_ROLE: Record<VoiceRoleKey, boolean> = {
  owner: true,
  manager: true,
  server: true,
  host: true,
  bartender: true,
  kitchen: true,
  cashier: true,
  vendor_operator: true,
  busser: false,
  accountant: false,
  kiosk: false,
};

export function parseVoiceByRole(raw: unknown): Record<VoiceRoleKey, boolean> {
  const out = { ...DEFAULT_VOICE_BY_ROLE };
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const k of VOICE_ROLE_KEYS) {
    if (typeof o[k] === "boolean") out[k] = o[k];
    if (k === "host" && typeof o.host_stand === "boolean") out.host = o.host_stand;
  }
  return out;
}

export function voiceEnabledForRole(
  map: Record<VoiceRoleKey, boolean> | null | undefined,
  role: EmployeeRole | null | undefined,
): boolean {
  if (!role) return false;
  const m = map ?? DEFAULT_VOICE_BY_ROLE;
  return Boolean(m[role]);
}
