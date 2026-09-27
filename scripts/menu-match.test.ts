import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canHardDelete,
  clearUnmatchedDrafts,
  findMenuMatch,
  itemHasHistory,
  mergeMenuMatch,
} from "../src/lib/menu/catalog-match.ts";

const live = [
  { id: "neg", name: "Negroni", group: "Cocktails", vendorId: "bar" },
  { id: "rum", name: "Rum and Coke", group: "Wells", vendorId: "bar" },
  { id: "burger", name: "Burger", group: "Plates", vendorId: "food" },
];

test("a second cocktail matches, and a new unused item can be deleted", () => {
  const again = findMenuMatch({ name: "negroni (2 oz)", group: "cocktails!" }, live, "bar");
  assert.equal(again?.id, "neg");
  assert.equal(findMenuMatch({ name: "Negroni", group: "Wells" }, live, "bar"), null);
  assert.equal(findMenuMatch({ name: "Rum and Coke", group: "Wells" }, live, "bar")?.id, "rum");
  assert.equal(findMenuMatch({ name: "Daiquiri", group: "Cocktails" }, live, "bar"), null);

  const replaced = mergeMenuMatch(
    "replace",
    { name: "Negroni", description: "Old", priceCents: 1400, modifiers: ["orange"] },
    { name: "Negroni", description: "Stirred", priceCents: 1600, modifiers: ["orange peel"] },
  );
  assert.equal(replaced.name, "Negroni");
  assert.equal(replaced.description, "Stirred");
  assert.equal(replaced.priceCents, 1600);

  const amended = mergeMenuMatch(
    "amend",
    { name: "Negroni", description: "Bitter", priceCents: 1400, modifiers: ["orange"] },
    { name: "Negroni", description: "Stirred", priceCents: 1500, modifiers: ["orange", "peel"] },
  );
  assert.equal(amended.name, "Negroni");
  assert.match(amended.description, /Bitter/);
  assert.match(amended.description, /Stirred/);
  assert.equal(amended.priceCents, 1500);
  assert.deepEqual(amended.modifiers, ["orange", "peel"]);

  const drafts = [
    { name: "Negroni", group: "Cocktails" },
    { name: "Daiquiri", group: "Cocktails" },
  ];
  assert.deepEqual(
    clearUnmatchedDrafts(drafts, live, "bar").map((row) => row.name),
    ["Negroni"],
  );

  assert.equal(canHardDelete("new", [], []), true);
  assert.equal(itemHasHistory("sold", [{ lines: [{ menuItemId: "sold", voided: true }] }], []), true);
  assert.equal(canHardDelete("sold", [{ lines: [{ menuItemId: "sold" }] }], []), false);

  const intake = readFileSync("src/components/pos/EntityMenuIntake.tsx", "utf8");
  const menu = readFileSync("src/components/pos/MenuAdminView.tsx", "utf8");
  assert.match(intake, /Replace all matches\./);
  assert.match(intake, /Keep both/);
  assert.match(intake, /Amend/);
  assert.match(intake, /data-menu-clear-drafts=""/);
  assert.match(intake, /findMenuMatch/);
  assert.doesNotMatch(intake.split("data-menu-clear-drafts")[1]?.slice(0, 400) ?? "", /deleteMenuItem/);
  assert.match(menu, /data-menu-list="active"/);
  assert.match(menu, /data-menu-list="archived"/);
  assert.match(menu, /data-menu-archive=""/);
  assert.match(menu, /data-menu-restore=""/);
  assert.match(menu, /data-menu-delete=""/);
  assert.match(menu, /disabled=\{itemHasHistory/);
});
