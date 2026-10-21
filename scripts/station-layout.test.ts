import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handheldStatusFill, isSmallForm, stationLayoutFromSize, stationViewportVars } from "../src/lib/ui/station-layout.ts";

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

test("elo landscape viewport is landscape and a turned phone is portrait", () => {
  const elo = stationViewportVars(1280, 800);
  assert.equal(elo.orientation, "landscape");
  assert.equal(elo.vw, "1280px");
  assert.equal(elo.vh, "800px");
  const turned = stationViewportVars(800, 1280);
  assert.equal(turned.orientation, "portrait");
  assert.equal(turned.vh, "1280px");
});

test("10 inch tablet portrait uses handheld overlay, not three columns", () => {
  const l = stationLayoutFromSize(834, 1194);
  assert.equal(l.handheld, true);
  assert.equal(l.twoCol, false);
  assert.equal(l.form, "handheld");
  assert.equal(l.smallForm, false);
});

test("a phone and an 8 inch portrait handheld use the one-hand layout", () => {
  assert.equal(isSmallForm(390, 844), true);
  assert.equal(stationLayoutFromSize(390, 844).smallForm, true);
  assert.equal(isSmallForm(844, 390), true);
  assert.equal(stationLayoutFromSize(800, 1280).smallForm, true);
  assert.equal(stationLayoutFromSize(1280, 800).smallForm, false);
  assert.equal(stationLayoutFromSize(1024, 768).smallForm, false);
  assert.equal(stationLayoutFromSize(1920, 1080).smallForm, false);
  assert.equal(handheldStatusFill("empty"), "#ffffff");
  assert.equal(handheldStatusFill("sat_no_order"), "#2563eb");
  assert.equal(handheldStatusFill("ordered_drinks"), "#2563eb");
  assert.equal(handheldStatusFill("ordered_food"), "#059669");
  assert.equal(handheldStatusFill("closed_not_cleaned"), "#e11d48");
});

test("floor, check, and menu adapt on a small form and the tablet screens stay", () => {
  const floor = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  const order = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  const menu = readFileSync("src/components/pos/ModifierDialog.tsx", "utf8");
  const pin = readFileSync("src/components/pos/PinKeypad.tsx", "utf8");
  const ods = readFileSync("src/components/pos/KitchenView.tsx", "utf8");
  const host = readFileSync("src/components/pos/HostStationView.tsx", "utf8");
  assert.match(floor, /data-floor-view-toggle/);
  assert.match(floor, /data-floor-view="list"/);
  assert.match(floor, /largeTaps=\{layout\.smallForm\}/);
  assert.match(floor, /handheldStatusFill/);
  assert.match(floor, /data-check-actions=\{handheld \? "sticky" : undefined\}/);
  assert.match(order, /layout\.width >= 640 && !layout\.smallForm/);
  assert.match(order, /data-order-actions=\{layout\.smallForm \? "sticky" : undefined\}/);
  assert.match(order, /data-menu-cols=\{layout\.smallForm \? "1" : undefined\}/);
  assert.match(order, /data-check-section="line"/);
  assert.match(menu, /data-modifier-layout=\{layout\.smallForm \? "handheld" : undefined\}/);
  assert.doesNotMatch(pin, /smallForm/);
  assert.doesNotMatch(ods, /smallForm/);
  assert.doesNotMatch(host, /smallForm/);
});
