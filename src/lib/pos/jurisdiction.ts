/**
 * Venue jurisdiction for live cards and platform reg-bulletin targeting.
 * Bulletins never write tax rows; owners Save or Dismiss a suggestion.
 */

export type VenueJurisdiction = {
  country: string;
  state: string;
  city: string;
  taxDistrict: string;
};

export const DEFAULT_COUNTRY = "US";

export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DC", name: "District of Columbia" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const STATE_BY_CODE = new Map(US_STATES.map((s) => [s.code, s]));
const STATE_BY_NAME = new Map(US_STATES.map((s) => [s.name.toUpperCase(), s.code]));

export function normPlace(raw: unknown): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeState(raw: unknown): string {
  const s = normPlace(raw).toUpperCase();
  if (!s) return "";
  if (STATE_BY_CODE.has(s)) return s;
  return STATE_BY_NAME.get(s) ?? s.slice(0, 2);
}

export function parseJurisdiction(raw: unknown): VenueJurisdiction {
  const o = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const country = normPlace(o.country).toUpperCase() || DEFAULT_COUNTRY;
  return {
    country: country.slice(0, 2),
    state: normalizeState(o.state),
    city: normPlace(o.city).slice(0, 80),
    taxDistrict: normPlace(o.taxDistrict).slice(0, 80),
  };
}

/** Country, state, and city are required before live cards. */
export function jurisdictionIsReady(raw: unknown): boolean {
  const j = parseJurisdiction(raw);
  return Boolean(j.country && j.state && j.city);
}

export type BulletinScopeKind = "all" | "state" | "city" | "district";
export type BulletinSeverity = "info" | "action_required";

export function parseScopeKind(raw: unknown): BulletinScopeKind {
  const s = String(raw ?? "").trim();
  if (s === "state" || s === "city" || s === "district") return s;
  return "all";
}

export function parseSeverity(raw: unknown): BulletinSeverity {
  return String(raw ?? "") === "action_required" ? "action_required" : "info";
}

export type BulletinTarget = {
  scopeKind: BulletinScopeKind;
  scopeCountry: string;
  scopeState: string;
  scopeCity: string;
  scopeDistrict: string;
};

export function bulletinMatchesVenue(
  target: BulletinTarget,
  venue: { jurisdiction?: unknown; timezone?: string },
): boolean {
  if (target.scopeKind === "all") return true;
  const j = parseJurisdiction(venue.jurisdiction);
  const country = (normPlace(target.scopeCountry).toUpperCase() || DEFAULT_COUNTRY).slice(0, 2);
  if (j.country !== country) return false;
  const state = normalizeState(target.scopeState);
  if (!state || j.state !== state) return false;
  if (target.scopeKind === "state") return true;
  const city = normPlace(target.scopeCity).toLowerCase();
  if (!city || j.city.toLowerCase() !== city) return false;
  if (target.scopeKind === "city") return true;
  const dist = normPlace(target.scopeDistrict).toLowerCase();
  return Boolean(dist) && j.taxDistrict.toLowerCase() === dist;
}
