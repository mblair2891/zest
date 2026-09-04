import assert from "node:assert/strict";
import test from "node:test";

function flagsFromLegacy(mode) {
  if (mode === "full") return ["full_self_serve", "pay_only", "print_qr_on_ticket", "table_tents"];
  if (mode === "pay_only") return ["pay_only", "print_qr_on_ticket", "table_tents"];
  return ["reorder_after_open", "pay_only", "print_qr_on_ticket", "table_tents"];
}

function canOpen(flags) {
  return flags.includes("full_self_serve");
}
function canReorder(flags) {
  return flags.includes("full_self_serve") || flags.includes("reorder_after_open");
}
function itemAllowed(station, allow) {
  if (allow === "none") return false;
  const drink = station === "bar";
  if (allow === "drinks") return drink;
  if (allow === "food") return !drink;
  return true;
}

function ticketSig(orderId, locationId, exp) {
  const s = `${locationId}|${orderId}|${exp}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(4, "0").slice(0, 4);
}

test("legacy hybrid does not silently open a check", () => {
  const flags = flagsFromLegacy("hybrid");
  assert.equal(canOpen(flags), false);
  assert.equal(canReorder(flags), true);
});

test("full self-serve can open and reorder", () => {
  const flags = flagsFromLegacy("full");
  assert.equal(canOpen(flags), true);
  assert.equal(canReorder(flags), true);
});

test("pay-only cannot order", () => {
  const flags = flagsFromLegacy("pay_only");
  assert.equal(canReorder(flags), false);
});

test("order allow drinks vs food", () => {
  assert.equal(itemAllowed("bar", "drinks"), true);
  assert.equal(itemAllowed("kitchen", "drinks"), false);
  assert.equal(itemAllowed("kitchen", "food"), true);
  assert.equal(itemAllowed("bar", "food"), false);
});

test("ticket QR is signed to check id and location", () => {
  const orderId = "ord_abc";
  const loc = "loc_hall";
  const exp = 2000000000;
  const sig = ticketSig(orderId, loc, exp);
  const token = `c.${orderId}.${exp.toString(36)}.${sig}`;
  const m = /^c\.([a-zA-Z0-9_-]+)\.([a-z0-9]+)\.([a-z0-9]{4})$/.exec(token);
  assert.ok(m);
  assert.equal(m[1], orderId);
  assert.equal(ticketSig(orderId, loc, exp), m[3]);
  assert.notEqual(ticketSig(orderId, "other", exp), m[3]);
});
