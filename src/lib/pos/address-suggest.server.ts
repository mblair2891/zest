import {
  addressQuery,
  dedupeSuggestions,
  suggestionsFromCensus,
  suggestionsFromNominatim,
  type AddressSuggestion,
} from "./address-suggest.ts";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const CENSUS =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

async function readJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function suggestAddresses(query: unknown): Promise<AddressSuggestion[]> {
  const q = addressQuery(query);
  if (q.length < 3) return [];
  const nominatimUrl = `${NOMINATIM}?format=jsonv2&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(q)}`;
  const censusUrl = `${CENSUS}?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(q)}`;
  const [nominatim, census] = await Promise.all([
    readJson(nominatimUrl, {
      Accept: "application/json",
      "User-Agent": "Summex/1.0 (venue settings)",
    }).catch(() => null),
    readJson(censusUrl, { Accept: "application/json" }).catch(() => null),
  ]);
  return dedupeSuggestions([
    ...suggestionsFromCensus(census),
    ...suggestionsFromNominatim(nominatim),
  ]).slice(0, 6);
}
