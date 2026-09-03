import assert from "node:assert/strict";
import test from "node:test";

function requiredReaderQty(hw) {
  return Math.max(1, Math.floor(hw?.readerQty || 1));
}

test("quotes always include at least one required reader", () => {
  assert.equal(requiredReaderQty({ readerQty: 0 }), 1);
  assert.equal(requiredReaderQty({}), 1);
  assert.equal(requiredReaderQty({ readerQty: 3 }), 3);
});

test("BYO checklist has no customer-owned bank reader", () => {
  const byo = [
    "Order tablet or POS screen (Android / iPad / browser)",
    "ODS display for kitchen or bar",
    "Wi-Fi or Ethernet receipt printer with cash-drawer kick",
    "Optional USB mag-stripe reader for gift cards (not a card-present terminal)",
  ];
  assert.equal(
    byo.some((r) => /square|your own stripe|bank terminal|you already have/i.test(r)),
    false,
  );
});
