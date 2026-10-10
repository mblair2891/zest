import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildWellDraft,
  defaultWellBook,
  findWellDrink,
  formatWellPour,
  formatWellUpcharge,
  isDrinkEntity,
  knownWellPour,
  orderPadCategories,
  orderPadTiles,
  readWellBook,
  specialtyBesideWell,
  spiritLevelRows,
  syncWellCatalog,
  visibleWellMixers,
} from "../src/lib/pos/well-book.ts";

const roomItems = [
  {
    id: "burger",
    name: "Burger",
    categoryId: "mains",
    priceCents: 1400,
    vendorId: "food",
    station: "kitchen",
  },
];

const cats = [{ id: "mains", name: "Mains", sort: 2, station: "kitchen" }];

test("a drink entity well book adds Rum and Coke and leaves food alone", () => {
  assert.equal(isDrinkEntity({ stationType: "kitchen" }), false);
  assert.equal(isDrinkEntity({ stationType: "bar" }), true);
  assert.equal(isDrinkEntity({ stationType: "kitchen", drinks: true }), true);

  const config = { ...defaultWellBook(), enabled: true };
  const synced = syncWellCatalog({
    entityId: "bar",
    config,
    items: roomItems,
    categories: cats,
  });
  const rum = synced.items.find((item) => item.name === "Rum and Coke");
  assert.ok(rum);
  assert.equal(rum.vendorId, "bar");
  assert.equal(rum.description, "Well highball");
  assert.equal(rum.wellHidden, true);
  assert.equal(rum.available, true);
  const recipe = synced.recipes.find((row) => row.menuItemId === rum.id);
  assert.ok(recipe);
  assert.equal(formatWellPour(recipe.lines), "1.5 oz rum and cola");
  const doubled = synced.items.find((item) => item.name === "Double Rum and Coke");
  assert.ok(doubled);
  const doubleRecipe = synced.recipes.find((row) => row.menuItemId === doubled.id);
  assert.ok(doubleRecipe);
  assert.equal(formatWellPour(doubleRecipe.lines), "3 oz rum and cola");
  assert.equal(formatWellPour(synced.recipes.find((row) => row.name === "Gin and tonic")?.lines ?? []), "1.5 oz gin and tonic");
  assert.equal(formatWellPour(synced.recipes.find((row) => row.name === "Vodka and soda")?.lines ?? []), "1.5 oz vodka and soda");
  assert.equal(formatWellPour(synced.recipes.find((row) => row.name === "Whiskey and juice")?.lines ?? []), "1.5 oz whiskey and juice");
  assert.equal(formatWellPour(synced.recipes.find((row) => row.name === "Tequila and ginger ale")?.lines ?? []), "1.5 oz tequila and ginger ale");
  assert.equal(formatWellPour(synced.recipes.find((row) => row.name === "Bourbon and Coke")?.lines ?? []), "1.5 oz bourbon and cola");
  assert.equal(knownWellPour("Rum and Coke")?.phrase, "1.5 oz rum and cola");
  assert.equal(knownWellPour("Double Rum and Coke")?.phrase, "3 oz rum and cola");
  assert.equal(knownWellPour("Rum rocks"), null);
  const poured = syncWellCatalog({
    entityId: "bar",
    config: { ...config, pourOz: 2, doublePourOz: 4 },
    items: roomItems,
    categories: cats,
  });
  assert.equal(
    formatWellPour(poured.recipes.find((row) => row.name === "Rum and Coke")?.lines ?? []),
    "2 oz rum and cola",
  );
  assert.equal(
    formatWellPour(poured.recipes.find((row) => row.name === "Double Rum and Coke")?.lines ?? []),
    "4 oz rum and cola",
  );
  assert.equal(
    formatWellPour(poured.recipes.find((row) => row.name === "Rum rocks")?.lines ?? []),
    "2 oz rum",
  );
  assert.equal(synced.items.find((item) => item.id === "burger")?.vendorId, "food");
  assert.equal(synced.items.filter((item) => item.vendorId === "food").length, 1);

  const coke = config.mixers.find((mixer) => mixer.name === "cola");
  assert.ok(coke);
  const hiddenBook = {
    ...config,
    mixers: config.mixers.map((mixer) =>
      mixer.id === coke.id ? { ...mixer, hidden: true } : mixer,
    ),
  };
  const hidden = syncWellCatalog({
    entityId: "bar",
    config: hiddenBook,
    items: synced.items,
    categories: synced.categories,
    modifiers: synced.modifiers,
  });
  const gone = hidden.items.find((item) => item.name === "Rum and Coke");
  assert.equal(gone?.wellHidden, true);
  const pad = orderPadTiles({
    items: [
      ...hidden.items,
      {
        id: "beach",
        name: "Sex on the Beach",
        categoryId: "cocktails",
        priceCents: 1200,
        vendorId: "bar",
      },
    ],
    vendors: [{ id: "bar", wellBook: hiddenBook }],
    vendorFilter: "bar",
    categoryId: null,
    search: "",
  });
  const names = pad.map((row) => (row.kind === "item" ? row.item.name : row.name));
  assert.equal(names.includes("Rum and Coke"), false);
  assert.equal(names.includes("Double Rum and Coke"), false);
  assert.equal(names.includes("Vodka and Coke"), false);
  assert.equal(names.includes("Rum rocks"), false);
  assert.equal(names.includes("Rum shot"), false);
  assert.equal(names.includes("Sex on the Beach"), true);
  assert.equal(names.includes("Rum"), true);
  assert.equal(names.includes("Vodka"), true);
  assert.equal(names.includes("cola"), false);
  assert.equal(visibleWellMixers(hiddenBook).some((mixer) => mixer.id === coke.id), false);
  const wellId = hidden.categories.find((cat) => cat.name === "Wells")?.id ?? "";
  const wellNames = orderPadTiles({
    items: pad.flatMap((row) => (row.kind === "item" ? [row.item] : [])),
    vendors: [{ id: "bar", wellBook: hiddenBook }],
    vendorFilter: "bar",
    categoryId: wellId,
    search: "",
  }).map((row) => (row.kind === "item" ? row.item.name : row.name));
  assert.equal(wellNames.includes("Sex on the Beach"), false);
  assert.equal(wellNames.includes("Vodka"), true);
  assert.equal(wellNames.some((name) => / and |coke|rocks|shot/i.test(name)), false);
  const drink = findWellDrink(hidden.items, {
    entityId: "bar",
    spiritId: "spirit-3",
    mixerId: "mixer-2",
    pour: "single",
  });
  assert.equal(drink?.name, "Rum and soda");
  const doubledDrink = findWellDrink(synced.items, {
    entityId: "bar",
    spiritId: "spirit-3",
    mixerId: "mixer-1",
    pour: "double",
  });
  assert.equal(doubledDrink?.name, "Double Rum and Coke");
  const groups = orderPadCategories(hidden.categories, hidden.items, "bar");
  assert.equal(groups[0]?.name, "Wells");
  assert.equal(orderPadCategories(hidden.categories, hidden.items, "food").some((cat) => cat.name === "Wells"), false);
  assert.equal(
    hidden.items.find((item) => item.vendorId === "food")?.name,
    "Burger",
  );

  assert.equal(specialtyBesideWell(hidden.items, "bar", "Rum and Coke", false), "skip");
  assert.equal(specialtyBesideWell(hidden.items, "bar", "Old Fashioned", false), "add");
  assert.equal(specialtyBesideWell(hidden.items, "bar", "Rum and Coke", true), "add");
  assert.equal(buildWellDraft(defaultWellBook()).length, 0);
});

