/**
 * Cash custody: each staff row has exactly one assignment.
 * Kitchen PIN is never assigned cash.
 */
export const CASH_CUSTODY_KINDS = ["house_drawer", "personal_bank", "none"] as const;
export type CashCustodyKind = (typeof CASH_CUSTODY_KINDS)[number];

export const CASH_CUSTODY_LABEL: Record<CashCustodyKind, string> = {
  house_drawer: "House drawer",
  personal_bank: "Personal bank",
  none: "None (no cash)",
};

export const HOUSE_DRAWER_MODES = ["exclusive", "shared", "multi_drawer"] as const;
export type HouseDrawerMode = (typeof HOUSE_DRAWER_MODES)[number];

export const HOUSE_DRAWER_MODE_LABEL: Record<HouseDrawerMode, string> = {
  exclusive: "Exclusive — one PIN pops that drawer",
  shared: "Shared — multiple PINs, one float; tenders stamped with who",
  multi_drawer: "Multi-drawer — one person may own more than one well",
};

const KITCHEN_ROLES = new Set(["kitchen"]);

export const DEFAULT_CUSTODY_BY_ROLE: Record<string, CashCustodyKind> = {
  bartender: "house_drawer",
  cashier: "house_drawer",
  host: "house_drawer",
  manager: "house_drawer",
  owner: "house_drawer",
  supervisor: "house_drawer",
  server: "personal_bank",
  kitchen: "none",
  busser: "none",
  vendor_operator: "none",
  accountant: "none",
  kiosk: "none",
};

export function parseCashCustodyKind(raw: unknown): CashCustodyKind | null {
  const s = String(raw ?? "");
  return (CASH_CUSTODY_KINDS as readonly string[]).includes(s) ? (s as CashCustodyKind) : null;
}

export function parseHouseDrawerMode(raw: unknown): HouseDrawerMode {
  const s = String(raw ?? "");
  return (HOUSE_DRAWER_MODES as readonly string[]).includes(s) ? (s as HouseDrawerMode) : "exclusive";
}

export function parseCustodyByRole(raw: unknown): Record<string, CashCustodyKind> {
  const out: Record<string, CashCustodyKind> = { ...DEFAULT_CUSTODY_BY_ROLE };
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const kind = parseCashCustodyKind(v);
    if (k && kind) out[k] = kind;
  }
  out.kitchen = "none";
  return out;
}

export function parseCustodyByEmployee(raw: unknown): Record<string, CashCustodyKind> {
  const out: Record<string, CashCustodyKind> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const kind = parseCashCustodyKind(v);
    if (k && kind) out[k] = kind;
  }
  return out;
}

export function isKitchenCashRole(role: string | null | undefined): boolean {
  return Boolean(role && KITCHEN_ROLES.has(role));
}

/** Effective assignment for this PIN. Kitchen is always none. */
export function staffCustody(opts: {
  role: string | null | undefined;
  roleDefaults?: Record<string, CashCustodyKind> | null;
  employeeOverride?: CashCustodyKind | null;
}): CashCustodyKind {
  const role = opts.role ?? "";
  if (isKitchenCashRole(role)) return "none";
  if (opts.employeeOverride) return opts.employeeOverride;
  const defaults = opts.roleDefaults ?? DEFAULT_CUSTODY_BY_ROLE;
  return defaults[role] ?? "none";
}

export function drawerAllowsAnotherHolder(
  mode: HouseDrawerMode,
  currentHolders: number,
): boolean {
  if (mode === "exclusive") return currentHolders < 1;
  return true;
}

export function personAllowsAnotherDrawer(
  mode: HouseDrawerMode,
  drawersThisPersonHolds: number,
): boolean {
  if (mode === "multi_drawer") return true;
  return drawersThisPersonHolds < 1;
}

/**
 * Gate cash tender before sink routing.
 * Possession is required for house_drawer and personal_bank.
 */
export function cashTenderBlockedReason(opts: {
  role: string | null | undefined;
  roleDefaults?: Record<string, CashCustodyKind> | null;
  employeeOverride?: CashCustodyKind | null;
  hasPossession: boolean;
}): string | null {
  const custody = staffCustody(opts);
  if (custody === "none") {
    if (isKitchenCashRole(opts.role)) {
      return "This PIN is not assigned cash. Clock only — use the kitchen display.";
    }
    return "This PIN is not assigned cash. No cash tender, drawer kick, or cash closeout.";
  }
  if (!opts.hasPossession) {
    return custody === "personal_bank"
      ? "Open your bank first (declare opening cash). You cannot tender cash until possession is accepted."
      : "Take the drawer first (declare opening cash). You cannot tender cash until possession is accepted.";
  }
  return null;
}

export function takeDrawerLabel(custody: CashCustodyKind): string {
  if (custody === "personal_bank") return "Open bank";
  return "Take drawer";
}
