import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { floorFit, floorMapNumber, tablePixelBox } from "../src/lib/pos/floor-fit.ts";

/** Ten-table dining room from the full-service starter, plus the bar rail. */
const ROOM = [
  { id: "1", x: 6, y: 12, w: 10, h: 10 },
  { id: "2", x: 20, y: 12, w: 10, h: 10 },
  { id: "3", x: 36, y: 10, w: 14, h: 12 },
  { id: "4", x: 54, y: 10, w: 14, h: 12 },
  { id: "5", x: 72, y: 10, w: 14, h: 12 },
  { id: "6", x: 6, y: 32, w: 18, h: 14 },
  { id: "7", x: 30, y: 32, w: 18, h: 14 },
  { id: "8", x: 54, y: 34, w: 14, h: 12 },
  { id: "9", x: 72, y: 34, w: 14, h: 12 },
  { id: "10", x: 8, y: 54, w: 20, h: 18 },
  { id: "b1", x: 8, y: 80, w: 8, h: 8 },
];

test("a 10-table map on a tablet keeps every table at least 64px", () => {
  const fit = floorFit({ tables: ROOM, viewW: 1280, viewH: 800, minTapPx: 64 });
  for (const t of ROOM) {
    const box = tablePixelBox(t, fit.pxPerPct, 64);
    assert.ok(box.width >= 64, `${t.id} width ${box.width}`);
    assert.ok(box.height >= 64, `${t.id} height ${box.height}`);
  }
  const ten = tablePixelBox(ROOM[9]!, fit.pxPerPct, 64);
  assert.ok(ten.width >= 96, `table 10 should read from a few feet, got ${ten.width}`);
});

test("a phone grows the plan until the smallest stool is 64px", () => {
  const fit = floorFit({ tables: ROOM, viewW: 390, viewH: 700, minTapPx: 64 });
  const stool = tablePixelBox(ROOM[10]!, fit.pxPerPct, 64);
  assert.ok(stool.width >= 64);
  assert.ok(stool.height >= 64);
});

test("map label is the table number only", () => {
  assert.equal(floorMapNumber("12"), "12");
  assert.equal(floorMapNumber("Table 4"), "4");
  assert.equal(floorMapNumber("B1"), "B1");
});

test("live order floor draws status blocks, not chairs", () => {
  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  const status = art.split("function StatusFixture")[1]?.split("function FloorTableArt")[0] ?? "";
  assert.ok(status.length > 40);
  assert.match(status, /data-no-chairs/);
  assert.doesNotMatch(status, /seatAnchors/);
  assert.doesNotMatch(status, /CHAIR/);
  assert.match(status, /solid/);
  const map = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(map, /mode="status"/);
  assert.match(map, /minTapPx: 64/);
  assert.match(map, /data-floor-chairs="0"/);
  assert.doesNotMatch(map, /CHECK OPEN/);
  assert.doesNotMatch(map, /SLA/);
  const nav = readFileSync("src/components/pos/BusyNightStation.tsx", "utf8");
  assert.match(nav, /Floor/);
  assert.match(nav, /Checks/);
  assert.match(nav, /Menu/);
  assert.match(nav, /Pay/);
  assert.match(nav, /data-busy-nav/);
  const floor = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(floor, /data-floor-more/);
  assert.match(floor, /data-seat-now/);
  assert.match(floor, /data-busy-actions/);
  const order = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  assert.match(order, /data-menu-categories/);
  assert.match(order, /data-live-pad/);
  assert.match(order, /onSent/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /no chair/i);
  assert.match(guide, /Floor, Checks, Menu, Pay/);
});
