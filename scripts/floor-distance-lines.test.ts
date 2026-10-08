import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clearanceLabel,
  dragDistanceLines,
  fixtureEdgeBox,
} from "../src/lib/pos/floor-dimensions.ts";
import { snapFlushToArchitecture } from "../src/lib/pos/floor-arrange.ts";
import { openingOnWall, outlineWalls } from "../src/lib/pos/floor-room.ts";
import { floorPlanFromPos, parseFloorPlan, tablesFromFloorPlan } from "../src/lib/saas/location-catalog.ts";

const room = { widthIn: 40 * 12, depthIn: 30 * 12 };

function piece(
  id: string,
  kind: string,
  box: { left: number; top: number; right: number; bottom: number },
  rotation = 0,
) {
  return {
    id,
    kind,
    x: (box.left / room.widthIn) * 100,
    y: (box.top / room.depthIn) * 100,
    w: ((box.right - box.left) / room.widthIn) * 100,
    h: ((box.bottom - box.top) / room.depthIn) * 100,
    rotation,
  };
}

test("dragging a couch shows the window and the bar, and a flush edge reads 0", () => {
  const right = outlineWalls(room).find((wall) => wall.edge === "right");
  const left = outlineWalls(room).find((wall) => wall.edge === "left");
  assert.ok(right && left);
  const window = openingOnWall({ ...right, id: "wall-r" }, room, { t: 0.45, lengthIn: 48 });
  assert.ok(window);
  const winBox = fixtureEdgeBox(window, room);
  const couchH = 32;
  const couchW = 84;
  const couchTop = (winBox.top + winBox.bottom) / 2 - couchH / 2;
  const bar = piece("bar", "bar_top", { left: 80, top: couchTop - 10, right: 200, bottom: couchTop + couchH + 10 });
  const couch = piece("c1", "couch", {
    left: 224,
    top: couchTop,
    right: 224 + couchW,
    bottom: couchTop + couchH,
  });
  const others = [
    { ...left, id: "wall-l", kind: "wall" },
    { ...right, id: "wall-r", kind: "wall" },
    { ...window, id: "win", kind: "window" },
    bar,
    couch,
  ];
  const moving = dragDistanceLines(couch, others, room);
  const toWindow = moving.find((line) => line.target === "window");
  const toBar = moving.find((line) => line.target === "bar");
  assert.ok(toWindow);
  assert.ok(toBar);
  assert.equal(toWindow.side, "right");
  assert.equal(toBar.label, `2' 0"`);
  assert.equal(toWindow.label, clearanceLabel(winBox.left - (224 + couchW)));
  assert.notEqual(toWindow.label, "0");
  const layoutRight = ((window.x + window.w) / 100) * room.widthIn;
  assert.ok(Math.abs(layoutRight - (224 + couchW) - toWindow.inches) > 12);
  assert.ok(toWindow.x2 > toWindow.x1);

  const near = piece("c1", "couch", {
    left: winBox.left - 4 - couchW,
    top: couchTop,
    right: winBox.left - 4,
    bottom: couchTop + couchH,
  });
  const snapped = snapFlushToArchitecture(near, [{ ...window, kind: "window" }], room);
  assert.ok(snapped);
  const flush = { ...near, ...snapped };
  const dropped = dragDistanceLines(flush, others.map((row) => (row.id === "c1" ? flush : row)), room);
  const flushWindow = dropped.find((line) => line.target === "window");
  const flushBar = dropped.find((line) => line.target === "bar");
  assert.ok(flushWindow);
  assert.ok(flushBar);
  assert.equal(flushWindow.label, "0");
  assert.equal(flushWindow.inches, 0);
  assert.ok(Math.abs(flushWindow.x1 - flushWindow.x2) < 0.02);
  assert.match(flushBar.label, /'/);

  const sections = [{ id: "dining", name: "Dining", color: "sec-1", sort: 0 }];
  const stored = [
    {
      ...flush,
      label: "",
      section: "Dining",
      sectionId: "dining",
      seats: 3,
      shape: "rect" as const,
      status: "empty" as const,
      lengthIn: couchW,
      widthIn: couchH,
    },
    {
      ...window,
      id: "win",
      kind: "window" as const,
      label: "Window",
      section: "Dining",
      sectionId: "dining",
      seats: 0,
      shape: "rect" as const,
      status: "empty" as const,
      planRole: "opening" as const,
      openingOf: "wall-r",
    },
    {
      ...bar,
      label: "BAR",
      section: "Dining",
      sectionId: "dining",
      seats: 0,
      shape: "rect" as const,
      status: "empty" as const,
    },
  ];
  const parsed = parseFloorPlan(floorPlanFromPos(stored, sections, room));
  assert.ok(parsed);
  const back = tablesFromFloorPlan(parsed);
  const couchBack = back.find((row) => row.id === "c1");
  assert.ok(couchBack);
  assert.equal(couchBack.x, flush.x);
  assert.equal(couchBack.y, flush.y);
  const again = dragDistanceLines(couchBack, back, room);
  assert.equal(again.find((line) => line.target === "window")?.label, "0");

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-distance-lines=""/);
  assert.match(editor, /setMovingId\(drag\.current\.id\)/);
  const up = editor.slice(editor.indexOf("const onPointerUp"), editor.indexOf("const startLeg"));
  assert.match(up, /setMovingId\(null\)/);
  assert.match(editor, /movingId/);
  const live = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.doesNotMatch(live, /data-floor-distance-lines/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /Each line is labeled in feet and inches/);
  assert.match(guide, /A touching edge reads 0/);
  assert.match(guide, /The lines disappear when the piece is dropped/);
  assert.match(guide, /Publish floor does not move the piece/);
});
