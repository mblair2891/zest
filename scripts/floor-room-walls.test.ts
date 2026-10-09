import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_ROOM } from "../src/lib/pos/floor-dimensions.ts";
import { floorPlanFromPos, parseFloorPlan, tablesFromFloorPlan } from "../src/lib/saas/location-catalog.ts";
import {
  CANVAS_MARGIN_IN,
  applyRoomWalls,
  clampPieceToRoom,
  moveOpening,
  openingOnWall,
  outlineWalls,
  resizeOpening,
  slideOpening,
  snipWall,
  wallGaps,
  type OutlineWall,
} from "../src/lib/pos/floor-room.ts";

const room = DEFAULT_ROOM;

function wallPiece(wall: OutlineWall, id: string) {
  return {
    id,
    kind: "wall" as const,
    label: "Wall",
    section: "Dining",
    seats: 0,
    status: "empty" as const,
    shape: "rect" as const,
    planRole: wall.planRole,
    x: wall.x,
    y: wall.y,
    w: wall.w,
    h: wall.h,
    rotation: wall.rotation,
    lengthIn: wall.lengthIn,
    widthIn: wall.widthIn,
  };
}

test("40 by 30 walls sit inside the canvas and a table can touch one", () => {
  assert.equal(room.widthIn, 40 * 12);
  assert.equal(room.depthIn, 30 * 12);
  const canvas = {
    widthIn: room.widthIn + CANVAS_MARGIN_IN * 2,
    depthIn: room.depthIn + CANVAS_MARGIN_IN * 2,
  };
  assert.ok(CANVAS_MARGIN_IN > 0);
  assert.ok(canvas.widthIn > room.widthIn);
  assert.ok(canvas.depthIn > room.depthIn);

  const walls = outlineWalls(room);
  assert.equal(walls.length, 4);
  for (const wall of walls) {
    assert.ok(wall.visual.left > -CANVAS_MARGIN_IN);
    assert.ok(wall.visual.top > -0.4);
    assert.ok(wall.visual.right < 100.4);
    assert.ok(wall.visual.bottom < 100.4);
    assert.ok(wall.visual.left >= -0.4);
  }
  const left = walls.find((wall) => wall.edge === "left");
  const top = walls.find((wall) => wall.edge === "top");
  assert.ok(left && top);
  assert.ok(Math.abs(left.visual.left) < 0.4);
  assert.ok(left.visual.right < 4);
  assert.ok(Math.abs(left.visual.top) < 0.6);
  assert.ok(Math.abs(left.visual.bottom - 100) < 0.6);
  assert.ok(left.x < 0);
  assert.ok(Math.abs(top.visual.left) < 0.4);
  assert.ok(Math.abs(top.visual.right - 100) < 0.4);
  assert.ok(top.visual.top < 0.4);

  const table = {
    id: "t1",
    kind: "table" as const,
    label: "1",
    section: "Dining",
    seats: 4,
    status: "empty" as const,
    shape: "rect" as const,
    x: left.visual.right,
    y: 40,
    w: 8,
    h: 10,
  };
  assert.ok(Math.abs(table.x - left.visual.right) < 0.05);
  const onEdge = clampPieceToRoom(0, 40, table.w, table.h);
  assert.equal(onEdge.x, 0);
  const far = clampPieceToRoom(99, 40, table.w, table.h);
  assert.equal(far.x, 100 - table.w);

  const first = applyRoomWalls([table], room, (wall) => wallPiece(wall, `w-${wall.edge}`));
  const kept = first.find((row) => row.id === "t1");
  assert.ok(kept);
  assert.equal(kept.x, table.x);
  assert.equal(kept.y, table.y);
  assert.equal(first.filter((row) => row.kind === "wall").length, 4);

  const again = applyRoomWalls(first, room, (wall) => wallPiece(wall, `n-${wall.edge}`));
  const still = again.find((row) => row.id === "t1");
  assert.equal(still?.x, table.x);
  assert.equal(again.filter((row) => row.id.startsWith("w-")).length, 0);
  assert.equal(again.filter((row) => row.kind === "wall").length, 4);
});

