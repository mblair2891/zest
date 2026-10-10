/**
 * Who may edit one selling entity's own settings, and how empty values read.
 * Venue name, address, and timezone are a different gate (canEditVenueProfile).
 */

export const ENTITY_TIP_PLACEHOLDERS = ["15", "18", "20", "25"] as const;

export const ENTITY_FIELD_PLACEHOLDERS = {
  legalName: "Legal name",
  dba: "Doing business as",
  menuDisplayName: "Name on the menu",
  pinLength: "4, 5, or 6",
} as const;

export function parsePinLength(raw: unknown): 4 | 5 | 6 | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (n === 4 || n === 5 || n === 6) return n;
  return null;
}

/** Blank slots are skipped. A value outside 0–100 throws. */
export function parseTipPercents(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: number[] = [];
  for (const item of list) {
    if (out.length >= 4) break;
    if (item == null || String(item).trim() === "") continue;
    const n = typeof item === "number" ? item : Number(String(item).trim());
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error("Tip percents are 0 to 100.");
    }
    out.push(Math.round(n * 100) / 100);
  }
  return out;
}

export function readTipPercents(raw: unknown): number[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parseTipPercents(parsed);
  } catch {
    return [];
  }
}

export function tipPercentFields(values: readonly number[]): string[] {
  const next = ["", "", "", ""];
  values.slice(0, 4).forEach((n, i) => {
    next[i] = String(n);
  });
  return next;
}

/**
 * The location side may override an entity. A house owner or manager is that
 * side. An entity admin whose email is the location contact may also override.
 */
export function locationContactMayEditEntity(opts: {
  email: string | null | undefined;
  contactEmail: string | null | undefined;
  checklistEmail: string | null | undefined;
  role: string | null | undefined;
  operatorId: string | null | undefined;
}): boolean {
  const role = String(opts.role || "").trim().toLowerCase();
  if (role === "platform_admin") return true;
  const op = String(opts.operatorId || "").trim();
  const house = (role === "owner" || role === "manager") && (!op || op === "host");
  if (house) return true;
  const contact = String(opts.contactEmail || "").trim().toLowerCase();
  const checklist = String(opts.checklistEmail || "").trim().toLowerCase();
  const email = String(opts.email || "").trim().toLowerCase();
  if (!email) return false;
  return (Boolean(contact) && email === contact) || (Boolean(checklist) && email === checklist);
}

export function canEditEntitySettings(opts: {
  targetOperatorId: string;
  actorOperatorId: string | null | undefined;
  locationContact: boolean;
  platformAdmin: boolean;
}): boolean {
  const target = String(opts.targetOperatorId || "").trim();
  if (!target) return false;
  if (opts.platformAdmin || opts.locationContact) return true;
  const mine = String(opts.actorOperatorId || "").trim();
  return Boolean(mine) && mine === target;
}
