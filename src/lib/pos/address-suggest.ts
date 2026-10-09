/**
 * Street suggestions for venue settings.
 * A pick fills street, city, state, and timezone.
 * Typed city, name, and street keep their spaces.
 */

import { commitPlaceText, livePlace, normalizeState } from "./jurisdiction.ts";
import { guessTimezoneFromAddress, parseVenueTimezone } from "./venue-time.ts";

export type AddressSuggestion = {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  timezone: string;
};

const DIRS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);

/** Geocoder capitals become words. Spaces stay. "GRANTS PASS" → "Grants Pass". */
export function titlePlace(raw: unknown): string {
  return String(raw ?? "")
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part) || !part) return part;
      const up = part.toUpperCase();
      if (DIRS.has(up)) return up;
      if (!/[A-Za-z]/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

export function applyAddressPick(pick: {
  street?: unknown;
  city?: unknown;
  state?: unknown;
  timezone?: unknown;
}): { street: string; city: string; state: string; timezone: string } {
  const street = commitPlaceText(pick.street);
  const city = commitPlaceText(pick.city);
  const state = normalizeState(pick.state);
  const timezone = parseVenueTimezone(
    pick.timezone || guessTimezoneFromAddress(`${street}, ${city}, ${state}`),
  );
  return { street, city, state, timezone };
}

function row(parts: {
  id: string;
  street: string;
  city: string;
  state: string;
}): AddressSuggestion | null {
  const street = commitPlaceText(titlePlace(parts.street));
  const city = commitPlaceText(titlePlace(parts.city));
  const state = normalizeState(parts.state);
  if (!street && !city) return null;
  const picked = applyAddressPick({ street, city, state });
  const label = [picked.street, picked.city, picked.state].filter(Boolean).join(", ");
  return {
    id: parts.id,
    label,
    street: picked.street,
    city: picked.city,
    state: picked.state,
    timezone: picked.timezone,
  };
}

export function suggestionsFromNominatim(payload: unknown): AddressSuggestion[] {
  if (!Array.isArray(payload)) return [];
  const out: AddressSuggestion[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const address =
      o.address && typeof o.address === "object" ? (o.address as Record<string, unknown>) : {};
    const country = String(address.country_code ?? "").toLowerCase();
    if (country && country !== "us") continue;
    const street = [address.house_number, address.road].filter(Boolean).join(" ");
    const city = address.city || address.town || address.village || address.hamlet || "";
    const state = address.state || String(address["ISO3166-2-lvl4"] ?? "").replace(/^US-/, "");
    const next = row({
      id: `osm-${String(o.place_id ?? out.length)}`,
      street: String(street || ""),
      city: String(city),
      state: String(state),
    });
    if (next) out.push(next);
  }
  return dedupeSuggestions(out);
}

export function suggestionsFromCensus(payload: unknown): AddressSuggestion[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const result =
    root.result && typeof root.result === "object" ? (root.result as Record<string, unknown>) : root;
  const matches = Array.isArray(result.addressMatches) ? result.addressMatches : [];
  const out: AddressSuggestion[] = [];
  for (const item of matches) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const parts =
      o.addressComponents && typeof o.addressComponents === "object"
        ? (o.addressComponents as Record<string, unknown>)
        : {};
    const street = [
      parts.toAddress || parts.fromAddress,
      parts.preDirection,
      parts.streetName,
      parts.suffixType,
    ]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const tiger =
      o.tigerLine && typeof o.tigerLine === "object"
        ? String((o.tigerLine as Record<string, unknown>).tigerLineId ?? "")
        : "";
    const next = row({
      id: `census-${tiger || out.length}`,
      street,
      city: String(parts.city ?? ""),
      state: String(parts.state ?? ""),
    });
    if (next) out.push(next);
  }
  return dedupeSuggestions(out);
}

export function dedupeSuggestions(rows: AddressSuggestion[]): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const row of rows) {
    const key = `${row.street}|${row.city}|${row.state}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Search text keeps internal spaces. Ends are trimmed only for the request. */
export function addressQuery(raw: unknown): string {
  return commitPlaceText(livePlace(raw)).slice(0, 120);
}
