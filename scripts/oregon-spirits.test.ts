import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addOlccRowToOrder,
  applySpiritSwaps,
  buildSpiritOrderList,
  fetchOlccMonth,
  matchOlccSpirit,
  olccRefreshPlan,
  oregonStoreSearchUrl,
  parseOlccRows,
  sameBottleSize,
  sameTypeOptions,
  searchOlccPrices,
  spiritOrderWithAdditions,
  spiritPourCostCents,
  spiritType,
  staysOnDistributor,
} from "../src/lib/costs/olcc.ts";
import {
  dropOlccOffer,
  fetchOlccItemStock,
  keepOlccOffer,
  olccPickListHtml,
  parseOlccStockPage,
  pickListByStore,
  reviewOlccOrder,
  type StockFetch,
} from "../src/lib/costs/olcc-stock.ts";
import { recipeCostCents } from "../src/lib/costs/theoretical.ts";
import type { CostSku, ItemRecipe } from "../src/lib/costs/types.ts";

const TITO_ROW = {
  itemcode: "8488B ",
  description: "TITO HANDMADE TEXAS VODKA",
  category: "VODKA",
  size: "750 ML",
  proof: "80.0",
  priceperunit: "24.95",
  unitspercase: "12",
  pricepercase: "299.4",
  asofdate: "2026-09-01T00:00:00.000",
};

const TITO_1750 = {
  ...TITO_ROW,
  itemcode: "8488C",
  size: "1.75 L",
  priceperunit: "45.95",
  pricepercase: "551.4",
};

const TITO_375 = {
  ...TITO_ROW,
  itemcode: "8488A",
  size: "375 ML",
  priceperunit: "14.95",
  pricepercase: "179.4",
};

const TITO_50 = {
  ...TITO_ROW,
  itemcode: "8488D",
  size: "50 ML",
  priceperunit: "2.95",
  pricepercase: "177.00",
};

const TITO_1000 = {
  ...TITO_ROW,
  itemcode: "8488E",
  size: "1 L",
  priceperunit: "32.95",
  pricepercase: "395.4",
};

const OTHER_VODKA = {
  ...TITO_ROW,
  itemcode: "9999A",
  description: "OTHER PLAIN VODKA",
  priceperunit: "10.00",
  pricepercase: "120.00",
};

const BEER_ROW = {
  itemcode: "1111",
  description: "HOUSE LAGER",
  category: "BEER",
  size: "12 OZ",
  proof: "",
  priceperunit: "2.00",
  pricepercase: "24.00",
  asofdate: "2026-09-01T00:00:00.000",
};

const WINE_ROW = {
  itemcode: "2222",
  description: "PINOT NOIR",
  category: "WINE",
  size: "750 ML",
  proof: "",
  priceperunit: "12.00",
  pricepercase: "144.00",
  asofdate: "2026-09-01T00:00:00.000",
};

function sku(partial: Partial<CostSku> & { id: string; name: string; category: CostSku["category"] }): CostSku {
  return {
    entityId: "e",
    unit: "bottle",
    packSize: 750,
    packLabel: "ml",
    onHand: 1,
    par: 0,
    parMin: 0,
    parMax: 0,
    costCents: 5000,
    leadDays: 1,
    ...partial,
  };
}

function recipe(lines: ItemRecipe["lines"]): ItemRecipe {
  return {
    id: "r",
    menuItemId: "m",
    menuItemIds: ["m"],
    name: "pour",
    entityId: "e",
    wasteFactor: 0,
    yieldQty: 1,
    yieldUnit: "portion",
    allergens: [],
    dietary: [],
    steps: [],
    lines,
  };
}

test("Tito's 750 uses the OLCC bottle price", () => {
  const prices = parseOlccRows([TITO_ROW, TITO_1750, OTHER_VODKA, BEER_ROW, WINE_ROW]);
  assert.equal(prices.some((row) => staysOnDistributor(row.category)), false);
  const tito = matchOlccSpirit("Tito's 750", prices);
  assert.ok(tito);
  assert.equal(tito.itemCode, "8488B");
  assert.equal(tito.bottlePriceCents, 2495);
  assert.equal(tito.casePriceCents, 29940);
  assert.equal(tito.size, "750 ML");
  assert.equal(spiritPourCostCents({ qty: 1.5, unit: "oz" }, tito), 148);
  const liquor = sku({ id: "tito", name: "Tito's 750", category: "liquor" });
  const withBook = recipeCostCents(
    recipe([{ name: "Tito's 750", skuId: "tito", qty: 1.5, unit: "oz" }]),
    [liquor],
    prices,
  );
  const skuOnly = recipeCostCents(
    recipe([{ name: "Tito's 750", skuId: "tito", qty: 1.5, unit: "oz" }]),
    [liquor],
  );
  assert.equal(withBook, 148);
  assert.notEqual(skuOnly, 148);
  assert.ok(skuOnly > 0);
  const standard = matchOlccSpirit("Tito's", prices);
  assert.equal(standard?.itemCode, "8488B");
  assert.equal(matchOlccSpirit("vodka", prices), null);
});

