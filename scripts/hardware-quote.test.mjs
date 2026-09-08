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
    "Android tablet running the Summex Station app (sideload now; Play later).",
    "ODS display for kitchen or bar (Android tablet running Summex Station)",
    "Wi-Fi or Ethernet receipt printer with cash-drawer kick",
    "Optional USB mag-stripe reader for gift cards (not a card-present terminal)",
  ];
  assert.equal(
    byo.some((r) => /square|your own stripe|bank terminal|you already have/i.test(r)),
    false,
  );
  assert.equal(byo.some((r) => /ipad|browser POS|Android \/ iPad/i.test(r)), false);
  assert.ok(byo.some((r) => /Summex Station/i.test(r)));
});
