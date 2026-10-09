import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractMenuIntake } from "../src/lib/menu/intake.server.ts";
import {
  buildMenuDraftFromLines,
  chooseRecipe,
  editRecipePour,
  type IntakeLine,
} from "../src/lib/menu/intake.ts";
import {
  formatRecipeGuess,
  knownPourPhrase,
  linesFromDescription,
  proposeItemRecipe,
  recipeLinesToStore,
} from "../src/lib/menu/recipe-guess.ts";
import {
  addNaModifier,
  NA_DRINKS,
  naDrinkRecipe,
  recipeHasAlcohol,
  sellNaDrink,
} from "../src/lib/menu/na-drinks.ts";

const settings = { cashDiscountEnabled: false };

function line(partial: Partial<IntakeLine> & { name: string }): IntakeLine {
  return {
    group: partial.group ?? "Plates",
    name: partial.name,
    description: partial.description ?? "",
    quotedCents: partial.quotedCents ?? 1400,
    labeled: partial.labeled ?? "cash",
    modifiers: partial.modifiers ?? [],
    alcohol: partial.alcohol ?? null,
    recipeLines: partial.recipeLines,
  };
}

test("a described dish proposes a recipe, and discard stores none", () => {
  const described = linesFromDescription("Smash burger — beef patty, american cheese, brioche");
  assert.deepEqual(
    described.map((row) => row.name),
    ["beef patty", "american cheese", "brioche"],
  );
  const draft = buildMenuDraftFromLines({
    entityId: "kitchen",
    settings,
    lines: [
      line({
        name: "Smash Burger",
        description: "beef patty, american cheese, brioche",
        alcohol: false,
      }),
      line({ name: "House IPA", group: "Beer", description: "", alcohol: true }),
    ],
  });
  const burger = draft.rows.find((row) => row.name === "Smash Burger");
  assert.ok(burger?.recipe);
  assert.equal(burger.recipe.status, "guess");
  assert.equal(formatRecipeGuess(burger.recipe.lines), "1 each beef patty, 1 each american cheese, 1 each brioche");
  assert.equal(recipeLinesToStore(burger.recipe), null);
  const ipa = draft.rows.find((row) => row.name === "House IPA");
  assert.equal(ipa?.recipe, undefined);

  const discarded = chooseRecipe(draft, burger.id, "discarded");
  const kept = discarded.rows.find((row) => row.id === burger.id);
  assert.equal(kept?.name, "Smash Burger");
  assert.equal(kept?.recipe?.status, "discarded");
  assert.equal(recipeLinesToStore(kept?.recipe), null);

  const approved = chooseRecipe(draft, burger.id, "approved");
  const chosen = approved.rows.find((row) => row.id === burger.id);
  assert.equal(chosen?.recipe?.status, "approved");
  assert.deepEqual(
    recipeLinesToStore(chosen?.recipe)?.map((row) => row.name),
    ["beef patty", "american cheese", "brioche"],
  );
});