test("Tito search returns several sizes, and adding one keeps the house lines", () => {
  const prices = parseOlccRows([
    TITO_ROW,
    TITO_1750,
    TITO_375,
    TITO_50,
    TITO_1000,
    OTHER_VODKA,
    BEER_ROW,
    WINE_ROW,
  ]);
  const hits = searchOlccPrices(prices, "Tito");
  assert.ok(hits.length >= 4);
  assert.equal(new Set(hits.map((row) => row.size)).size, hits.length);
  for (const row of hits) {
    assert.match(row.name, /TITO/i);
    assert.ok(row.bottlePriceCents > 0);
    assert.ok(row.casePriceCents > 0);
  }
  assert.equal(searchOlccPrices(prices, "8488C")[0]?.itemCode, "8488C");
  assert.equal(searchOlccPrices(prices, "8488C")[0]?.size, "1.75 L");
  assert.ok(searchOlccPrices(prices, "375 ML").some((row) => row.itemCode === "8488A"));
  assert.equal(searchOlccPrices(prices, "Tito's").length, hits.length);
  assert.equal(searchOlccPrices(prices, "").length, prices.length);
  assert.equal(searchOlccPrices(prices, "lager").length, 0);
  assert.equal(searchOlccPrices(prices, "Pinot").length, 0);

  const house = buildSpiritOrderList({
    state: "OR",
    zip: "97201",
    prices,
    skus: [
      { name: "Tito's 750", category: "liquor", onHand: 0, par: 2 },
      { name: "Other Plain Vodka", category: "liquor", onHand: 0, par: 1 },
    ],
    recipes: [],
  });
  assert.equal(house.length, 2);
  const bigger = searchOlccPrices(prices, "1.75").find((row) => row.itemCode === "8488C");
  assert.ok(bigger);
  const added = addOlccRowToOrder(house, [], bigger, "97201");
  const order = spiritOrderWithAdditions(house, added);
  assert.equal(order.length, 3);
  assert.equal(order[0]?.itemCode, house[0]?.itemCode);
  assert.equal(order[1]?.itemCode, house[1]?.itemCode);
  assert.equal(order[2]?.itemCode, "8488C");
  assert.equal(order[2]?.bottlePriceCents, 4595);
  assert.equal(order[2]?.casePriceCents, 55140);
  assert.match(order[2]!.storeSearchUrl, /oregonliquorsearch\.com/);
  assert.match(order[2]!.storeSearchUrl, /productSearchParam=8488C/);
  assert.equal(addOlccRowToOrder(house, added, bigger, "97201").length, 1);
});

test("beer and wine stay on the SKU cost", () => {
  const prices = parseOlccRows([TITO_ROW, BEER_ROW, WINE_ROW]);
  const beer = sku({ id: "beer", name: "House Lager", category: "beer", costCents: 400, packSize: 1, packLabel: "each", unit: "each" });
  const cost = recipeCostCents(
    recipe([{ name: "House Lager", skuId: "beer", qty: 1, unit: "each" }]),
    [beer],
    prices,
  );
  assert.equal(cost, 400);
  assert.equal(matchOlccSpirit("Pinot Noir", prices), null);
});