test("menu screen offers well book only as a drink-entity control", () => {
  const menu = readFileSync("src/components/pos/MenuAdminView.tsx", "utf8");
  const card = readFileSync("src/components/pos/WellBookCard.tsx", "utf8");
  const intake = readFileSync("src/components/pos/EntityMenuIntake.tsx", "utf8");
  assert.match(menu, /isDrinkEntity/);
  assert.match(card, /data-well-book-on=""/);
  assert.match(card, /data-well-mixer-hide=/);
  assert.match(card, /data-well-pour=""/);
  assert.match(card, /data-well-double-pour=""/);
  assert.match(intake, /data-well-book-replace=""/);
  assert.match(intake, /specialtyBesideWell/);
  const popup = readFileSync("src/components/pos/WellSpiritDialog.tsx", "utf8");
  const order = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  assert.match(popup, /data-well-spirit-popup/);
  assert.match(popup, /data-well-levels/);
  assert.match(popup, /data-well-bottle=/);
  assert.match(popup, /data-well-level=/);
  assert.match(popup, /data-well-pour="single"/);
  assert.match(popup, /data-well-pour="double"/);
  assert.match(popup, /data-well-mixer=/);
  assert.match(order, /findWellDrink/);
  assert.match(order, /orderPadTiles/);
  assert.match(order, /spiritLevelRows/);
  assert.match(order, /chargeCents/);
  const pos = readFileSync("src/components/pos/PosApp.tsx", "utf8");
  assert.match(pos, /readWellBook/);
  assert.match(pos, /wellBooks/);
});

