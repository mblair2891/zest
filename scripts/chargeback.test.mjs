import test from "node:test";
import assert from "node:assert/strict";

/** Mirrors src/lib/pos/settlement.ts allocateChargebackFee. */
function allocate(lines, feeCents = 3500) {
  const merch = new Map();
  for (const l of lines) merch.set(l.v, (merch.get(l.v) ?? 0) + l.cents);
  const entries = [...merch.entries()].filter(([, n]) => n > 0);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (!entries.length || total <= 0) return [];
  if (entries.length === 1) {
    return [{ v: entries[0][0], fee: feeCents }];
  }
  let allocated = 0;
  return entries.map(([v, n], i) => {
    const last = i === entries.length - 1;
    const fee = last ? feeCents - allocated : Math.round((feeCents * n) / total);
    allocated += fee;
    return { v, fee };
  });
}

test("$35 split 65/35 on mixed merchandise", () => {
  const alloc = allocate([
    { v: "food", cents: 6500 },
    { v: "bar", cents: 3500 },
  ]);
  const food = alloc.find((a) => a.v === "food");
  const bar = alloc.find((a) => a.v === "bar");
  assert.equal(food.fee + bar.fee, 3500);
  assert.equal(food.fee, 2275);
  assert.equal(bar.fee, 1225);
});

test("single operator takes the full $35", () => {
  const alloc = allocate([{ v: "food", cents: 4000 }]);
  assert.equal(alloc.length, 1);
  assert.equal(alloc[0].fee, 3500);
});

test("no merchandise → no fee share", () => {
  assert.equal(allocate([]).length, 0);
});
