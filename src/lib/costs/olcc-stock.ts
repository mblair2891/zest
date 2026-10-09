/**
 * House-store stock for a spirits pick list.
 * Reads Oregon Liquor Search. Does not place an order.
 */

export const OLCC_SEARCH_ORIGIN = "https://www.oregonliquorsearch.com";
const WELCOME = `${OLCC_SEARCH_ORIGIN}/servlet/WelcomeController`;
const FRONT = `${OLCC_SEARCH_ORIGIN}/servlet/FrontController`;

export type OlccStockRow = {
  storeNumber: string;
  city: string;
  address: string;
  zip: string;
  phone: string;
  qty: number;
};

export type OlccNamedStore = {
  storeNumber: string;
  name: string;
  city: string;
  address: string;
  phone: string;
};

export type OlccKeptLine = {
  itemCode: string;
  name: string;
  size: string;
  qty: number;
  bottlePriceCents: number;
  casePriceCents: number;
  storeNumber: string;
  storeName: string;
  storeCity: string;
};

export type OlccStockOffer = {
  itemCode: string;
  name: string;
  size: string;
  qty: number;
  bottlePriceCents: number;
  casePriceCents: number;
  nearest: OlccNamedStore | null;
};

export type OlccOrderLine = {
  itemCode: string;
  name: string;
  size: string;
  qty: number;
  bottlePriceCents: number;
  casePriceCents: number;
};

type StockResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

