import test from "node:test";
import assert from "node:assert/strict";

/** Mirrors src/lib/pos/cash-discount.ts */

function cashRawCents(printedCents, percent) {
  if (printedCents <= 0) return 0;
  return Math.round(printedCents * (1 - percent / 100));
}

function roundUpToIncrementCents(cents, incrementCents) {
  if (cents <= 0) return 0;
  if (incrementCents <= 0) return cents;
  const rem = cents % incrementCents;
  if (rem === 0) return cents;
  return cents + (incrementCents - rem);
}

function cashPriceCents(printedCents, percent, incrementCents) {
  const raw = cashRawCents(printedCents, percent);
  return roundUpToIncrementCents(raw, incrementCents);
}

test("$15 @ 5% increment $0.25 → $14.25 (already on increment)", () => {
  assert.equal(cashPriceCents(1500, 5, 25), 1425);
});

test("$12 @ 5% increment $0.25 → $11.50", () => {
  assert.equal(cashRawCents(1200, 5), 1140);
  assert.equal(cashPriceCents(1200, 5, 25), 1150);
});

test("$7 @ 5% increment $0.25 → $6.75", () => {
  assert.equal(cashRawCents(700, 5), 665);
  assert.equal(cashPriceCents(700, 5, 25), 675);
});

test("exact increment is not bumped", () => {
  assert.equal(roundUpToIncrementCents(1150, 25), 1150);
  assert.equal(roundUpToIncrementCents(1100, 50), 1100);
  assert.equal(roundUpToIncrementCents(1000, 100), 1000);
});

test("round up to $0.50 and $1.00", () => {
  assert.equal(cashPriceCents(1200, 5, 50), 1150);
  assert.equal(cashPriceCents(1200, 5, 100), 1200);
  assert.equal(cashPriceCents(700, 5, 50), 700);
  assert.equal(cashPriceCents(700, 5, 75), 675);
});

test("zero and disabled-scale inputs", () => {
  assert.equal(cashPriceCents(0, 5, 25), 0);
  assert.equal(roundUpToIncrementCents(0, 25), 0);
});
