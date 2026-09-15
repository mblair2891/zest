import test from "node:test";
import assert from "node:assert/strict";

/** Mirrors src/lib/pos/cash-discount.ts — cash is entered; card is marked up. */

function cardRawCents(cashCents, percent) {
  if (cashCents <= 0) return 0;
  return Math.round(cashCents * (1 + percent / 100));
}

function roundUpToIncrementCents(cents, incrementCents) {
  if (cents <= 0) return 0;
  if (incrementCents <= 0) return cents;
  const rem = cents % incrementCents;
  if (rem === 0) return cents;
  return cents + (incrementCents - rem);
}

function cardPriceCents(cashCents, percent, incrementCents) {
  const raw = cardRawCents(cashCents, percent);
  return roundUpToIncrementCents(raw, incrementCents);
}

function cashFromCardCents(cardCents, percent) {
  if (cardCents <= 0) return 0;
  if (!percent) return cardCents;
  return Math.round(cardCents / (1 + percent / 100));
}

test("$18 cash @ 5% increment $1.00 → $19 card", () => {
  assert.equal(cardRawCents(1800, 5), 1890);
  assert.equal(cardPriceCents(1800, 5, 100), 1900);
});

test("$12 cash @ 5% increment $0.25 → $12.75 card", () => {
  assert.equal(cardRawCents(1200, 5), 1260);
  assert.equal(cardPriceCents(1200, 5, 25), 1275);
});

test("$15 cash @ 5% increment $0.25 → $15.75 card", () => {
  assert.equal(cardRawCents(1500, 5), 1575);
  assert.equal(cardPriceCents(1500, 5, 25), 1575);
});

test("exact increment is not bumped", () => {
  assert.equal(roundUpToIncrementCents(1900, 100), 1900);
  assert.equal(roundUpToIncrementCents(1275, 25), 1275);
  assert.equal(roundUpToIncrementCents(1100, 50), 1100);
});

test("round up to $0.50 and $1.00", () => {
  assert.equal(cardPriceCents(1200, 5, 50), 1300);
  assert.equal(cardPriceCents(1200, 5, 100), 1300);
  assert.equal(cardPriceCents(1800, 5, 25), 1900);
});

test("never card-minus-percent for the till", () => {
  assert.notEqual(Math.round(1800 * (1 - 5 / 100)), 1800);
  assert.equal(cardPriceCents(1800, 5, 100) > 1800, true);
});

test("quoted card inverts markup only", () => {
  assert.equal(cashFromCardCents(1900, 5), 1810);
});

test("zero inputs", () => {
  assert.equal(cardPriceCents(0, 5, 25), 0);
  assert.equal(roundUpToIncrementCents(0, 25), 0);
});
