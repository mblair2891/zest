import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pdfToText, extractMenuText } from "../src/lib/menu/intake-file.ts";
import {
  applyIntakeAnswers,
  buildMenuDraft,
  buildMenuDraftFromLines,
  linesFromModelJson,
  pickIntakeLines,
  rowsToCommit,
} from "../src/lib/menu/intake.ts";

const DISCOUNT = {
  cashDiscountEnabled: true,
  cashDiscountPercent: 5,
  cashRoundIncrement: 0.25,
};

test("a one-page food PDF becomes draft plates with cash prices for entity A only", () => {
  const pdf = new TextEncoder().encode(
    "%PDF-1.4\n(PLATES)\n(Smash Burger 14)\n(Fries 5)\n(Smash Burger (no onion) 14)\n",
  );
  const text = pdfToText(pdf);
  assert.match(text, /PLATES/);
  assert.match(text, /Smash Burger 14/);

  const draft = buildMenuDraft({ text, entityId: "ent_a", settings: DISCOUNT });
  const burger = draft.rows.find((r) => r.name === "Smash Burger" && r.modifiers.length === 0);
  const fries = draft.rows.find((r) => r.name === "Fries");
  const extras = draft.rows.find((r) => r.modifiers.includes("no onion"));
  assert.ok(burger);
  assert.equal(burger.group, "Plates");
  assert.equal(burger.cashCents, 1400);
  assert.equal(burger.entityId, "ent_a");
  assert.equal(burger.station, "kitchen");
  assert.equal(burger.alcohol, false);
  assert.equal(burger.priceBasis, "ask");
  assert.ok(burger.cardCents && burger.cardCents > burger.cashCents);
  assert.ok(draft.questions.some((q) => q.kind === "basis" && q.rowId === burger.id));
  assert.equal(fries?.cashCents, 500);
  assert.equal(fries?.course, "side");
  assert.ok(extras);

  const sibling = buildMenuDraft({ text, entityId: "ent_b", settings: DISCOUNT });
  const acceptedA = draft.rows.map((r) => ({ ...r, status: "accepted" as const }));
  const dropped = { ...acceptedA[1]!, status: "dropped" as const };
  const commit = rowsToCommit(
    [acceptedA[0]!, dropped, ...sibling.rows.map((r) => ({ ...r, status: "accepted" as const }))],
    "ent_a",
  );
  assert.ok(commit.length >= 1);
  assert.ok(commit.every((r) => r.entityId === "ent_a"));
  assert.equal(commit.some((r) => r.status === "dropped"), false);
  assert.equal(commit.some((r) => r.name === dropped.name && r.id === dropped.id), false);
  for (const row of commit) {
    assert.equal("taxCategory" in row, false);
    assert.equal(JSON.stringify(row).includes("tax"), false);
  }

  const catalog = [
    { vendorId: "ent_b", name: "Old Taco" },
    { vendorId: "ent_a", name: "Existing Plate" },
  ];
  const beforeB = catalog.filter((i) => i.vendorId === "ent_b");
  const after = [
    ...catalog,
    ...commit.map((r) => ({ vendorId: r.entityId, name: r.name })),
  ];
  assert.deepEqual(
    after.filter((i) => i.vendorId === "ent_b"),
    beforeB,
  );
});

test("cash vs card, alcohol, and a labeled cash price", () => {
  const ask = buildMenuDraft({
    text: "PLATES\nSeasonal Special 12",
    entityId: "ent_a",
    settings: DISCOUNT,
  });
  assert.equal(ask.rows[0]?.cashCents, 1200);
  assert.equal(ask.rows[0]?.alcohol, null);
  assert.ok(ask.questions.some((q) => q.kind === "alcohol"));
  assert.ok(ask.questions.some((q) => q.kind === "basis"));

  const card = applyIntakeAnswers(ask, { [`basis:${ask.rows[0]!.id}`]: "card" }, DISCOUNT);
  assert.equal(card.rows[0]?.priceBasis, "card");
  assert.ok(card.rows[0]?.cashCents != null && card.rows[0]!.cashCents < 1200);
  assert.equal(
    card.questions.some((q) => q.kind === "basis"),
    false,
  );

  const drinks = buildMenuDraft({
    text: "DRINKS\nHouse Lager 7",
    entityId: "ent_a",
    settings: DISCOUNT,
  });
  assert.equal(drinks.rows[0]?.station, "bar");
  assert.equal(drinks.rows[0]?.course, "drink");
  assert.equal(drinks.rows[0]?.alcohol, true);

  const labeled = buildMenuDraft({
    text: "PLATES\nSmash Burger cash 14",
    entityId: "ent_a",
    settings: DISCOUNT,
  });
  assert.equal(labeled.rows[0]?.priceBasis, "cash");
  assert.equal(labeled.rows[0]?.cashCents, 1400);
  assert.equal(
    labeled.questions.some((q) => q.kind === "basis"),
    false,
  );

  const model = linesFromModelJson({
    items: [
      {
        group: "Plates",
        name: "Smash Burger",
        price: "14.00",
        priceKind: "cash",
        description: "Two patties",
        alcohol: false,
        tax: "8%",
      },
    ],
  });
  assert.ok(model);
  const fromModel = buildMenuDraftFromLines({
    lines: model,
    entityId: "ent_a",
    settings: { cashDiscountEnabled: false },
  });
  assert.equal(fromModel.rows[0]?.cashCents, 1400);
  assert.equal(fromModel.rows[0]?.description, "Two patties");
  assert.equal(JSON.stringify(fromModel).includes("tax"), false);
  assert.equal(pickIntakeLines([], model).source, "ai");
  assert.equal(pickIntakeLines(model, model.slice(0, 0)).source, "heuristic");
});

test("menu screen publishes accepted rows for the open entity", () => {
  const view = readFileSync("src/components/pos/MenuAdminView.tsx", "utf8");
  const panel = readFileSync("src/components/pos/EntityMenuIntake.tsx", "utf8");
  assert.match(view, /EntityMenuIntake/);
  assert.match(view, /entityId=\{menuScope \|\| ownVendorId \|\| vendorId\}/);
  assert.match(view, /SetupAssistButton/);
  assert.match(panel, /rowsToCommit/);
  assert.match(panel, /vendorId: entityId/);
  assert.match(panel, /publishLocationFn/);
  assert.match(panel, /flushLocationCatalog\("menu"\)/);
  assert.match(panel, /data-menu-intake-publish/);
  const photo = extractMenuText({
    fileName: "menu.png",
    bytes: new Uint8Array([1, 2, 3]),
    pasted: "Burger 10",
  });
  assert.equal(photo.image, true);
  assert.match(photo.text, /Burger 10/);
});