test("a menu photo of a described dish guesses a recipe, and a well does not", async () => {
  const prevX = process.env.XAI_API_KEY;
  const prevO = process.env.OPENAI_API_KEY;
  process.env.XAI_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  try {
    const draft = await extractMenuIntake({
      entityId: "bar",
      fileName: "menu.jpg",
      fileBase64: jpeg.toString("base64"),
      storedFileId: "mfile_recipe",
      settings,
      aiFetch: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    items: [
                      {
                        group: "Plates",
                        name: "Smash Burger",
                        description: "beef patty, american cheese, brioche",
                        price: "16.00",
                        priceKind: "cash",
                        alcohol: false,
                      },
                      {
                        group: "Wells",
                        name: "Rum and Coke",
                        description: "House rum with cola",
                        price: "8",
                        priceKind: "cash",
                        alcohol: true,
                      },
                      {
                        group: "Wells",
                        name: "Double Rum and Coke",
                        description: "A double pour",
                        price: "12",
                        priceKind: "cash",
                        alcohol: true,
                      },
                      {
                        group: "Cocktails",
                        name: "Margarita",
                        description: "Lime and tequila",
                        price: "14",
                        priceKind: "cash",
                        alcohol: true,
                        recipe: [
                          { name: "lime juice", qty: 1, unit: "oz" },
                          { name: "tequila", qty: 2, unit: "oz" },
                        ],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });
    const burger = draft.rows.find((row) => row.name === "Smash Burger");
    assert.equal(burger?.recipe?.status, "guess");
    assert.equal(burger?.recipe?.lines.length, 3);
    const dropped = chooseRecipe(draft, burger!.id, "discarded");
    const still = dropped.rows.find((row) => row.name === "Smash Burger");
    assert.ok(still);
    assert.equal(recipeLinesToStore(still.recipe), null);

    const rum = draft.rows.find((row) => row.name === "Rum and Coke");
    assert.equal(rum?.recipe?.status, "known");
    assert.equal(knownPourPhrase(rum?.recipe), "1.5 oz rum and cola");
    assert.equal(recipeLinesToStore(rum?.recipe)?.[0]?.qty, 1.5);
    const doubled = draft.rows.find((row) => row.name === "Double Rum and Coke");
    assert.equal(doubled?.recipe?.status, "known");
    assert.equal(knownPourPhrase(doubled?.recipe), "3 oz rum and cola");
    const edited = editRecipePour(draft, rum!.id, 2);
    assert.equal(knownPourPhrase(edited.rows.find((row) => row.name === "Rum and Coke")?.recipe), "2 oz rum and cola");
    assert.equal(chooseRecipe(draft, rum!.id, "discarded").rows.find((row) => row.name === "Rum and Coke")?.recipe?.status, "known");

    const marg = draft.rows.find((row) => row.name === "Margarita");
    assert.equal(marg?.recipe?.status, "guess");
    assert.deepEqual(
      marg?.recipe?.lines.map((row) => `${row.qty} ${row.unit} ${row.name}`),
      ["1 oz lime juice", "2 oz tequila"],
    );
  } finally {
    if (prevX === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = prevX;
    if (prevO === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevO;
  }

  const panel = readFileSync("src/components/pos/EntityMenuIntake.tsx", "utf8");
  const known = panel.split("data-recipe-known")[1]?.split("data-recipe-guess")[0] ?? "";
  assert.match(known, /data-recipe-pour/);
  assert.doesNotMatch(known, /data-recipe-approve/);
  assert.match(panel, /data-recipe-approve/);
  assert.match(panel, /data-recipe-discard/);
  assert.match(panel, /recipeLinesToStore/);
});

test("cola can be sold alone or added as a modifier with no alcohol line", () => {
  for (const drink of NA_DRINKS) {
    const lines = naDrinkRecipe(drink);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.name, drink);
    assert.equal(lines[0]?.qty, 1);
    assert.equal(lines[0]?.unit, "each");
    assert.equal(recipeHasAlcohol(lines), false);
  }
  const sold = sellNaDrink({
    entityId: "bar",
    drink: "Cola",
    priceCents: 300,
    categories: [],
    items: [],
  });
  assert.ok(sold);
  assert.equal(sold.categories[0]?.name, "Non-alcoholic");
  assert.equal(sold.items[0]?.name, "Cola");
  assert.equal(sold.items[0]?.course, "drink");
  assert.equal(sold.items[0]?.station, "bar");
  assert.equal(recipeHasAlcohol(sold.recipe.lines), false);
  assert.deepEqual(sold.recipe.lines, [{ name: "Cola", qty: 1, unit: "each" }]);
  const again = sellNaDrink({
    entityId: "bar",
    drink: "cola",
    categories: sold.categories,
    items: sold.items,
  });
  assert.equal(again?.items.length, 1);

  const modified = addNaModifier({ drink: "Cola", groups: [] });
  assert.ok(modified);
  assert.equal(modified.groups[0]?.name, "Non-alcoholic");
  assert.deepEqual(
    modified.groups[0]?.options.map((option) => option.name),
    ["Cola"],
  );
  assert.equal(recipeHasAlcohol(modified.groups[0]?.options ?? []), false);
  const second = addNaModifier({ drink: "Cola", groups: modified.groups });
  assert.equal(second?.groups[0]?.options.length, 1);

  const menu = readFileSync("src/components/pos/MenuAdminView.tsx", "utf8");
  const card = readFileSync("src/components/pos/NaDrinkAdd.tsx", "utf8");
  assert.match(menu, /NaDrinkAdd/);
  assert.match(card, /data-na-drink=/);
  assert.match(card, /data-na-sell=/);
  assert.match(card, /data-na-modifier=/);
  assert.match(card, /No alcohol line/);
});

test("a plain description still proposes when the model omits a recipe", () => {
  const guess = proposeItemRecipe({ name: "Margarita", description: "Lime and tequila" });
  assert.equal(guess?.status, "guess");
  assert.deepEqual(
    guess?.lines.map((row) => row.name),
    ["Lime", "tequila"],
  );
  assert.equal(proposeItemRecipe({ name: "House IPA" }), undefined);
  assert.equal(proposeItemRecipe({ name: "Rum & Coke", description: "House rum with cola" })?.status, "known");
});
