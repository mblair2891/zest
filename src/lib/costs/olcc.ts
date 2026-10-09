/**
 * Oregon distilled-spirits prices from the public OLCC monthly list.
 * Beer and wine stay on the distributor path.
 * This module never places an order and never reads a store cart.
 */

export const OLCC_DATASET = "vmf2-f83h";
export const OLCC_SODA_URL = "https://data.oregon.gov/resource/vmf2-f83h.json";
export const OREGON_LIQUOR_SEARCH = "https://www.oregonliquorsearch.com/servlet/FrontController";

export type OlccPrice = {
  itemCode: string;
  name: string;
  size: string;
  proof: string;
  category: string;
  bottlePriceCents: number;
  casePriceCents: number;
  asOf: string;
};

export type OlccRefreshKind = "month-open" | "next-month";

export type OlccBook = {
  /** Month the refresh asked for, YYYY-MM-DD (the 1st). */
  forMonth: string;
  kind: OlccRefreshKind;
  fetchedAt: string;
  /** Month actually stored, when the requested month is not published yet. */
  shownAsOf: string;
  prices: OlccPrice[];
};

const SELECT =
  "itemcode,description,size,proof,category,priceperunit,pricepercase,asofdate";

/** Bottle prices for recipe cost. Empty outside Oregon, or before the list loads. */
export function pricesForRecipeCost(
  state: string | null | undefined,
  book: OlccBook | null | undefined,
): readonly OlccPrice[] | undefined {
  if (!isOregonState(state) || !book?.prices.length) return undefined;
  return book.prices;
}

export function isOregonState(state: string | null | undefined): boolean {
  const s = String(state ?? "").trim().toLowerCase();
  return s === "or" || s === "oregon";
}

/** Beer, wine, and cider stay with the distributor. The OLCC list is spirits. */
export function staysOnDistributor(categoryOrName: string): boolean {
  return /\b(beer|wine|cider|malt beverage|seltzer)\b/i.test(categoryOrName);
}

export function zipFromAddress(address: string | null | undefined): string {
  const match = String(address ?? "").match(/\b(\d{5})(?:-\d{4})?\b/);
  return match?.[1] ?? "";
}

function monthKey(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * The 1st pulls this month. The 20th pulls next month.
 * A missed 1st still pulls this month before the 20th.
 */
export function olccRefreshPlan(
  today: Date,
  last: { forMonth: string; kind: OlccRefreshKind } | null,
): { due: true; asOf: string; kind: OlccRefreshKind } | { due: false } {
  const current = monthKey(today.getFullYear(), today.getMonth());
  const next = monthKey(today.getFullYear(), today.getMonth() + 1);
  if (today.getDate() >= 20) {
    if (last?.forMonth === next && last.kind === "next-month") return { due: false };
    return { due: true, asOf: next, kind: "next-month" };
  }
  if (last?.forMonth === current && last.kind === "month-open") return { due: false };
  return { due: true, asOf: current, kind: "month-open" };
}

function dollarsToCents(raw: unknown): number | null {
  const n = Number(String(raw ?? "").replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100 + 1e-6);
}

function asOfDay(raw: unknown): string {
  const s = String(raw ?? "");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? "";
}

export function parseOlccRows(raw: unknown): OlccPrice[] {
  if (!Array.isArray(raw)) return [];
  const out: OlccPrice[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const category = String(rec.category ?? "").trim();
    if (category && staysOnDistributor(category)) continue;
    const itemCode = String(rec.itemcode ?? rec.itemCode ?? "").trim();
    const name = String(rec.description ?? rec.name ?? "").trim();
    const bottle = dollarsToCents(rec.priceperunit ?? rec.bottlePriceCents);
    if (!itemCode || !name || bottle == null) continue;
    const casePrice = dollarsToCents(rec.pricepercase ?? rec.casePriceCents) ?? 0;
    out.push({
      itemCode,
      name: name.slice(0, 120),
      size: String(rec.size ?? "").trim().slice(0, 24),
      proof: String(rec.proof ?? "").trim().slice(0, 16),
      category: category.slice(0, 40),
      bottlePriceCents: bottle,
      casePriceCents: casePrice,
      asOf: asOfDay(rec.asofdate ?? rec.asOf),
    });
  }
  return out;
}

export function parseOlccBook(raw: unknown): OlccBook | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<OlccBook>;
  const prices = parseOlccRows(row.prices);
  const forMonth = asOfDay(row.forMonth);
  if (!forMonth || !prices.length) return null;
  const kind = row.kind === "next-month" ? "next-month" : "month-open";
  return {
    forMonth,
    kind,
    fetchedAt: String(row.fetchedAt ?? ""),
    shownAsOf: asOfDay(row.shownAsOf) || prices[0]?.asOf || forMonth,
    prices,
  };
}

