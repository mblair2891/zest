import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DEFAULT_FLOOR_COLORS, contrastInk } from "../src/lib/pos/floor-status.ts";
import { DEFAULT_ROOM, fitRoomForTap, fitRoomToView, fixturePixelBox } from "../src/lib/pos/floor-dimensions.ts";
import { joinedNumberLine } from "../src/lib/pos/floor-fit.ts";

const table36 = {
  x: 10,
  y: 10,
  w: (36 / DEFAULT_ROOM.widthIn) * 100,
  h: (36 / DEFAULT_ROOM.depthIn) * 100,
};

test("status colors stay light enough for a dark number", () => {
  assert.deepEqual(DEFAULT_FLOOR_COLORS, {
    empty: "#ffffff",
    sat_no_order: "#93c5fd",
    ordered_drinks: "#fcd34d",
    ordered_food: "#6ee7b7",
    food_delivered: "#5eead4",
    food_completed: "#c4b5fd",
    closed_not_cleaned: "#fda4af",
  });
  for (const hex of Object.values(DEFAULT_FLOOR_COLORS)) {
    assert.equal(contrastInk(hex), "#0a0a0a");
  }
});

test("a small viewport grows the seat and stays inside the cap", () => {
  const phone = { viewW: 390, viewH: 700, marginPx: 16, minTapPx: 84, growCap: 2.25 };
  const fitted = fitRoomToView({ room: DEFAULT_ROOM, viewW: phone.viewW, viewH: phone.viewH, marginPx: 16 });
  const grown = fitRoomForTap({ room: DEFAULT_ROOM, fixtures: [table36], ...phone });
  const fittedPx = fixturePixelBox(table36, DEFAULT_ROOM, fitted.pxPerIn).width;
  const grownPx = fixturePixelBox(table36, DEFAULT_ROOM, grown.pxPerIn).width;
  assert.ok(grownPx > fittedPx + 8, `grown ${grownPx} fitted ${fittedPx}`);
  assert.ok(grown.pxPerIn <= fitted.pxPerIn * 2.25 + 0.001);
  const wide = fitRoomForTap({
    room: DEFAULT_ROOM,
    fixtures: [table36],
    viewW: 1280,
    viewH: 800,
    marginPx: 16,
    minTapPx: 84,
    growCap: 2.25,
  });
  assert.ok(fixturePixelBox(table36, DEFAULT_ROOM, wide.pxPerIn).width >= 84);
});

test("a combined party keeps the extra numbers on one short line", () => {
  assert.equal(joinedNumberLine(undefined), "");
  assert.equal(joinedNumberLine(["3", "4"]), "3 · 4");
  assert.equal(joinedNumberLine(["3", "4", "5", "6", "7"]), "3 · 4 · 5 · 6 +1");
});

test("the order tablet opens with the whole room inside the pane", () => {
  const tablet = fitRoomToView({
    room: DEFAULT_ROOM,
    viewW: 1180,
    viewH: 640,
    marginPx: 16,
  });
  assert.ok(tablet.worldW <= 1180 - 32 + 0.5);
  assert.ok(tablet.worldH <= 640 - 32 + 0.5);
  assert.ok(tablet.originX >= 16 - 0.5);
  assert.ok(tablet.originY >= 16 - 0.5);
  const spanW = (36 / DEFAULT_ROOM.widthIn) * 100;
  const spanH = (36 / DEFAULT_ROOM.depthIn) * 100;
  const corners = [
    { x: 0, y: 0, w: spanW, h: spanH },
    { x: 100 - spanW, y: 100 - spanH, w: spanW, h: spanH },
  ];
  for (const table of corners) {
    const box = fixturePixelBox(table, DEFAULT_ROOM, tablet.pxPerIn);
    assert.ok(box.left >= -0.5);
    assert.ok(box.top >= -0.5);
    assert.ok(box.left + box.width <= tablet.worldW + 0.5);
    assert.ok(box.top + box.height <= tablet.worldH + 0.5);
    assert.ok(box.width >= 48, `tablet table ${box.width}`);
  }
  const phone = fitRoomToView({
    room: DEFAULT_ROOM,
    viewW: 390,
    viewH: 700,
    marginPx: 16,
  });
  assert.ok(phone.worldW <= 390 - 32 + 0.5);
  assert.ok(phone.worldH <= 700 - 32 + 0.5);
  const phoneBox = fixturePixelBox(corners[0]!, DEFAULT_ROOM, phone.pxPerIn);
  assert.ok(phoneBox.left + phoneBox.width <= phone.worldW + 0.5);
});

test("the live map keeps the room color and drops the square ring", () => {
  const canvas = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(canvas, /fitRoomToView/);
  assert.doesNotMatch(canvas, /fitRoomForTap/);
  assert.match(canvas, /visualViewport/);
  assert.match(canvas, /Math\.min\(4, Math\.max\(0\.5/);
  assert.match(canvas, /data-floor-fit=\{focusSection \? "section" : "room"\}/);
  assert.match(canvas, /data-floor-canvas="room"/);
  assert.match(canvas, /bg-\[#e4dfd4\]/);
  assert.doesNotMatch(canvas, /ring-4/);
  assert.doesNotMatch(canvas, /CHECK OPEN/);
  assert.doesNotMatch(canvas, /SLA/);
  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  assert.match(art, /strokeWidth=\{2\.5\}/);
  assert.match(art, /56cqmin/);
  const view = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(view, /data-floor-chrome="top"/);
  assert.match(view, /data-floor-chrome="bottom"/);
  assert.match(view, /CHECK OPEN/);
  assert.match(view, /joined=\{cluster\.joined\}/);
  assert.doesNotMatch(view, /Dining room/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /Tables are larger, with space between them/);
  assert.match(guide, /The whole published floor fits the screen/);
  assert.match(guide, /A combined party is one shape with the other numbers under the main number/);
  assert.match(guide, /no chairs/);
  assert.match(guide, /same path, the same weight, and the same color/);
  assert.match(guide, /light pane, not a wall stroke/);
  assert.match(guide, /gap with a swing mark/);
  assert.match(guide, /A refresh keeps those positions/);
  assert.match(guide, /Floor, Checks, Menu, Pay/);
});