test("a door cuts a wall, snip keeps the table, and publish restores the outline", () => {
  const walls = outlineWalls(room);
  const top = walls.find((wall) => wall.edge === "top");
  const left = walls.find((wall) => wall.edge === "left");
  assert.ok(top && left);
  const topWall = wallPiece(top, "top");
  const table = {
    id: "t1",
    kind: "table" as const,
    label: "1",
    section: "Dining",
    seats: 4,
    status: "empty" as const,
    shape: "rect" as const,
    x: left.visual.right,
    y: 42,
    w: 8,
    h: 10,
  };
  const opening = openingOnWall(topWall, room, { t: 0.5, lengthIn: 36 });
  assert.ok(opening);
  assert.equal(opening.openingOf, "top");
  assert.equal(opening.lengthIn, 36);
  const door = {
    id: "door",
    kind: "door" as const,
    label: "Door",
    section: "Dining",
    seats: 0,
    status: "empty" as const,
    shape: "rect" as const,
    ...opening,
  };
  const gaps = wallGaps(topWall, [door], room);
  assert.equal(gaps.length, 1);
  const gap = gaps[0];
  assert.ok(gap);
  assert.ok(gap.start > 0.5);
  assert.ok(gap.end < topWall.w - 0.5);
  const expected = (36 / room.widthIn) * 100;
  assert.ok(Math.abs(gap.end - gap.start - expected) < 0.2);

  const slid = slideOpening(door, topWall, room, { x: 20, y: 0 });
  assert.ok(slid);
  const movedGaps = wallGaps(topWall, [{ ...door, ...slid }], room);
  const moved = movedGaps[0];
  assert.ok(moved);
  assert.ok(moved.start < gap.start);
  assert.ok(Math.abs(moved.end - moved.start - (gap.end - gap.start)) < 0.2);

  const resized = resizeOpening(door, topWall, room, 48);
  assert.ok(resized);
  assert.equal(resized.lengthIn, 48);
  const wider = wallGaps(topWall, [{ ...door, ...resized }], room)[0];
  assert.ok(wider);
  assert.ok(wider.end - wider.start > gap.end - gap.start + 0.5);

  let n = 0;
  const snipped = snipWall([topWall, table, door], "top", { x: 50, y: 0 }, room, () => `snip-${n++}`);
  assert.ok(snipped);
  const segments = snipped.filter((row) => row.kind === "wall");
  assert.equal(segments.length, 2);
  assert.ok(segments.every((row) => row.planRole === "snip"));
  const stayed = snipped.find((row) => row.id === "t1");
  assert.equal(stayed?.x, table.x);
  assert.equal(stayed?.y, table.y);
  const dropped = snipped.filter((row) => row.id !== segments[0]?.id);
  assert.equal(dropped.filter((row) => row.kind === "wall").length, 1);
  assert.ok(dropped.find((row) => row.id === "t1"));
  const dragged = snipped.map((row) => (row.id === segments[1]?.id ? { ...row, y: row.y + 15 } : row));
  assert.equal(dragged.find((row) => row.id === "t1")?.x, table.x);
  assert.ok((dragged.find((row) => row.id === segments[1]?.id)?.y ?? 0) > (segments[1]?.y ?? 0));

  const plan = floorPlanFromPos(snipped, [], room);
  const parsed = parseFloorPlan(plan);
  assert.ok(parsed);
  const back = tablesFromFloorPlan(parsed);
  const backTable = back.find((row) => row.id === "t1");
  assert.equal(backTable?.x, table.x);
  assert.equal(backTable?.kind, "table");
  const backWalls = back.filter((row) => row.kind === "wall");
  assert.equal(backWalls.length, 2);
  assert.ok(backWalls.every((row) => row.planRole === "snip"));
  const backDoor = back.find((row) => row.id === "door");
  assert.equal(backDoor?.kind, "door");
  assert.equal(backDoor?.planRole, "opening");
  assert.ok(backDoor?.openingOf);
  assert.equal(backDoor?.lengthIn, 36);

  const leftWall = wallPiece(left, "left");
  const round = tablesFromFloorPlan(parseFloorPlan(floorPlanFromPos([leftWall, table], [], room))!);
  const backLeft = round.find((row) => row.id === "left");
  assert.ok(backLeft);
  assert.ok(backLeft.x < 0);
  assert.equal(backLeft.rotation, 90);
  assert.ok(Math.abs(backLeft.w - left.w) < 0.2);
  assert.equal(round.find((row) => row.id === "t1")?.x, table.x);
});