test("spirit price levels list in-stock bottles and charge the upcharge from well", () => {
  const book = { ...defaultWellBook(), enabled: true };
  const vodka = spiritLevelRows(book, "spirit-1");
  assert.equal(vodka.length, 2);
  assert.equal(vodka[0]?.levelLabel, "Well");
  assert.equal(vodka[0]?.basePriceCents, 800);
  assert.equal(vodka[0]?.upchargeCents, 0);
  assert.equal(vodka[1]?.levelLabel, "Call");
  assert.equal(vodka[1]?.upchargeCents, 200);
  assert.equal(vodka[1]?.chargeCents, 200);
  assert.equal(formatWellUpcharge(vodka[1]?.upchargeCents ?? 0), "+$2");
  assert.equal(book.wellCents + (vodka[1]?.chargeCents ?? 0), 1000);
  assert.equal(vodka.some((row) => row.levelLabel === "Premium"), false);

  const gin = spiritLevelRows(book, "spirit-2");
  assert.equal(gin.length, 1);
  assert.equal(gin[0]?.levelLabel, "Well");
  assert.equal(gin[0]?.isWell, true);

  const bare = { ...book, bottles: undefined };
  assert.equal(spiritLevelRows(bare, "spirit-1").length, 2);
  assert.equal(spiritLevelRows(bare, "spirit-2").length, 1);

  const read = readWellBook({
    enabled: true,
    spirits: [{ id: "spirit-1", name: "Vodka" }],
    mixers: [{ id: "mixer-1", name: "cola" }],
    wellCents: 800,
    callUpchargeCents: 200,
    premiumUpchargeCents: 400,
    bottles: [
      { id: "house", spiritId: "spirit-1", name: "House", level: "Well", upchargeCents: 0, inStock: false },
      { id: "call", spiritId: "spirit-1", name: "Call", level: "Call", upchargeCents: 200, inStock: true },
      { id: "premium", spiritId: "spirit-1", name: "Premium", level: "Premium", upchargeCents: 400, inStock: false },
    ],
  });
  assert.ok(read);
  const promoted = spiritLevelRows(read, "spirit-1");
  assert.equal(promoted.length, 1);
  assert.equal(promoted[0]?.levelLabel, "Well");
  assert.equal(promoted[0]?.basePriceCents, 1000);
  assert.equal(promoted[0]?.chargeCents, 200);

  const topped = spiritLevelRows(
    {
      ...read,
      bottles: [
        { id: "house", spiritId: "spirit-1", name: "House", level: "Well", upchargeCents: 0, inStock: true },
        { id: "reserve", spiritId: "spirit-1", name: "Reserve", level: "Reserve", upchargeCents: 200, inStock: true },
        { id: "gone", spiritId: "spirit-1", name: "Empty", level: "Top", upchargeCents: 700, inStock: false },
      ],
    },
    "spirit-1",
  );
  assert.equal(topped.length, 2);
  assert.equal(topped[0]?.levelLabel, "Well");
  assert.equal(topped[0]?.basePriceCents, 800);
  assert.equal(topped[1]?.levelLabel, "Reserve");
  assert.equal(topped[1]?.upchargeCents, 200);
  assert.equal(topped[1]?.chargeCents, 200);
  assert.equal(formatWellUpcharge(topped[1]?.upchargeCents ?? 0), "+$2");
  assert.equal(topped.some((row) => row.bottleName === "Empty"), false);
});
