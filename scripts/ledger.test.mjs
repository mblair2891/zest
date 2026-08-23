import test from "node:test";
import assert from "node:assert/strict";

function mergeLedger(existing, incoming) {
  const keys = new Set(existing.map((e) => e.idempotencyKey));
  const add = incoming.filter((e) => e.idempotencyKey && !keys.has(e.idempotencyKey));
  return add.length ? existing.concat(add) : existing;
}

function chargebackFees(lines, feeCents = 3500) {
  const merch = new Map();
  for (const l of lines) merch.set(l.v, (merch.get(l.v) ?? 0) + l.cents);
  const entries = [...merch.entries()].filter(([, n]) => n > 0);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  let allocated = 0;
  return entries.map(([v, n], i) => {
    const last = i === entries.length - 1;
    const fee = last ? feeCents - allocated : Math.round((feeCents * n) / total);
    allocated += fee;
    return { v, fee };
  });
}

test("idempotent merge does not double-post", () => {
  const a = [{ id: "1", idempotencyKey: "pay:x:capture", amountCents: 10000 }];
  const b = [
    { id: "1b", idempotencyKey: "pay:x:capture", amountCents: 10000 },
    { id: "2", idempotencyKey: "pay:x:tip", amountCents: 1500 },
  ];
  const merged = mergeLedger(a, b);
  assert.equal(merged.length, 2);
  assert.equal(merged.filter((e) => e.idempotencyKey === "pay:x:capture").length, 1);
});

test("$100 check 65/35 posts $22.75 / $12.25 chargeback fee", () => {
  const fees = chargebackFees([
    { v: "food", cents: 6500 },
    { v: "bar", cents: 3500 },
  ]);
  const food = fees.find((f) => f.v === "food");
  const bar = fees.find((f) => f.v === "bar");
  assert.equal(food.fee, 2275);
  assert.equal(bar.fee, 1225);
  assert.equal(food.fee + bar.fee, 3500);
});
