import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_ROOM,
  ROOM_FIT_MARGIN_PX,
  fitRoomToView,
  fixtureEdgeBox,
  fixturePixelBox,
  formatFeetInches,
  nearestObjectGap,
  nearestRoomEdge,
  normalizeBarFill,
  parseFeetInches,
  rescaleFixture,
  sizePatch,
} from "../src/lib/pos/floor-dimensions.ts";
import { floorPlanFromPos, parseFloorPlan } from "../src/lib/saas/location-catalog.ts";

test("a 4 foot table draws larger than a 3 foot table on a 40 by 30 room", () => {
  const room = { widthIn: 40 * 12, depthIn: 30 * 12 };
  assert.deepEqual(room, DEFAULT_ROOM);
  const four = sizePatch(48, 48, room, { round: true });
  const three = sizePatch(36, 36, room, { round: true });
  assert.ok(four && three);
  assert.ok(four.w > three.w);
  assert.ok(four.h > three.h);
  assert.equal(parseFeetInches(0, 0), null);
  assert.equal(parseFeetInches(4, 0), 48);
  assert.equal(formatFeetInches(48), `4' 0"`);

  const fit = fitRoomToView({ room, viewW: 800, viewH: 600 });
  const big = fixturePixelBox({ x: 0, y: 0, w: four.w, h: four.h }, room, fit.pxPerIn);
  const small = fixturePixelBox({ x: 0, y: 0, w: three.w, h: three.h }, room, fit.pxPerIn);
  assert.ok(big.width > small.width);
  assert.ok(Math.abs(big.width / small.width - 4 / 3) < 0.02);
  assert.ok(Math.abs(big.width - big.height) < 1);

  const grown = { widthIn: 80 * 12, depthIn: 60 * 12 };
  const kept = rescaleFixture(
    { x: 10, y: 10, w: four.w, h: four.h, lengthIn: 48, widthIn: 48 },
    room,
    grown,
  );
  assert.equal(kept.lengthIn, 48);
  assert.ok(kept.w < four.w);
  assert.ok(Math.abs(kept.w - four.w / 2) < 0.2);

  const plan = floorPlanFromPos(
    [
      {
        id: "t4",
        label: "4",
        section: "Dining",
        seats: 4,
        x: 10,
        y: 10,
        w: four.w,
        h: four.h,
        shape: "round",
        kind: "table",
        lengthIn: 48,
        widthIn: 48,
        status: "empty",
      },
    ],
    [],
    room,
  );
  const parsed = parseFloorPlan(plan);
  assert.equal(parsed?.room?.widthIn, 480);
  assert.equal(parsed?.tables[0]?.lengthIn, 48);
  assert.ok((parsed?.tables[0]?.w ?? 0) > (sizePatch(36, 36, room, { round: true })?.w ?? 100));

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-room/);
  assert.match(editor, /data-floor-dim/);
  assert.match(editor, /data-floor-object-size/);
  const live = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(live, /fitRoomToView/);
  assert.match(live, /marginPx: ROOM_FIT_MARGIN_PX/);
  assert.doesNotMatch(live, /data-floor-dim/);

  const fitted = fitRoomToView({
    room: { widthIn: 40 * 12, depthIn: 30 * 12 },
    viewW: 1000,
    viewH: 800,
    marginPx: ROOM_FIT_MARGIN_PX,
  });
  assert.ok(fitted.worldW <= 1000 - ROOM_FIT_MARGIN_PX * 2 + 0.5);
  assert.ok(fitted.worldH <= 800 - ROOM_FIT_MARGIN_PX * 2 + 0.5);
  assert.ok(fitted.worldW > 900);
  assert.match(editor, /data-floor-fit-room/);
  assert.match(editor, /data-floor-fit="room"/);
});

test("bar fill white migrates and a dragged table measures to the wall", () => {
  assert.equal(normalizeBarFill("bar_top", "#fff"), "transparent");
  assert.equal(normalizeBarFill("bar_top", "#FFFFFF"), "transparent");
  assert.equal(normalizeBarFill("table", "#fff"), "#fff");

  const room = { widthIn: 40 * 12, depthIn: 30 * 12 };
  const wall = { id: "w", kind: "wall", x: 0, y: 0, w: 1, h: 100, rotation: 0 };
  const wallBox = fixtureEdgeBox(wall, room);
  const table = {
    id: "t",
    kind: "table",
    x: ((wallBox.right + 30) / room.widthIn) * 100,
    y: 20,
    w: 10,
    h: 13.333,
    rotation: 0,
  };
  const gap = nearestObjectGap(table, [wall, table], room);
  assert.ok(gap);
  assert.equal(gap.label, "wall");
  assert.ok(Math.abs(gap.inches - 30) < 0.6);
  assert.equal(formatFeetInches(gap.inches), `2' 6"`);
  const edge = nearestRoomEdge(fixtureEdgeBox(table, room), room);
  assert.ok(edge.inches >= 0);

  const mark = readFileSync("src/components/pos/FloorArchitectureMark.tsx", "utf8");
  assert.match(mark, /stroke="#111"/);
  assert.match(mark, /fill="transparent"/);
  assert.match(mark, /vectorEffect="non-scaling-stroke"/);
  assert.match(mark, /data-floor-bar-stroke/);
  assert.match(mark, /data-floor-bar="slab"/);
  assert.doesNotMatch(mark, />BAR</);
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-measure/);
  const live = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.doesNotMatch(live, /data-floor-measure/);
});
