import test from "node:test";
import assert from "node:assert/strict";

function allocateByShare(total, weights) {
  if (total <= 0 || !weights.length) return weights.map(() => 0);
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  const out = weights.map((w) => Math.round((total * w) / sum));
  const drift = out.reduce((s, n) => s + n, 0) - total;
  out[out.length - 1] = (out[out.length - 1] ?? 0) - drift;
  return out;
}

test("fee allocation sums to the tender", () => {
  const merch = [700, 300];
  const tax = allocateByShare(80, merch);
  const tip = allocateByShare(200, merch);
  assert.equal(tax.reduce((s, n) => s + n, 0), 80);
  assert.equal(tip.reduce((s, n) => s + n, 0), 200);
  assert.equal(tax[0], 56);
  assert.equal(tax[1], 24);
});

test("single entity takes the whole tender", () => {
  const parts = allocateByShare(1234, [500]);
  assert.deepEqual(parts, [1234]);
});

test("remainder pennies land on the last brand", () => {
  const parts = allocateByShare(100, [1, 1, 1]);
  assert.equal(parts.reduce((s, n) => s + n, 0), 100);
  assert.equal(parts[0], 33);
  assert.equal(parts[1], 33);
  assert.equal(parts[2], 34);
});