export type StockFetch = (
  input: RequestInfo | URL,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<StockResponse>;

function plain(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stores on a product-location page, nearest first. */
export function parseOlccStockPage(html: string): OlccStockRow[] {
  const out: OlccStockRow[] = [];
  const seen = new Set<string>();
  for (const chunk of html.split(/<tr\b/i).slice(1)) {
    const storeNumber = (
      chunk.match(/class="link">\s*(\d+)\s*</i)?.[1] ||
      chunk.match(/agencyNumber=(\d+)/i)?.[1] ||
      ""
    ).trim();
    if (!storeNumber || seen.has(storeNumber)) continue;
    const qtyRaw = chunk.match(/class="qty">\s*([^<]*)/i)?.[1] ?? "";
    const qty = Number(qtyRaw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(qty)) continue;
    const cells = [...chunk.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => plain(match[1] ?? ""));
    seen.add(storeNumber);
    out.push({
      storeNumber,
      city: cells[1] ?? "",
      address: cells[2] ?? "",
      zip: (chunk.match(/class="zip">\s*([^<]*)/i)?.[1] ?? "").trim(),
      phone: (chunk.match(/class="phone">\s*([^<]*)/i)?.[1] ?? "").trim(),
      qty: Math.max(0, Math.floor(qty)),
    });
  }
  return out;
}

function named(row: OlccStockRow, directory: readonly OlccNamedStore[]): OlccNamedStore {
  const known = directory.find((store) => store.storeNumber === row.storeNumber);
  return {
    storeNumber: row.storeNumber,
    name: known?.name || `Store ${row.storeNumber}`,
    city: known?.city || row.city,
    address: known?.address || row.address,
    phone: known?.phone || row.phone,
  };
}

function keptFrom(line: OlccOrderLine, store: OlccNamedStore): OlccKeptLine {
  return {
    itemCode: line.itemCode,
    name: line.name,
    size: line.size,
    qty: line.qty,
    bottlePriceCents: line.bottlePriceCents,
    casePriceCents: line.casePriceCents,
    storeNumber: store.storeNumber,
    storeName: store.name,
    storeCity: store.city,
  };
}

/**
 * A line the house store has stays.
 * A line it does not have offers the nearest store that has it.
 */
export function reviewOlccOrder(input: {
  lines: readonly OlccOrderLine[];
  house: OlccNamedStore;
  byItem: Readonly<Record<string, readonly OlccStockRow[]>>;
  directory?: readonly OlccNamedStore[];
}): { staying: OlccKeptLine[]; offers: OlccStockOffer[] } {
  const directory = input.directory ?? [];
  const staying: OlccKeptLine[] = [];
  const offers: OlccStockOffer[] = [];
  const houseNumber = input.house.storeNumber.trim();
  for (const line of input.lines) {
    const rows = input.byItem[line.itemCode] ?? [];
    const atHouse = rows.find((row) => row.storeNumber === houseNumber && row.qty > 0);
    if (atHouse) {
      staying.push(keptFrom(line, input.house));
      continue;
    }
    const nearest = rows.find((row) => row.storeNumber !== houseNumber && row.qty > 0);
    offers.push({
      itemCode: line.itemCode,
      name: line.name,
      size: line.size,
      qty: line.qty,
      bottlePriceCents: line.bottlePriceCents,
      casePriceCents: line.casePriceCents,
      nearest: nearest ? named(nearest, directory) : null,
    });
  }
  return { staying, offers };
}

/** Staff keep the offered store. A line with no store is left off the list. */
export function keepOlccOffer(kept: readonly OlccKeptLine[], offer: OlccStockOffer): OlccKeptLine[] {
  if (!offer.nearest) return kept.slice();
  if (kept.some((line) => line.itemCode === offer.itemCode)) return kept.slice();
  return [...kept, keptFrom(offer, offer.nearest)];
}

export function dropOlccOffer(offers: readonly OlccStockOffer[], itemCode: string): OlccStockOffer[] {
  return offers.filter((offer) => offer.itemCode !== itemCode);
}

export function pickListByStore(lines: readonly OlccKeptLine[]): Array<{
  storeNumber: string;
  storeName: string;
  storeCity: string;
  lines: OlccKeptLine[];
}> {
  const groups: Array<{ storeNumber: string; storeName: string; storeCity: string; lines: OlccKeptLine[] }> = [];
  for (const line of lines) {
    let group = groups.find((row) => row.storeNumber === line.storeNumber);
    if (!group) {
      group = {
        storeNumber: line.storeNumber,
        storeName: line.storeName,
        storeCity: line.storeCity,
        lines: [],
      };
      groups.push(group);
    }
    group.lines.push(line);
  }
  return groups;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Print is the lines staff kept. Two stores print as two lists. */
export function olccPickListHtml(title: string, lines: readonly OlccKeptLine[]): string {
  const groups = pickListByStore(lines);
  const sections = groups
    .map((group) => {
      const where = [group.storeName, group.storeCity, group.storeNumber].filter(Boolean).join(" · ");
      const rows = group.lines
        .map(
          (line) =>
            `<tr><td>${line.qty}</td><td>${esc(line.name)}</td><td>${esc(line.size)}</td><td>${esc(line.itemCode)}</td><td>${(line.bottlePriceCents / 100).toFixed(2)}</td></tr>`,
        )
        .join("");
      return `<h2>${esc(where)}</h2><table><tr><th>Qty</th><th>Item</th><th>Size</th><th>Code</th><th>Bottle</th></tr>${rows}</table>`;
    })
    .join("");
  return `<!doctype html><title>${esc(title)} spirits</title><body><h1>${esc(title)} spirits</h1><p>Buy these at the store. This list does not place an order.</p>${sections}</body>`;
}

function cookieFrom(header: string | null, previous: string): string {
  const match = header?.match(/JSESSIONID=([^;,\s]+)/i);
  if (!match) return previous;
  return `JSESSIONID=${match[1]}`;
}

function onSearchHost(location: string): string | null {
  try {
    const url = new URL(location, OLCC_SEARCH_ORIGIN);
    if (!/oregonliquorsearch\.com$/i.test(url.hostname)) return null;
    url.protocol = "https:";
    url.hostname = "www.oregonliquorsearch.com";
    return url.toString();
  } catch {
    return null;
  }
}

async function call(
  fetchImpl: StockFetch,
  url: string,
  cookie: string,
  init?: { method?: string; body?: string },
): Promise<{ res: StockResponse; cookie: string }> {
  const headers: Record<string, string> = {
    "User-Agent": "Summex/1.0",
    Accept: "text/html",
  };
  if (cookie) headers.Cookie = cookie;
  if (init?.body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  const res = await fetchImpl(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body,
    signal: AbortSignal.timeout(15000),
  });
  return { res, cookie: cookieFrom(res.headers.get("set-cookie"), cookie) };
}

async function follow(
  fetchImpl: StockFetch,
  res: StockResponse,
  cookie: string,
): Promise<{ html: string; cookie: string }> {
  let current = res;
  let jar = cookie;
  for (let hop = 0; hop < 4; hop += 1) {
    if (current.status < 300 || current.status >= 400) break;
    const next = onSearchHost(current.headers.get("location") ?? "");
    if (!next) throw new Error("OLCC stock check left the liquor search site");
    const step = await call(fetchImpl, next, jar);
    current = step.res;
    jar = step.cookie;
  }
  if (!current.ok && (current.status < 300 || current.status >= 400)) {
    throw new Error(`OLCC stock check failed (${current.status})`);
  }
  return { html: await current.text(), cookie: jar };
}

function selectUrl(html: string, itemCode: string): string | null {
  const re = new RegExp(`href="([^"]*action=select[^"]*itemCode=${itemCode}[^"]*)"`, "i");
  const href = html.match(re)?.[1];
  if (!href) return null;
  return onSearchHost(href.replace(/&amp;/g, "&"));
}

function isStockPage(html: string): boolean {
  return /class="qty"|Product Details|Available At These Locations/i.test(html);
}

async function openSession(fetchImpl: StockFetch): Promise<string> {
  const step = await call(fetchImpl, WELCOME, "", {
    method: "POST",
    body: new URLSearchParams({ btnSubmit: "I'm 21 or older" }).toString(),
  });
  if (!step.cookie) throw new Error("OLCC stock check did not open");
  return step.cookie;
}

/** One item at the house store. Results are nearest first, within 60 miles. */
export async function fetchOlccItemStock(
  itemCode: string,
  houseStoreNumber: string,
  fetchImpl: StockFetch = fetch,
  cookie = "",
): Promise<{ rows: OlccStockRow[]; cookie: string }> {
  const code = itemCode.trim();
  const house = houseStoreNumber.trim();
  if (!code || !house) throw new Error("OLCC stock check needs an item and the house store");
  let jar = cookie || (await openSession(fetchImpl));
  const posted = await call(fetchImpl, FRONT, jar, {
    method: "POST",
    body: new URLSearchParams({
      view: "global",
      action: "search",
      productSearchParam: code,
      locationSearchParam: house,
      radiusSearchParam: "60",
      btnSearch: "Search",
    }).toString(),
  });
  jar = posted.cookie;
  let page = await follow(fetchImpl, posted.res, jar);
  jar = page.cookie;
  if (!isStockPage(page.html)) {
    const next = selectUrl(page.html, code);
    if (!next) throw new Error("OLCC stock check did not return stores");
    const selected = await call(fetchImpl, next, jar);
    jar = selected.cookie;
    page = await follow(fetchImpl, selected.res, jar);
    jar = page.cookie;
  }
  if (!isStockPage(page.html)) throw new Error("OLCC stock check did not return stores");
  return { rows: parseOlccStockPage(page.html), cookie: jar };
}

export async function fetchOlccOrderStock(
  lines: readonly { itemCode: string; qty?: number }[],
  houseStoreNumber: string,
  fetchImpl: StockFetch = fetch,
): Promise<Record<string, OlccStockRow[]>> {
  const codes = [...new Set(lines.map((line) => line.itemCode.trim()).filter(Boolean))].slice(0, 40);
  const byItem: Record<string, OlccStockRow[]> = {};
  let cookie = "";
  for (const code of codes) {
    const page = await fetchOlccItemStock(code, houseStoreNumber, fetchImpl, cookie);
    cookie = page.cookie;
    byItem[code] = page.rows;
  }
  return byItem;
}
