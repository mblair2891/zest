import test from "node:test";
import assert from "node:assert/strict";
import { stationLayoutFromSize } from "../src/lib/ui/station-layout.ts";

test("8 inch Android handheld portrait is single-column handheld", () => {
  const l = stationLayoutFromSize(800, 1280);
  assert.equal(l.handheld, true);
  assert.equal(l.twoCol, false);
  assert.equal(l.counter, false);
  assert.equal(l.form, "handheld");
  assert.equal(l.portrait, true);
});

test("phone portrait is handheld", () => {
  const l = stationLayoutFromSize(390, 844);
  assert.equal(l.handheld, true);
  assert.equal(l.twoCol, false);
  assert.equal(l.form, "handheld");
});

test("8 inch landscape is two-col tablet, not a third skinny column", () => {
  const l = stationLayoutFromSize(1280, 800);
  assert.equal(l.handheld, false);
  assert.equal(l.twoCol, true);
  assert.equal(l.counter, false);
  assert.equal(l.form, "tablet");
});

test("small tablet landscape stays two-col and usable", () => {
  const l = stationLayoutFromSize(1024, 768);
  assert.equal(l.handheld, false);
  assert.equal(l.twoCol, true);
  assert.equal(l.counter, false);
  assert.equal(l.form, "tablet");
});

test("counter 15 inch keeps side nav", () => {
  const l = stationLayoutFromSize(1920, 1080);
  assert.equal(l.handheld, false);
  assert.equal(l.twoCol, true);
  assert.equal(l.counter, true);
  assert.equal(l.form, "counter");
});

test("10 inch tablet portrait uses handheld overlay, not three columns", () => {
  const l = stationLayoutFromSize(834, 1194);
  assert.equal(l.handheld, true);
  assert.equal(l.twoCol, false);
  assert.equal(l.form, "handheld");
});
