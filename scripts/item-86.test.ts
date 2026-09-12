import test from "node:test";
import assert from "node:assert/strict";
import { applyItem86Overlay, can86Item, parseItem86 } from "../src/lib/pos/item-86.ts";

test("parseItem86 only keeps boolean availability", () => {
  const map = parseItem86({ a: false, b: true, "": false, "  ": 1 });
  assert.equal(map.a, false);
  assert.equal(map.b, true);
});

test("overlay 86 and un-86 without replacing the catalog", () => {
  const items = [
    { id: "steak", available: true, name: "Steak" },
    { id: "fries", available: true, name: "Fries" },
  ];
  const six = applyItem86Overlay(items, { steak: false });
  assert.equal(six[0]?.available, false);
  assert.equal(six[1]?.available, true);
  const back = applyItem86Overlay(six, { steak: true });
  assert.equal(back[0]?.available, true);
});

test("kitchen can 86 own entity, not another brand", () => {
  const kitchen = { role: "kitchen" as const, operatorId: "op_a" };
  assert.equal(can86Item(kitchen, { vendorId: "op_a" }, []), true);
  assert.equal(can86Item(kitchen, { vendorId: "op_b" }, []), false);
  const mgr = { role: "manager" as const, operatorId: undefined };
  assert.equal(can86Item(mgr, { vendorId: "op_b" }, []), true);
});
