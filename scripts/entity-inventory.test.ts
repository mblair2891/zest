import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canOpenEntityInventory,
  entityInventoryRows,
  filterInventoryRows,
  inventoryMark,
  inventoryWhenLabel,
} from "../src/lib/costs/entity-inventory.ts";

const counted = Date.UTC(2026, 9, 11);
const received = Date.UTC(2026, 9, 1);

test("entity inventory lists menu items then ingredients", () => {
  const rows = entityInventoryRows(
    "ent",
    [
      { id: "m2", name: "Zebra", vendorId: "ent", stock: 2 },
      { id: "m1", name: "Apple", vendorId: "ent" },
      { id: "other", name: "Other", vendorId: "nope", stock: 9 },
      { id: "arch", name: "Gone", vendorId: "ent", archived: true, stock: 4 },
    ],
    [
      { id: "s1", name: "Vodka", entityId: "ent", unit: "btl", onHand: 6, parMin: 6 },
      { id: "s2", name: "Limes", entityId: "ent", unit: "each", onHand: 40, parMin: 36 },
      { id: "host", name: "House", entityId: "host", unit: "each", onHand: 1, parMin: 1 },
    ],
  );
  assert.deepEqual(
    rows.map((row) => row.name),
    ["Apple", "Zebra", "Limes", "Vodka"],
  );
  assert.equal(rows[0]?.onHand, 0);
  assert.equal(rows[0]?.unit, "each");
  assert.equal(rows[0]?.kind, "menu");
  assert.equal(rows[0]?.mark, "zero");
  assert.equal(rows[1]?.mark, "low");
  assert.equal(rows.find((row) => row.id === "s1")?.mark, "low");
  assert.equal(rows.find((row) => row.id === "s1")?.unit, "btl");
  assert.equal(rows.find((row) => row.id === "s2")?.mark, "");
});

test("search and filter narrow inventory rows", () => {
  const rows = entityInventoryRows(
    "ent",
    [{ id: "m1", name: "Copper mule", vendorId: "ent" }],
    [{ id: "s1", name: "Well vodka", entityId: "ent", unit: "btl", onHand: 6, parMin: 6 }],
  );
  assert.equal(filterInventoryRows(rows, "VODKA", "all").length, 1);
  assert.equal(filterInventoryRows(rows, "", "menu")[0]?.id, "m1");
  assert.equal(filterInventoryRows(rows, "", "ingredient")[0]?.id, "s1");
  const low = filterInventoryRows(rows, "", "low").map((row) => row.id);
  assert.deepEqual(low, ["m1", "s1"]);
});

test("last counted or received date uses the later event", () => {
  assert.match(inventoryWhenLabel(counted, received), /^Counted /);
  assert.match(inventoryWhenLabel(received, counted), /^Received /);
  assert.match(inventoryWhenLabel(undefined, received), /^Received /);
  assert.equal(inventoryWhenLabel(), "—");
});

test("zero and low marks follow on-hand rules", () => {
  assert.equal(inventoryMark("ingredient", 0, 6), "zero");
  assert.equal(inventoryMark("ingredient", 6, 6), "low");
  assert.equal(inventoryMark("ingredient", 1, 0), "");
  assert.equal(inventoryMark("menu", 1), "low");
  assert.equal(inventoryMark("menu", 2), "low");
  assert.equal(inventoryMark("menu", 3), "");
});

test("a server cannot open inventory until the location grants the role", () => {
  assert.equal(canOpenEntityInventory({ role: "server" }, []), false);
  assert.equal(canOpenEntityInventory({ role: "server" }, ["server"]), true);
  assert.equal(canOpenEntityInventory({ role: "manager" }, []), true);
  assert.equal(canOpenEntityInventory({ role: "vendor_operator" }, []), true);
  assert.equal(canOpenEntityInventory({ role: "owner" }, []), true);
  assert.equal(canOpenEntityInventory({ role: "cashier", extraViews: ["inventory"] }, []), true);
  assert.equal(canOpenEntityInventory(null, ["server"]), false);
});

test("inventory tab is on the entity dashboards and costs stays the cost workspace", () => {
  const tabs = readFileSync("src/lib/saas/venue-dashboard-tabs.ts", "utf8");
  assert.match(tabs, /\["inventory", "Inventory"\]/);
  const dash = readFileSync("src/lib/saas/password-dash.ts", "utf8");
  const fn = dash.slice(dash.indexOf("export function passwordDashTabs"));
  assert.match(fn, /case "entity_manager":[\s\S]*\["inventory", "Inventory"\]/);
  assert.match(fn, /case "entity_owner":[\s\S]*\["inventory", "Inventory"\]/);
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /tab === "inventory"/);
  assert.match(venue, /<EntityInventoryPage/);
  assert.match(venue, /tab === "costs"/);
  assert.match(venue, /<CostWorkspace/);
  const shell = readFileSync("src/components/pos/AppShell.tsx", "utf8");
  assert.match(shell, /id: "inventory", label: "Costs"/);
  const store = readFileSync("src/lib/costs/store.ts", "utf8");
  assert.match(store, /lastCountedAt: now/);
});
