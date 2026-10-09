import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildWellDraft,
  defaultWellBook,
  formatWellPour,
  isDrinkEntity,
  knownWellPour,
  orderPadCategories,
  specialtyBesideWell,
  syncWellCatalog,
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
  assert.equal(rum.wellHidden, false);
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
  const hidden = syncWellCatalog({
    entityId: "bar",
    config: {
      ...config,
      mixers: config.mixers.map((mixer) =>
        mixer.id === coke.id ? { ...mixer, hidden: true } : mixer,
      ),
    },
    items: synced.items,
    categories: synced.categories,
    modifiers: synced.modifiers,
  });
  const gone = hidden.items.find((item) => item.name === "Rum and Coke");
  assert.equal(gone?.wellHidden, true);
  const pad = hidden.items.filter((item) => item.vendorId === "bar" && !item.wellHidden);
  assert.equal(pad.some((item) => item.name === "Rum and Coke"), false);
  assert.equal(pad.some((item) => item.name === "Double Rum and Coke"), false);
  assert.equal(pad.some((item) => item.name === "Rum rocks"), true);
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
});
