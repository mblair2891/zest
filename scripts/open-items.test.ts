import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { formatCurrency } from "../src/lib/utils.ts";
import { destinationForGroup } from "../src/lib/pos/order-destinations.ts";
import {
  isBarOrderPrinter,
  isFoodOrderPrinter,
  resolveBarPrinterForCheck,
} from "../src/lib/print/printer-assignment.ts";
import {
  OPEN_FOOD_ID,
  OPEN_FOOD_NAME,
  OPEN_LIQUOR_ID,
  OPEN_LIQUOR_NAME,
  appendOpenAmountKey,
  needsOpenAmount,
  parseOpenAmountCents,
  resolveOpenEntities,
  syncOpenCatalog,
} from "../src/lib/pos/open-items.ts";
import { applyEntityMenuWrite } from "../src/lib/pos/menu-catalog-write.ts";
import { orderPadCategories, orderPadTiles, syncWellCatalog, defaultWellBook } from "../src/lib/pos/well-book.ts";

const FOOD = "opr_summit_hearth";
const BAR = "opr_summit_copper";

const vendors = [
  { id: FOOD, stationType: "kitchen" as const, active: true },
  { id: BAR, stationType: "bar" as const, active: true },
  { id: "opr_other_kitchen", stationType: "kitchen" as const, active: true },
];

const plates = {
  id: "plate",
  name: "Plate",
  categoryId: "plates",
  priceCents: 1800,
  vendorId: FOOD,
  station: "kitchen" as const,
  available: true,
  modifierGroupIds: [] as string[],
};