function stamp(day: string): string | null {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(day) ? `${day}T00:00:00.000` : null;
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/** One month of the open-data list. Falls back to the newest published month on or before that date. */
export async function fetchOlccMonth(asOf: string, fetchImpl: typeof fetch = fetch): Promise<OlccPrice[]> {
  const day = asOf.slice(0, 10);
  const when = stamp(day);
  if (!when) return [];
  const primary = await fetchImpl(
    `${OLCC_SODA_URL}?${new URLSearchParams({
      $select: SELECT,
      $where: `asofdate='${when}'`,
      $limit: "50000",
    }).toString()}`,
  );
  if (!primary.ok) throw new Error(`OLCC price list failed (${primary.status})`);
  const rows = parseOlccRows(await readJson(primary));
  if (rows.length) return rows;
  const probe = await fetchImpl(
    `${OLCC_SODA_URL}?${new URLSearchParams({
      $select: "asofdate",
      $where: `asofdate <= '${when}'`,
      $order: "asofdate DESC",
      $limit: "1",
    }).toString()}`,
  );
  if (!probe.ok) return [];
  const found = asOfDay((await readJson(probe) as { asofdate?: string }[] | null)?.[0]?.asofdate);
  const foundStamp = stamp(found);
  if (!foundStamp || found === day) return [];
  const second = await fetchImpl(
    `${OLCC_SODA_URL}?${new URLSearchParams({
      $select: SELECT,
      $where: `asofdate='${foundStamp}'`,
      $limit: "50000",
    }).toString()}`,
  );
  if (!second.ok) return [];
  return parseOlccRows(await readJson(second));
}

function fold(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stem(word: string): string {
  return word.endsWith("s") && word.length > 3 ? word.slice(0, -1) : word;
}

/**
 * The full monthly book, narrowed by name, item code, or size.
 * An empty query returns every stored row. This is not the one-item recipe match.
 */
export function searchOlccPrices(prices: readonly OlccPrice[], query: string): OlccPrice[] {
  const q = fold(query);
  if (!q) return prices.slice();
  const codeQuery = q.replace(/ /g, "");
  const needles = q.endsWith("s") && q.length > 3 ? [q, q.slice(0, -1)] : [q];
  const out: OlccPrice[] = [];
  for (const row of prices) {
    if (staysOnDistributor(row.category) || staysOnDistributor(row.name)) continue;
    const name = fold(row.name);
    const size = fold(row.size);
    const code = fold(row.itemCode).replace(/ /g, "");
    const hit =
      needles.some((needle) => name.includes(needle) || size.includes(needle)) || code.includes(codeQuery);
    if (hit) out.push(row);
  }
  return out;
}

/** Match a recipe spirit such as "Tito's 750" to one item code. Ambiguous names do not match. */
export function matchOlccSpirit(query: string, prices: readonly OlccPrice[]): OlccPrice | null {
  if (staysOnDistributor(query)) return null;
  const raw = fold(query);
  if (!raw) return null;
  const size = raw.match(/\b(50|200|375|750|1000|1750)\b/)?.[1] ?? "";
  const words = raw
    .split(" ")
    .filter((word) => word && word !== size && !/^(ml|oz|bottle|btl|each|and|the|of|handmade)$/.test(word));
  if (!words.length) return null;
  const scored: { row: OlccPrice; score: number }[] = [];
  for (const row of prices) {
    if (staysOnDistributor(row.category) || staysOnDistributor(row.name)) continue;
    const name = fold(row.name);
    let hit = 0;
    for (const word of words) {
      if (stem(name).includes(stem(word)) || name.includes(word)) hit += 1;
    }
    if (hit !== words.length) continue;
    let score = hit * 10 + 20;
    const rowSize = fold(row.size);
    if (size && rowSize.includes(size)) score += 15;
    else if (size) score -= 8;
    scored.push({ row, score });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!.score;
  const top = scored.filter((row) => row.score >= best - 2);
  if (top.length === 1) return top[0]!.row;
  const family = new Set(top.map((row) => stem(fold(row.row.name)).slice(0, 16)));
  if (family.size === 1) {
    const standard = top.find((row) => /750/.test(row.row.size));
    if (!size && standard) return standard.row;
  }
  return null;
}

export function bottleMl(size: string): number {
  const match = size.match(/(\d+(?:\.\d+)?)\s*(ml|l|oz)\b/i);
  if (!match) return 750;
  const qty = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  if (unit === "l") return qty * 1000;
  if (unit === "oz") return qty * 29.5735;
  return qty;
}

/** Recipe cost for one spirit line, from the bottle price. */
export function spiritPourCostCents(
  line: { qty: number; unit: string },
  row: OlccPrice,
): number {
  const qty = Number(line.qty);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const unit = line.unit.trim().toLowerCase();
  if (unit === "each" || unit === "bottle" || unit === "btl" || unit === "case") {
    const price = unit === "case" ? row.casePriceCents : row.bottlePriceCents;
    return Math.round(price * qty);
  }
  const ml = unit === "oz" ? qty * 29.5735 : unit === "cl" ? qty * 10 : unit === "ml" ? qty : 0;
  if (!ml) return Math.round(row.bottlePriceCents * qty);
  const bottle = bottleMl(row.size);
  if (!bottle) return 0;
  return Math.round((ml / bottle) * row.bottlePriceCents);
}

export type SpiritOrderLine = {
  name: string;
  itemCode: string;
  size: string;
  qty: number;
  bottlePriceCents: number;
  casePriceCents: number;
  storeSearchUrl: string;
  source: "par" | "recipe" | "catalog";
};

/** Append one catalog row onto the added list. A repeat item code is left as it is. */
export function addOlccRowToOrder(
  house: readonly SpiritOrderLine[],
  added: readonly SpiritOrderLine[],
  row: OlccPrice,
  zip: string,
): SpiritOrderLine[] {
  const key = row.itemCode.trim().toLowerCase();
  if (!key) return added.slice();
  const taken = (line: SpiritOrderLine) => line.itemCode.trim().toLowerCase() === key;
  if (house.some(taken) || added.some(taken)) return added.slice();
  return [
    ...added,
    {
      name: row.name,
      itemCode: row.itemCode,
      size: row.size,
      qty: 1,
      bottlePriceCents: row.bottlePriceCents,
      casePriceCents: row.casePriceCents,
      storeSearchUrl: oregonStoreSearchUrl({ itemCode: row.itemCode, name: row.name }, zip),
      source: "catalog",
    },
  ];
}

/** House pick-list lines first, then catalog rows that are not already on that list. */
export function spiritOrderWithAdditions(
  house: readonly SpiritOrderLine[],
  added: readonly SpiritOrderLine[],
): SpiritOrderLine[] {
  const keys = new Set(house.map((line) => line.itemCode.trim().toLowerCase()).filter(Boolean));
  return [...house, ...added.filter((line) => !keys.has(line.itemCode.trim().toLowerCase()))];
}

export function oregonStoreSearchUrl(item: { itemCode?: string; name: string }, zip: string): string {
  const product = (item.itemCode || item.name).trim();
  const params = new URLSearchParams({
    view: "global",
    action: "search",
    productSearchParam: product,
    locationSearchParam: zip.trim(),
    btnSearch: "Search",
  });
  return `${OREGON_LIQUOR_SEARCH}?${params.toString()}`;
}

type ParSku = {
  name: string;
  category: string;
  onHand: number;
  par: number;
};

/** Shopping list for spirits only. Empty outside Oregon. Does not send an order. */
export function buildSpiritOrderList(input: {
  state: string | null | undefined;
  zip: string;
  prices: readonly OlccPrice[];
  skus: readonly ParSku[];
  recipes: readonly { lines: readonly { name: string; qty: number; unit: string }[] }[];
}): SpiritOrderLine[] {
  if (!isOregonState(input.state)) return [];
  const lines: SpiritOrderLine[] = [];
  const seen = new Set<string>();
  const push = (row: OlccPrice | null, name: string, qty: number, source: "par" | "recipe") => {
    const key = (row?.itemCode || name).toLowerCase();
    if (seen.has(key) || qty <= 0) return;
    seen.add(key);
    lines.push({
      name: row?.name || name,
      itemCode: row?.itemCode || "",
      size: row?.size || "",
      qty,
      bottlePriceCents: row?.bottlePriceCents ?? 0,
      casePriceCents: row?.casePriceCents ?? 0,
      storeSearchUrl: oregonStoreSearchUrl({ itemCode: row?.itemCode, name: row?.name || name }, input.zip),
      source,
    });
  };
  for (const sku of input.skus) {
    if (sku.category === "beer" || sku.category === "wine" || staysOnDistributor(sku.category) || staysOnDistributor(sku.name)) {
      continue;
    }
    if (sku.category !== "liquor") continue;
    if (!(sku.par > 0) || sku.onHand >= sku.par) continue;
    const match = matchOlccSpirit(sku.name, input.prices);
    push(match, sku.name, Math.max(1, Math.ceil(sku.par - sku.onHand)), "par");
  }
  for (const recipe of input.recipes) {
    for (const line of recipe.lines) {
      if (staysOnDistributor(line.name)) continue;
      const match = matchOlccSpirit(line.name, input.prices);
      if (!match) continue;
      push(match, line.name, 1, "recipe");
    }
  }
  return lines;
}