test("a window leaves its wall and stays on the wall it is dragged to", () => {
  const walls = outlineWalls(room);
  const right = walls.find((wall) => wall.edge === "right");
  const top = walls.find((wall) => wall.edge === "top");
  assert.ok(right && top);
  const rightWall = wallPiece(right, "wall-r");
  const topWall = wallPiece(top, "wall-t");
  const placed = openingOnWall(rightWall, room, { t: 0.45, lengthIn: 48 });
  assert.ok(placed);
  const window = {
    id: "win",
    kind: "window" as const,
    label: "Window",
    section: "Dining",
    seats: 0,
    status: "empty" as const,
    shape: "rect" as const,
    ...placed,
  };
  assert.equal(window.openingOf, "wall-r");
  assert.equal(window.lengthIn, 48);

  const along = moveOpening(window, [rightWall, topWall], room, { x: 100, y: 70 });
  assert.equal(along.openingOf, "wall-r");
  assert.equal(along.lengthIn, 48);

  const moved = moveOpening(window, [rightWall, topWall], room, { x: 28, y: 0 });
  assert.equal(moved.openingOf, "wall-t");
  assert.equal(moved.lengthIn, 48);
  assert.equal(moved.rotation, 0);
  assert.notEqual(moved.x, window.x);
  const topGaps = wallGaps(topWall, [{ ...window, ...moved }], room);
  assert.equal(topGaps.length, 1);
  const rightGaps = wallGaps(rightWall, [{ ...window, ...moved }], room);
  assert.equal(rightGaps.length, 0);

  const loose = moveOpening(window, [rightWall, topWall], room, { x: 50, y: 50 });
  assert.equal(loose.openingOf, undefined);
  assert.equal(loose.lengthIn, 48);

  const carried = { ...window, ...moved };
  const parsed = parseFloorPlan(floorPlanFromPos([rightWall, topWall, carried], [], room));
  assert.ok(parsed);
  const back = tablesFromFloorPlan(parsed).find((row) => row.id === "win");
  assert.ok(back);
  assert.equal(back.x, carried.x);
  assert.equal(back.y, carried.y);
  assert.equal(back.w, carried.w);
  assert.equal(back.h, carried.h);
  assert.equal(back.rotation, 0);
  assert.equal(back.lengthIn, 48);
  assert.equal(back.openingOf, "wall-t");

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /moveOpening\(target, walls, floorRoom/);
  assert.doesNotMatch(editor, /slideOpening\(target, wall/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /not locked to that segment/);
  assert.match(guide, /Drag it onto another wall and it follows/);
  assert.match(guide, /Length still sets the opening/);
  assert.match(guide, /Publish does not move it/);
  assert.match(guide, /A round stays round/);
});

test("fit room frames the walls and the editor keeps publish off the location contact button", () => {
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-room-apply/);
  assert.match(editor, /data-floor-room-width/);
  assert.match(editor, /data-floor-room-depth/);
  assert.match(editor, /data-floor-snip/);
  assert.match(editor, /CANVAS_MARGIN_IN/);
  assert.match(editor, /fit\.originX - marginPx/);
  assert.match(editor, /clampPieceToRoom/);
  assert.match(editor, /data-floor-fit="room"/);
  assert.doesNotMatch(editor, /publishLocationFn/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /Apply draws four walls/);
  assert.match(guide, /Select a wall and Snip/);
  assert.match(guide, /Fit room frames the walls/);
  assert.match(guide, /40 by 30/);
});