test("a short Oregon list links the store search, and another state does not", () => {
  const prices = parseOlccRows([TITO_ROW]);
  const lines = buildSpiritOrderList({
    state: "OR",
    zip: "97201",
    prices,
    skus: [
      { name: "Tito's 750", category: "liquor", onHand: 0, par: 2 },
      { name: "House Lager", category: "beer", onHand: 0, par: 6 },
      { name: "Pinot", category: "wine", onHand: 0, par: 4 },
    ],
    recipes: [{ lines: [{ name: "Tito's 750", qty: 1.5, unit: "oz" }] }],
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.itemCode, "8488B");
  assert.equal(lines[0]?.qty, 2);
  assert.match(lines[0]!.storeSearchUrl, /oregonliquorsearch\.com/);
  assert.match(lines[0]!.storeSearchUrl, /productSearchParam=8488B/);
  assert.match(lines[0]!.storeSearchUrl, /locationSearchParam=97201/);
  assert.equal(
    buildSpiritOrderList({
      state: "WA",
      zip: "98101",
      prices,
      skus: [{ name: "Tito's 750", category: "liquor", onHand: 0, par: 2 }],
      recipes: [],
    }).length,
    0,
  );
  const url = oregonStoreSearchUrl({ itemCode: "8488B", name: "Tito's" }, "97201");
  assert.match(url, /^https:\/\/www\.oregonliquorsearch\.com\//);
});

test("the list refreshes on the 1st and again on the 20th", () => {
  const oct1 = olccRefreshPlan(new Date(2026, 9, 1), null);
  assert.deepEqual(oct1, { due: true, asOf: "2026-10-01", kind: "month-open" });
  const oct9 = olccRefreshPlan(new Date(2026, 9, 9), { forMonth: "2026-10-01", kind: "month-open" });
  assert.deepEqual(oct9, { due: false });
  const missed = olccRefreshPlan(new Date(2026, 9, 9), null);
  assert.equal(missed.due && missed.asOf, "2026-10-01");
  const oct20 = olccRefreshPlan(new Date(2026, 9, 20), { forMonth: "2026-10-01", kind: "month-open" });
  assert.deepEqual(oct20, { due: true, asOf: "2026-11-01", kind: "next-month" });
  const oct25 = olccRefreshPlan(new Date(2026, 9, 25), { forMonth: "2026-11-01", kind: "next-month" });
  assert.deepEqual(oct25, { due: false });
});

test("an empty month falls back to the newest published list, and only the open-data host is fetched", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    assert.match(url, /^https:\/\/data\.oregon\.gov\/resource\/vmf2-f83h/);
    if (url.includes("%24select=asofdate") || url.includes("$select=asofdate")) {
      return { ok: true, json: async () => [{ asofdate: "2026-09-01T00:00:00.000" }] };
    }
    if (url.includes("2026-10-01")) {
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => [TITO_ROW, BEER_ROW] };
  }) as typeof fetch;
  const rows = await fetchOlccMonth("2026-10-01", fetchImpl);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.itemCode, "8488B");
  assert.equal(rows[0]?.bottlePriceCents, 2495);
  assert.ok(calls.length >= 2);
  assert.ok(calls.every((url) => url.startsWith("https://data.oregon.gov/resource/vmf2-f83h")));
});