test("Summit Hall operators resolve food and bar, and both open items stay on every menu", () => {
  const summit = readFileSync(new URL("../src/lib/saas/summit-hall.ts", import.meta.url), "utf8");
  const seed = readFileSync(new URL("../src/lib/saas/summit-hall-seed.server.ts", import.meta.url), "utf8");
  assert.match(summit, /opr_summit_hearth/);
  assert.match(summit, /opr_summit_copper/);
  assert.match(summit, /destinationName: "Kitchen"/);
  assert.match(summit, /destinationName: "Bar"/);
  assert.match(seed, /kind: "kitchen"/);
  assert.match(seed, /kind: "bar"/);
  assert.match(seed, /\["kitchen"\]/);
  assert.match(seed, /\["bar"\]/);

  const entities = resolveOpenEntities(vendors);
  assert.equal(entities.foodId, FOOD);
  assert.equal(entities.barId, BAR);

  const synced = syncOpenCatalog({
    items: [plates],
    categories: [
      { id: "plates", name: "Plates", sort: 0, color: "#9A6700", station: "kitchen", destinationName: "Kitchen" },
    ],
    vendors,
  });
  const food = synced.items.find((item) => item.id === OPEN_FOOD_ID);
  const liquor = synced.items.find((item) => item.id === OPEN_LIQUOR_ID);
  assert.ok(food && liquor);
  assert.equal(food.vendorId, FOOD);
  assert.equal(liquor.vendorId, BAR);
  assert.equal(food.name, OPEN_FOOD_NAME);
  assert.equal(liquor.name, OPEN_LIQUOR_NAME);
  assert.equal(food.priceCents, 0);
  assert.equal(liquor.station, "bar");
  assert.equal(food.station, "kitchen");

  const foodCat = synced.categories.find((cat) => cat.id === food.categoryId);
  const barCat = synced.categories.find((cat) => cat.id === liquor.categoryId);
  assert.equal(destinationForGroup(foodCat, "kitchen"), "Kitchen");
  assert.equal(destinationForGroup(barCat, "bar"), "Bar");
  assert.equal(foodCat?.destinationName, "Kitchen");
  assert.equal(barCat?.destinationName, "Bar");

  const fire = readFileSync(new URL("../src/lib/pos/fire-routing.ts", import.meta.url), "utf8");
  assert.match(fire, /destinationForGroup\(cat/);
  assert.match(fire, /operatorId: line\.vendorId/);

  const printers = [
    {
      id: "dev_summit_prn_receipt",
      type: "receipt_printer",
      assignment: { operatorId: "host" },
      print: { station: "receipt", routes: ["receipts"] },
    },
    {
      id: "dev_summit_prn_kitchen",
      type: "order_printer",
      assignment: { operatorId: FOOD },
      print: { station: "kitchen", destinationName: "Kitchen", routes: ["kitchen_tickets"] },
    },
    {
      id: "dev_summit_prn_bar",
      type: "order_printer",
      assignment: { operatorId: BAR },
      print: { station: "bar", destinationName: "Bar", routes: ["bar_tickets"] },
    },
  ];
  const foodCents = parseOpenAmountCents("12.50");
  const liquorCents = parseOpenAmountCents("8.00");
  assert.equal(foodCents, 1250);
  assert.equal(liquorCents, 800);
  const check = [
    {
      name: food.name,
      unitPriceCents: foodCents,
      vendorId: food.vendorId,
      destination: destinationForGroup(foodCat, food.station),
    },
    {
      name: liquor.name,
      unitPriceCents: liquorCents,
      vendorId: liquor.vendorId,
      destination: destinationForGroup(barCat, liquor.station),
    },
  ];
  assert.deepEqual(
    check.map((line) => [line.name, line.unitPriceCents, line.vendorId, line.destination]),
    [
      [OPEN_FOOD_NAME, 1250, FOOD, "Kitchen"],
      [OPEN_LIQUOR_NAME, 800, BAR, "Bar"],
    ],
  );
  const barPrinter = resolveBarPrinterForCheck({ devices: printers });
  assert.equal(barPrinter?.id, "dev_summit_prn_bar");
  const kitchenPrinters = printers.filter(
    (device) =>
      isFoodOrderPrinter(device) &&
      device.print.destinationName === "Kitchen" &&
      device.assignment.operatorId === food.vendorId,
  );
  assert.deepEqual(
    kitchenPrinters.map((device) => device.id),
    ["dev_summit_prn_kitchen"],
  );
  assert.equal(isBarOrderPrinter(printers[0]), false);
  assert.equal(isFoodOrderPrinter(printers[0]), false);

  for (const vendorId of [FOOD, BAR, "opr_other_kitchen", null]) {
    const tiles = orderPadTiles({
      items: synced.items,
      vendors,
      vendorFilter: vendorId,
      categoryId: "plates",
      search: "",
    });
    const names = tiles.map((tile) => (tile.kind === "item" ? tile.item.name : tile.name));
    assert.deepEqual(names.slice(0, 2), [OPEN_FOOD_NAME, OPEN_LIQUOR_NAME]);
  }

  const cats = orderPadCategories(synced.categories, synced.items, BAR);
  assert.ok(cats.some((cat) => cat.name === OPEN_FOOD_NAME));
  assert.ok(cats.some((cat) => cat.name === OPEN_LIQUOR_NAME));
});

test("open items survive archive and a well book, and the amount is typed", () => {
  const once = syncOpenCatalog({
    items: [{ ...plates, id: OPEN_FOOD_ID, name: "Renamed", archived: true, openKind: "food" as const }],
    categories: [],
    vendors,
  });
  const food = once.items.find((item) => item.id === OPEN_FOOD_ID);
  assert.equal(food?.name, OPEN_FOOD_NAME);
  assert.equal(food?.archived, undefined);
  assert.equal(food?.available, true);
  assert.equal(once.items.filter((item) => item.id === OPEN_FOOD_ID).length, 1);

  const withWell = syncWellCatalog({
    entityId: BAR,
    config: { ...defaultWellBook(), enabled: true },
    items: once.items,
    categories: once.categories,
  });
  assert.equal(withWell.items.filter((item) => item.id === OPEN_LIQUOR_ID).length, 1);
  const again = syncOpenCatalog({ items: withWell.items, categories: withWell.categories, vendors });
  assert.equal(again.items.filter((item) => item.id === OPEN_FOOD_ID).length, 1);

  const bothOnly = syncOpenCatalog({
    items: [],
    categories: [],
    vendors: [{ id: "house", stationType: "both", active: true }],
  });
  assert.equal(bothOnly.items.every((item) => item.vendorId === "house"), true);
  assert.notEqual(
    bothOnly.categories.find((cat) => cat.name === OPEN_FOOD_NAME)?.destinationName,
    bothOnly.categories.find((cat) => cat.name === OPEN_LIQUOR_NAME)?.destinationName,
  );

  assert.equal(parseOpenAmountCents("12.50"), 1250);
  assert.equal(parseOpenAmountCents("$4"), 400);
  assert.equal(parseOpenAmountCents(""), null);
  assert.equal(parseOpenAmountCents("0"), null);
  assert.equal(parseOpenAmountCents("1.234"), null);
  assert.equal(parseOpenAmountCents("1.02"), 102);
  assert.equal(formatCurrency(102), "$1.02");
  assert.equal(parseOpenAmountCents("8888.88"), 888888);
  assert.equal(formatCurrency(888888), "$8888.88");

  let foodKeys = "";
  for (const key of ["1", ".", "0", "2"]) foodKeys = appendOpenAmountKey(foodKeys, key);
  assert.equal(foodKeys, "1.02");
  assert.equal(parseOpenAmountCents(foodKeys), 102);
  let liquorKeys = "";
  for (const key of ["8", "8", "8", "8", ".", "8", "8"]) liquorKeys = appendOpenAmountKey(liquorKeys, key);
  assert.equal(liquorKeys, "8888.88");
  assert.equal(parseOpenAmountCents(liquorKeys), 888888);
  assert.equal(needsOpenAmount({ id: OPEN_FOOD_ID }), true);
  assert.equal(needsOpenAmount({ id: OPEN_LIQUOR_ID }), true);
  assert.equal(needsOpenAmount({ id: "soup", openPrice: true }), true);
  assert.equal(needsOpenAmount({ id: "soup" }), false);

  const view = readFileSync(new URL("../src/components/pos/OrderView.tsx", import.meta.url), "utf8");
  const busy = view.slice(view.indexOf("if (busyNight)"), view.indexOf("const checkPane"));
  assert.match(busy, /OpenAmountDialog|openAmountDialog/);
  assert.match(busy, /data-open-item/);
  assert.match(view, /needsOpenAmount/);
  const dialog = readFileSync(new URL("../src/components/pos/OpenAmountDialog.tsx", import.meta.url), "utf8");
  assert.match(dialog, /data-open-keypad/);
  assert.match(dialog, /data-open-add/);
  const catalog = readFileSync(new URL("../src/lib/saas/location-catalog.ts", import.meta.url), "utf8");
  assert.match(catalog, /openPrice: r\.openPrice === true/);
  const admin = readFileSync(new URL("../src/components/pos/MenuAdminView.tsx", import.meta.url), "utf8");
  assert.match(admin, /data-item-open-price/);

  const removed = applyEntityMenuWrite(
    { items: again.items, categories: [], modifiers: [] },
    "delete",
    FOOD,
    { id: OPEN_FOOD_ID, vendorId: FOOD },
  );
  assert.equal(removed.ok, false);
});
