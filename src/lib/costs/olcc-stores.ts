/**
 * Public OLCC liquor store list: the layer behind the official liquor store map.
 * Name, city, and phone. This module never places an order.
 */

import { isOregonState } from "./olcc.ts";

export const OLCC_STORES_QUERY =
  "https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/Liquor_Stores_app_view/FeatureServer/1/query";

export type OlccStore = {
  storeNumber: string;
  name: string;
  address: string;
  phone: string;
  city: string;
};

export function locationShowsOlccStores(state: string | null | undefined): boolean {
  return isOregonState(state);
}

function text(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storeNumberOf(value: unknown): string {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return String(Math.round(n));
  return text(value);
}

function rowsFrom(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>>;
  }
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { features?: unknown[]; attributes?: unknown };
  if (Array.isArray(body.features)) {
    return body.features.map((feature) => {
      if (!feature || typeof feature !== "object") return {};
      const attrs = (feature as { attributes?: unknown }).attributes;
      return attrs && typeof attrs === "object" ? (attrs as Record<string, unknown>) : {};
    });
  }
  return [];
}

/** Store name, street + city, and phone. Drops rows with no name or store number. */
export function parseOlccStorePayload(payload: unknown): OlccStore[] {
  const seen = new Set<string>();
  const out: OlccStore[] = [];
  for (const row of rowsFrom(payload)) {
    const storeNumber = storeNumberOf(row.Store_Numb ?? row.Store_Number ?? row.storeNumber);
    const name = text(row.name ?? row.Name);
    const street = text(row.Store_Addr ?? row.Store_Address ?? row.address);
    const city = text(row.City ?? row.city);
    const phone = text(row.number ?? row.phone ?? row.Phone);
    if (!storeNumber || !name || seen.has(storeNumber)) continue;
    seen.add(storeNumber);
    out.push({
      storeNumber,
      name,
      address: [street, city].filter(Boolean).join(", "),
      phone,
      city,
    });
  }
  out.sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
  return out;
}

type StoreFetch = (input: RequestInfo | URL) => Promise<{
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}>;

/** One read of the public store list. Follows a transfer limit if the service pages. */
export async function fetchOlccStores(fetchImpl: StoreFetch = fetch): Promise<OlccStore[]> {
  const features: unknown[] = [];
  let offset = 0;
  for (let page = 0; page < 8; page += 1) {
    const url = `${OLCC_STORES_QUERY}?${new URLSearchParams({
      where: "1=1",
      outFields: "Store_Numb,Store_Addr,City,name,number",
      returnGeometry: "false",
      f: "json",
      resultRecordCount: "2000",
      resultOffset: String(offset),
    })}`;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`OLCC store list failed (${res.status ?? 0})`);
    const body = (await res.json()) as { features?: unknown[]; exceededTransferLimit?: boolean };
    const chunk = Array.isArray(body.features) ? body.features : [];
    features.push(...chunk);
    if (!body.exceededTransferLimit || chunk.length === 0) break;
    offset += chunk.length;
  }
  return parseOlccStorePayload({ features });
}