test("no checkout call exists, and a non-Oregon screen does not render the list", () => {
  const olcc = readFileSync("src/lib/costs/olcc.ts", "utf8");
  const panel = readFileSync("src/components/pos/OlccSpiritsPanel.tsx", "utf8");
  const api = readFileSync("src/lib/costs/api.ts", "utf8");
  for (const text of [olcc, panel, api]) {
    assert.doesNotMatch(text, /checkout|placeOrder|addToCart/i);
  }
  assert.doesNotMatch(olcc, /fetch\(\s*[`'"][^`'"]*oregonliquorsearch/i);
  assert.doesNotMatch(panel, /fetch\(/);
  assert.match(olcc, /data\.oregon\.gov\/resource\/vmf2-f83h/);
  const gate = panel.indexOf("if (!oregon) return null");
  const section = panel.indexOf("data-olcc-spirits");
  assert.ok(gate > 0 && section > gate);
  assert.match(panel, /data-olcc-store-search/);
  assert.match(panel, /data-olcc-search/);
  assert.match(panel, /data-olcc-catalog/);
  assert.match(panel, /data-olcc-row/);
  assert.match(panel, /data-olcc-bottle/);
  assert.match(panel, /data-olcc-case/);
  assert.match(panel, /data-olcc-add/);
  assert.match(panel, /searchOlccPrices\(prices, query\)/);
  assert.match(panel, /addOlccRowToOrder/);
  assert.match(panel, /The OLCC price list did not load/);
  assert.match(panel, /data-olcc-done/);
  assert.match(panel, /data-olcc-offer/);
  assert.match(panel, /data-olcc-use-store/);
  assert.match(panel, /data-olcc-remove/);
  assert.match(panel, /data-olcc-kept/);
  assert.match(panel, /data-olcc-same-type/);
  assert.match(panel, /data-olcc-option=/);
  assert.match(panel, /data-olcc-option-name/);
  assert.match(panel, /data-olcc-option-size/);
  assert.match(panel, /data-olcc-option-bottle/);
  assert.match(panel, /data-olcc-swap/);
  assert.match(panel, /data-olcc-keep/);
  assert.match(panel, /sameTypeOptions/);
  assert.match(panel, /applySpiritSwaps/);
  assert.match(olcc, /export function sameTypeOptions/);
  assert.match(olcc, /export function applySpiritSwaps/);
  const listAt = panel.indexOf("data-olcc-order-list");
  const sameOnList = panel.indexOf("data-olcc-same-type");
  const offerAt = panel.indexOf("data-olcc-offer");
  const removeAt = panel.indexOf("data-olcc-remove");
  const sameOnOffer = panel.indexOf("data-olcc-same-type", removeAt);
  assert.ok(listAt > 0 && sameOnList > listAt);
  assert.ok(offerAt > 0 && removeAt > offerAt && sameOnOffer > removeAt);
  const keepStart = panel.indexOf("const keepLine");
  const keepEnd = panel.indexOf("const printList");
  assert.match(panel.slice(keepStart, keepEnd), /setKeptChoice/);
  assert.doesNotMatch(panel.slice(keepStart, keepEnd), /setSwaps/);
  assert.match(panel, /olccPickListHtml\(house, staying\)/);
  assert.match(panel, /The house store stock check did not load/);
  assert.doesNotMatch(panel, /matchOlccSpirit/);
  assert.doesNotMatch(panel, /\.slice\(\s*0\s*,\s*2\s*\)/);
  const catalogAt = panel.indexOf("data-olcc-catalog");
  assert.ok(catalogAt > 0 && listAt > catalogAt);
  const suppliers = readFileSync("src/components/pos/SuppliersView.tsx", "utf8");
  assert.match(suppliers, /<OlccSpiritsPanel \/>/);
  assert.match(suppliers, /data-olcc-stores/);
  assert.match(suppliers, /data-olcc-set-state/);
  assert.doesNotMatch(suppliers, /oregon \? <OlccStores/);
  const orders = readFileSync("src/components/pos/CostWorkspace.tsx", "utf8");
  assert.doesNotMatch(orders, /<OlccSpiritsPanel/);
  assert.doesNotMatch(orders, /\["suppliers", "Suppliers"\]/);
  const stock = readFileSync("src/lib/costs/olcc-stock.ts", "utf8");
  assert.doesNotMatch(stock, /checkout|placeOrder|addToCart/i);
  assert.match(stock, /oregonliquorsearch\.com/);
});

const STOCK_PAGE = `<title>Product Details | Oregon Liquor Search</title>
<table class="list">
<tr onclick="agencyNumber=1278">
<td class="store-no"><span class="link">1278</span></td>
<td>GRANTS PASS</td>
<td>3500 Merlin Rd</td>
<td class="zip">97526</td>
<td class="phone">541-476-4551</td>
<td>Mon-Sun 7-10</td>
<td class="qty">14</td>
</tr>
<tr>
<td class="store-no"><span class="link">1076</span></td>
<td>GRANTS PASS</td>
<td>210 SE 8th St</td>
<td class="zip">97526</td>
<td class="phone">541-479-3729</td>
<td>Mon-Sat 9-8</td>
<td class="qty">144</td>
</tr>
</table>`;

test("a finished order keeps house lines and offers the nearest store or remove", () => {
  const rows = parseOlccStockPage(STOCK_PAGE);
  assert.equal(rows[0]?.storeNumber, "1278");
  assert.equal(rows[0]?.qty, 14);
  assert.equal(rows[1]?.storeNumber, "1076");
  assert.equal(rows[1]?.qty, 144);
  const house = {
    storeNumber: "1278",
    name: "Shop Smart",
    city: "Grants Pass",
    address: "3500 Merlin Rd",
    phone: "541-476-4551",
  };
  const review = reviewOlccOrder({
    lines: [
      { itemCode: "8488B", name: "TITO HANDMADE VODKA", size: "750 ML", qty: 1, bottlePriceCents: 2495, casePriceCents: 29940 },
      { itemCode: "9999A", name: "OTHER PLAIN VODKA", size: "750 ML", qty: 1, bottlePriceCents: 1000, casePriceCents: 12000 },
      { itemCode: "0000Z", name: "RARE BOTTLE", size: "750 ML", qty: 1, bottlePriceCents: 5000, casePriceCents: 0 },
    ],
    house,
    byItem: {
      "8488B": rows,
      "9999A": rows.filter((row) => row.storeNumber !== "1278"),
      "0000Z": [],
    },
    directory: [
      house,
      { storeNumber: "1076", name: "Grape Street", city: "Grants Pass", address: "210 SE 8th St", phone: "541-479-3729" },
    ],
  });
  assert.equal(review.staying.map((line) => line.itemCode).join(), "8488B");
  assert.equal(review.staying[0]?.storeNumber, "1278");
  assert.equal(review.offers[0]?.itemCode, "9999A");
  assert.equal(review.offers[0]?.nearest?.storeNumber, "1076");
  assert.equal(review.offers[0]?.nearest?.name, "Grape Street");
  assert.equal(review.offers[1]?.nearest, null);
  const kept = keepOlccOffer(review.staying, review.offers[0]!);
  const open = dropOlccOffer(dropOlccOffer(review.offers, "9999A"), "0000Z");
  assert.equal(open.length, 0);
  assert.equal(pickListByStore(kept).length, 2);
  const printed = olccPickListHtml("House", kept);
  assert.match(printed, /8488B/);
  assert.match(printed, /9999A/);
  assert.match(printed, /Shop Smart/);
  assert.match(printed, /Grape Street/);
  assert.doesNotMatch(printed, /0000Z/);
  assert.doesNotMatch(printed, /RARE BOTTLE/);
});

test("Tito's 750 offers other vodkas in that size, and a swap changes the line", () => {
  const prices = parseOlccRows([
    TITO_ROW,
    TITO_1750,
    TITO_50,
    OTHER_VODKA,
    {
      ...TITO_ROW,
      itemcode: "7777B",
      description: "GREY GOOSE VODKA",
      size: "750 ML",
      priceperunit: "29.95",
      pricepercase: "359.40",
    },
    {
      ...TITO_ROW,
      itemcode: "7777C",
      description: "GREY GOOSE VODKA",
      size: "1.75 L",
      priceperunit: "54.95",
      pricepercase: "659.40",
    },
    {
      ...TITO_ROW,
      itemcode: "5555B",
      description: "HOUSE BOURBON",
      category: "BOURBON",
      size: "750 ML",
      priceperunit: "22.00",
      pricepercase: "264.00",
    },
    {
      ...TITO_ROW,
      itemcode: "5556B",
      description: "OTHER BOURBON",
      category: "BOURBON",
      size: "750 ML",
      priceperunit: "18.00",
      pricepercase: "216.00",
    },
    {
      ...TITO_ROW,
      itemcode: "5555C",
      description: "HOUSE BOURBON",
      category: "BOURBON",
      size: "1.75 L",
      priceperunit: "40.00",
      pricepercase: "480.00",
    },
  ]);
  prices.push({
    itemCode: "1111",
    name: "VODKA WINE COOLER",
    size: "750 ML",
    proof: "",
    category: "WINE",
    bottlePriceCents: 1200,
    casePriceCents: 14400,
    asOf: "2026-09-01",
  });
  const tito = prices.find((row) => row.itemCode === "8488B");
  assert.ok(tito);
  assert.equal(spiritType(tito.category, tito.name), "vodka");
  assert.equal(spiritType("BOURBON", "HOUSE BOURBON"), "bourbon");
  assert.equal(sameBottleSize("750 ML", "750ml"), true);
  assert.equal(sameBottleSize("1.75 L", "1750 ML"), true);
  const options = sameTypeOptions({ itemCode: "8488B", name: tito.name, size: "750 ML" }, prices);
  assert.ok(options.length >= 2);
  for (const option of options) {
    assert.equal(spiritType(option.category, option.name), "vodka");
    assert.equal(sameBottleSize(option.size, "750 ML"), true);
    assert.notEqual(option.itemCode, "8488B");
    assert.ok(option.name.length > 0);
    assert.ok(option.size.length > 0);
    assert.ok(option.bottlePriceCents > 0);
  }
  const grey = options.find((row) => row.itemCode === "7777B");
  assert.ok(grey);
  assert.equal(grey.name, "GREY GOOSE VODKA");
  assert.equal(grey.size, "750 ML");
  assert.equal(grey.bottlePriceCents, 2995);
  assert.equal(options.some((row) => row.itemCode === "7777C" || row.itemCode === "8488C"), false);
  assert.equal(options.some((row) => row.itemCode === "5555B" || row.itemCode === "1111"), false);
  const bourbon = sameTypeOptions({ itemCode: "5555B", name: "HOUSE BOURBON", size: "750 ML" }, prices);
  assert.deepEqual(bourbon.map((row) => row.itemCode), ["5556B"]);
  assert.equal(bourbon[0]?.bottlePriceCents, 1800);
  const otherSizes = sameTypeOptions(
    { itemCode: "8488D", name: "TITO HANDMADE TEXAS VODKA", size: "50 ML" },
    prices,
  );
  assert.ok(otherSizes.some((row) => row.itemCode === "7777C"));
  assert.equal(otherSizes.every((row) => spiritType(row.category, row.name) === "vodka"), true);
  assert.equal(otherSizes.some((row) => sameBottleSize(row.size, "50 ML")), false);

  const house = buildSpiritOrderList({
    state: "OR",
    zip: "97526",
    prices,
    skus: [{ name: "Tito's 750", category: "liquor", onHand: 0, par: 2 }],
    recipes: [],
  });
  const line = house.find((row) => row.itemCode === "8488B");
  assert.ok(line);
  const swapped = applySpiritSwaps(house, { "8488B": grey }, "97526");
  const next = swapped.find((row) => row.itemCode === "7777B");
  assert.ok(next);
  assert.equal(next.name, grey.name);
  assert.equal(next.size, "750 ML");
  assert.equal(next.bottlePriceCents, 2995);
  assert.equal(next.qty, line.qty);
  assert.equal(swapped.some((row) => row.itemCode === "8488B"), false);
  assert.match(next.storeSearchUrl, /productSearchParam=7777B/);

  const review = reviewOlccOrder({
    lines: [
      {
        itemCode: "8488B",
        name: tito.name,
        size: "750 ML",
        qty: line.qty,
        bottlePriceCents: tito.bottlePriceCents,
        casePriceCents: tito.casePriceCents,
      },
    ],
    house: {
      storeNumber: "1278",
      name: "Shop Smart",
      city: "Grants Pass",
      address: "3500 Merlin Rd",
      phone: "541-476-4551",
    },
    byItem: {
      "8488B": [
        {
          storeNumber: "1076",
          city: "Grants Pass",
          address: "210 SE 8th St",
          zip: "97526",
          phone: "541-479-3729",
          qty: 4,
        },
      ],
    },
    directory: [
      {
        storeNumber: "1076",
        name: "Grape Street",
        city: "Grants Pass",
        address: "210 SE 8th St",
        phone: "541-479-3729",
      },
    ],
  });
  assert.equal(review.staying.length, 0);
  assert.equal(review.offers.length, 1);
  assert.equal(review.offers[0]?.nearest?.storeNumber, "1076");
  assert.equal(review.offers[0]?.nearest?.name, "Grape Street");
  assert.equal(dropOlccOffer(review.offers, "8488B").length, 0);
  assert.ok(sameTypeOptions(review.offers[0]!, prices).some((row) => row.itemCode === "7777B"));
});

test("stock check reads the house store from liquor search", async () => {
  const fetchImpl: StockFetch = async (input, init) => {
    const url = String(input);
    assert.match(url, /^https:\/\/www\.oregonliquorsearch\.com\//);
    const header = (name: string) => init?.headers?.[name] ?? init?.headers?.[name.toLowerCase()] ?? null;
    if (url.includes("WelcomeController")) {
      return {
        ok: false,
        status: 302,
        headers: { get: (name) => (name.toLowerCase() === "set-cookie" ? "JSESSIONID=abc; Path=/" : null) },
        text: async () => "",
      };
    }
    if (init?.method === "POST") {
      assert.match(init.body ?? "", /productSearchParam=8488B/);
      assert.match(init.body ?? "", /locationSearchParam=1278/);
      assert.match(init.body ?? "", /radiusSearchParam=60/);
      assert.equal(header("Cookie"), "JSESSIONID=abc");
      return {
        ok: false,
        status: 302,
        headers: {
          get: (name) =>
            name.toLowerCase() === "location"
              ? "https://www.oregonliquorsearch.com/servlet/FrontController?view=productlocation&action=search&productRowNum=1&column=Distance"
              : null,
        },
        text: async () => "",
      };
    }
    assert.match(url, /view=productlocation/);
    assert.equal(header("Cookie"), "JSESSIONID=abc");
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => STOCK_PAGE };
  };
  const page = await fetchOlccItemStock("8488B", "1278", fetchImpl);
  assert.equal(page.rows[0]?.storeNumber, "1278");
  assert.equal(page.rows[0]?.qty, 14);
  assert.equal(page.rows[1]?.storeNumber, "1076");
});
