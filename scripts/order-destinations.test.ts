import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ORDER_DESTINATION,
  ORDER_DESTINATION_PRESETS,
  mergeOrderDestinations,
  normalizeDestinationName,
} from "../src/lib/pos/order-destinations.ts";

test("order destinations always include Kitchen and default Kitchen", () => {
  assert.equal(DEFAULT_ORDER_DESTINATION, "Kitchen");
  assert.deepEqual([...ORDER_DESTINATION_PRESETS], [
    "Kitchen",
    "Bar",
    "Expo",
    "Window",
    "Prep",
    "Salad",
    "Pizza",
    "Dessert",
    "Other",
  ]);
  const merged = mergeOrderDestinations(["Bar"], ["Pastry"]);
  assert.ok(merged.includes("Kitchen"));
  assert.ok(merged.includes("Bar"));
  assert.ok(merged.includes("Expo"));
  assert.ok(merged.includes("Window"));
  assert.ok(merged.includes("Prep"));
  assert.ok(merged.includes("Other"));
  assert.ok(merged.includes("Pastry"));
  assert.equal(merged[0], "Kitchen");
});

test("normalize destination name", () => {
  assert.equal(normalizeDestinationName("  Hot  line  "), "Hot line");
});
