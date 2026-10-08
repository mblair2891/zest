import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { doorSwingHeightPct, doorSwingSign, liveArchCaption } from "../src/lib/pos/floor-architecture.ts";
import { DEFAULT_ROOM, fixtureEdgeBox } from "../src/lib/pos/floor-dimensions.ts";
import { planPixelBox, tablePixelBox } from "../src/lib/pos/floor-fit.ts";
import { openingGaps, openingOnWall, outlineWalls } from "../src/lib/pos/floor-room.ts";
import { floorPlanFromPos, parseFloorPlan, tablesFromFloorPlan } from "../src/lib/saas/location-catalog.ts";

test("published wall stays a dark segment on the wood, in its plan box", () => {
  const plan = { x: 12, y: 40, w: 30, h: 2 };
  const drawn = planPixelBox(plan, 10);
  assert.equal(drawn.left, 120);
  assert.equal(drawn.top, 400);
  assert.equal(drawn.width, 300);
  assert.equal(drawn.height, 20);
  const inflated = tablePixelBox(plan, 10, 72);
  assert.ok(inflated.height > drawn.height);
  assert.notEqual(inflated.top, drawn.top);

  assert.equal(liveArchCaption({ kind: "wall", label: "Wall" }), null);
  assert.equal(liveArchCaption({ kind: "door", label: "Door" }), null);
  assert.equal(liveArchCaption({ kind: "window", label: "Patio" }), "Patio");

  const mark = readFileSync("src/components/pos/FloorArchitectureMark.tsx", "utf8");
  assert.match(mark, /variant === "live"/);
  assert.match(mark, /bg-\[#3d2914\]/);
  assert.match(mark, /bg-\[#c9d7e0\]/);
  assert.match(mark, /data-floor-window="pane"/);
  assert.match(mark, /data-floor-wall="outline"/);
  assert.match(mark, /data-floor-door="gap"/);
  assert.match(mark, /data-floor-door-swing=""/);
  assert.match(mark, /data-floor-arch-tone="editor"/);
  assert.match(mark, /preserveAspectRatio="xMinYMin meet"/);
  assert.match(mark, /stroke="#3d2914"/);
  assert.doesNotMatch(mark, /data-floor-arch-stroke="hairline"/);
  assert.doesNotMatch(mark, /data-floor-arch-tone="line"/);
  assert.doesNotMatch(mark, /stroke="#1c1917"/);
  assert.doesNotMatch(mark, /bg-\[#efe6d8\]/);
  assert.doesNotMatch(mark, /live \? "bg-\[#3d2914\]"/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /same path, the same weight, and the same color/);
  assert.match(guide, /light pane, not a wall stroke/);
  assert.match(guide, /gap with a swing mark/);
  assert.match(guide, /A refresh keeps those positions/);
  assert.doesNotMatch(guide, /Walls, doors, and windows are a hairline/);
  assert.doesNotMatch(guide, /on the live floor they are a hairline/);
  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  const status = art.split("function StatusFixture")[1]?.split("function FloorTableArt")[0] ?? "";
  assert.match(status, /strokeWidth=\{hollow \? 1\.25 : 0\}/);
  assert.match(status, /non-scaling-stroke/);
  assert.match(status, /font-medium/);
  assert.match(status, /fontWeight: 500/);
  assert.doesNotMatch(status, /strokeWidth=\{hollow \? 7/);
  assert.doesNotMatch(status, /font-bold/);
  const canvas = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(canvas, /hairline/);
  assert.match(canvas, /fixturePixelBox/);
  assert.match(canvas, /variant="live"/);
  assert.match(canvas, /data-floor-canvas="white"/);
  assert.doesNotMatch(canvas, /floor-wood/);
  assert.match(canvas, /data-floor-nubs="0"/);
  assert.doesNotMatch(art, /data-floor-nub="1"/);
  const view = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(view, /bg-white/);
  assert.match(view, /data-floor-canvas="white"/);
  assert.match(view, /variant="live"/);
  assert.match(view, /mode="status"/);
  assert.match(view, /hollow=\{st === "empty"\}/);
  const css = readFileSync("src/styles.css", "utf8");
  assert.doesNotMatch(css, /\.floor-wood/);
});

test("a window beside the couch is a pane, and a refresh keeps the wall, door, and couch", () => {
  const room = DEFAULT_ROOM;
  const right = outlineWalls(room).find((wall) => wall.edge === "right");
  const top = outlineWalls(room).find((wall) => wall.edge === "top");
  const left = outlineWalls(room).find((wall) => wall.edge === "left");
  const bottom = outlineWalls(room).find((wall) => wall.edge === "bottom");
  assert.ok(right && top && left && bottom);
  const piece = {
    label: "Wall",
    section: "Dining",
    seats: 0,
    status: "empty" as const,
    shape: "rect" as const,
  };
  const rightWall = { ...right, ...piece, id: "wall-r", kind: "wall" as const };
  const topWall = { ...top, ...piece, id: "wall-t", kind: "wall" as const };
  const windowBox = openingOnWall(rightWall, room, { t: 0.45, lengthIn: 48 });
  const doorBox = openingOnWall(topWall, room, { t: 0.3, lengthIn: 36 });
  assert.ok(windowBox && doorBox);
  const window = {
    ...windowBox,
    id: "win",
    kind: "window" as const,
    label: "Patio",
    section: "Dining",
    seats: 0,
    status: "empty" as const,
    shape: "rect" as const,
  };
  const door = {
    ...doorBox,
    id: "door",
    kind: "door" as const,
    label: "Door",
    section: "Dining",
    seats: 0,
    status: "empty" as const,
    shape: "rect" as const,
  };
  const winEdge = fixtureEdgeBox(window, room);
  const couchW = 84;
  const couchH = 32;
  const couch = {
    id: "c1",
    kind: "couch" as const,
    label: "4",
    section: "Dining",
    seats: 3,
    status: "empty" as const,
    shape: "rect" as const,
    x: ((winEdge.left - couchW) / room.widthIn) * 100,
    y: (((winEdge.top + winEdge.bottom) / 2 - couchH / 2) / room.depthIn) * 100,
    w: (couchW / room.widthIn) * 100,
    h: (couchH / room.depthIn) * 100,
    rotation: 0,
  };
  const gaps = openingGaps(rightWall, [rightWall, topWall, window, door, couch], room);
  assert.ok(gaps);
  assert.equal(gaps.length, 1);
  assert.ok(Math.abs((gaps[0]?.end ?? 0) - (gaps[0]?.start ?? 0) - window.w) < 0.05);
  assert.ok(couch.x + couch.w <= window.x + window.w);

  assert.equal(doorSwingSign(0, 50, top.y + top.h / 2), 1);
  assert.equal(doorSwingSign(0, 50, bottom.y + bottom.h / 2), -1);
  assert.equal(doorSwingSign(90, right.x + right.w / 2, 50), 1);
  assert.equal(doorSwingSign(90, left.x + left.w / 2, 50), -1);
  assert.equal(doorSwingSign(270, left.x + left.w / 2, 50), 1);
  assert.equal(doorSwingSign(270, right.x + right.w / 2, 50), -1);
  assert.equal(doorSwingSign(180, 50, top.y + top.h / 2), -1);
  assert.equal(doorSwingSign(180, 50, bottom.y + bottom.h / 2), 1);
  const alongIn = (door.w / 100) * room.widthIn;
  const thickIn = (door.h / 100) * room.depthIn;
  assert.ok(Math.abs(alongIn - 36) < 0.2);
  assert.ok(Math.abs(thickIn - 6) < 0.2);
  assert.ok(Math.abs(doorSwingHeightPct(door, room) - (alongIn / thickIn) * 100) < 0.01);

  const pieces = [rightWall, topWall, window, door, couch];
  const parsed = parseFloorPlan(floorPlanFromPos(pieces, [], room));
  assert.ok(parsed);
  const back = tablesFromFloorPlan(parsed);
  for (const id of ["wall-r", "wall-t", "win", "door", "c1"]) {
    const before = pieces.find((row) => row.id === id);
    const after = back.find((row) => row.id === id);
    assert.ok(before && after);
    assert.equal(after.x, before.x);
    assert.equal(after.y, before.y);
    assert.equal(after.w, before.w);
    assert.equal(after.h, before.h);
    assert.equal(after.rotation ?? 0, before.rotation ?? 0);
    assert.equal(after.kind, before.kind);
  }
  assert.equal(back.find((row) => row.id === "win")?.openingOf, "wall-r");
  assert.equal(back.find((row) => row.id === "door")?.openingOf, "wall-t");
});
