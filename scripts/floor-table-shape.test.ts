import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diningTableOutline, seatingScale } from "../src/lib/pos/floor-seating.ts";
import { DEFAULT_ROOM, fixturePixelBox, sizePatch } from "../src/lib/pos/floor-dimensions.ts";
import { floorPlanFromPos, parseFloorPlan, tablesFromFloorPlan } from "../src/lib/saas/location-catalog.ts";

test("a 4-top and a 6-top share one shape and have no seat dots", () => {
  assert.deepEqual(diningTableOutline(true, 4), diningTableOutline(true, 6));
  assert.deepEqual(diningTableOutline(false, 4), diningTableOutline(false, 6));
  assert.deepEqual(diningTableOutline(true, 4), {
    round: true,
    cx: 50,
    cy: 50,
    rx: 46,
    ry: 46,
  });
  const square = diningTableOutline(false, 6);
  assert.equal(square.round, false);
  if (!square.round) {
    assert.equal(square.width, 90);
    assert.equal(square.height, 90);
  }
  assert.equal("nubs" in diningTableOutline(true, 6), false);

  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  const booth = readFileSync("src/components/pos/FloorBoothMark.tsx", "utf8");
  assert.match(art, /diningTableOutline\(round, seats\)/);
  assert.match(art, /diningTableOutline\(round\)/);
  assert.match(art, /data-floor-nubs="0"/);
  assert.doesNotMatch(art, /data-floor-nub="1"/);
  assert.doesNotMatch(art, /nubPoints/);
  assert.match(art, /FloorBoothGlyph/);
  assert.match(booth, /seatingScale\(\{ w, h, seats: 4 \}\)/);
  assert.doesNotMatch(booth, /data-floor-nub/);
  assert.match(booth, /Booth4Paths/);
  assert.match(booth, /BoothUPaths/);
  assert.match(booth, /BoothLPaths/);

  const fourBench = seatingScale({ w: 18, h: 18, seats: 4 });
  const sixBench = seatingScale({ w: 18, h: 18, seats: 6 });
  assert.equal(fourBench.benchVx, sixBench.benchVx);
  assert.equal(fourBench.benchVy, sixBench.benchVy);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /Seats/);
  assert.match(editor, /value=\{selectedTable\.seats\}/);
  assert.match(editor, /seats: booth \? clampBoothSeats\(booth, raw\) : Math\.max\(1, raw\)/);
  const live = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(live, /\{detailLive\.seats\} top/);
  assert.match(live, /data-floor-nubs="0"/);
  assert.match(live, /mode="status"/);
  const map = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(map, /data-floor-nubs="0"/);
  assert.match(map, /mode="status"/);
  assert.match(art, /data-floor-stool="tile"/);

  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /no seat dots/i);
  assert.match(guide, /side panel/);
  assert.match(guide, /Barstools stay their own pieces/);
});

test("a 4 ft by 2 ft table is a rectangle and publish keeps that size", () => {
  const room = DEFAULT_ROOM;
  const patch = sizePatch(4 * 12, 2 * 12, room);
  assert.ok(patch);
  assert.equal(patch.lengthIn, 48);
  assert.equal(patch.widthIn, 24);
  const px = fixturePixelBox({ x: 10, y: 12, w: patch.w, h: patch.h }, room, 2);
  assert.ok(Math.abs(px.width / px.height - 2) < 0.02, `drawn ratio ${px.width / px.height}`);
  assert.ok(px.width > px.height);

  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  assert.match(art, /preserveAspectRatio=\{mark\.round \? "xMidYMid meet" : "none"\}/);
  assert.match(art, /preserveAspectRatio=\{tableRect \? "none" : "xMidYMid meet"\}/);
  assert.match(art, /data-floor-table-box=\{mark\.round \? "round" : "rect"\}/);
  assert.match(art, /data-floor-table-box=\{tableRect \? "rect" : round && !bar \? "round" : undefined\}/);
  assert.match(art, /text-\[11px\] font-semibold/);
  assert.match(art, /fontSize: joined\?\.length \? "42cqmin" : "50cqmin"/);
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /diningRect \? "Width" : "Length"/);
  assert.match(editor, /diningRect \? "Depth" : "Width"/);

  const table = {
    id: "t4x2",
    label: "1",
    section: "Dining",
    seats: 4,
    status: "empty" as const,
    shape: "rect" as const,
    kind: "table" as const,
    x: 10,
    y: 12,
    w: patch.w,
    h: patch.h,
    lengthIn: 48,
    widthIn: 24,
    rotation: 0,
  };
  const parsed = parseFloorPlan(floorPlanFromPos([table], [], room));
  assert.ok(parsed);
  const back = tablesFromFloorPlan(parsed).find((row) => row.id === "t4x2");
  assert.ok(back);
  assert.equal(back.w, table.w);
  assert.equal(back.h, table.h);
  assert.equal(back.lengthIn, 48);
  assert.equal(back.widthIn, 24);
  assert.notEqual(back.w, back.h);

  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /4 ft by 2 ft table draws as a rectangle/);
  assert.match(guide, /The number stays centered and the same size/);
  assert.match(guide, /Publish does not change the size/);
});
