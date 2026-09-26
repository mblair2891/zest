import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ADD_COUNT_TITLE,
  RENUMBER_CONFIRM,
  RENUMBER_LABEL,
  alignSelection,
  canvasCenterOrigin,
  distanceAlong,
  nextFreeNumbers,
  nextFreeStoolLabels,
  outsideRail,
  placeRow,
  renumberPlan,
  resetFloorNumbers,
  rulerMarks,
  snapToGrid,
} from "../src/lib/pos/floor-arrange.ts";
import { generateBarStools, planFromLegInches, slabBounds } from "../src/lib/pos/floor-architecture.ts";

const room = { widthIn: 40 * 12, depthIn: 30 * 12 };

test("six tables take the next free numbers and do not stack", () => {
  assert.deepEqual(nextFreeNumbers(["1", "2", "4"], 2), ["3", "5"]);
  assert.deepEqual(nextFreeStoolLabels(["B1", "B3"], 2), ["B2", "B4"]);
  const labels = nextFreeNumbers([], 6);
  assert.deepEqual(labels, ["1", "2", "3", "4", "5", "6"]);
  const size = { w: (36 / room.widthIn) * 100, h: (36 / room.depthIn) * 100 };
  const spots = placeRow(canvasCenterOrigin(size.w, size.h), size, 6, room);
  assert.equal(spots.length, 6);
  const step = (12 / room.widthIn) * 100;
  for (let i = 1; i < spots.length; i += 1) {
    assert.ok(Math.abs(spots[i]!.x - spots[0]!.x - step * i) < 0.15, `copy ${i} offset`);
    assert.equal(spots[i]!.y, spots[0]!.y);
    assert.notEqual(`${spots[i]!.x}|${spots[i]!.y}`, `${spots[0]!.x}|${spots[0]!.y}`);
  }
});

test("reset numbers orders dining 1-n and stools along the rail", () => {
  const pieces = [
    { id: "right", kind: "table", label: "9", x: 40, y: 10, w: 8, h: 8 },
    { id: "left", kind: "table", label: "2", x: 10, y: 10, w: 8, h: 8 },
    { id: "low", kind: "booth_4", label: "4", x: 5, y: 40, w: 8, h: 8 },
    { id: "bbooth", kind: "booth_u", label: "B8", x: 20, y: 8, w: 8, h: 8 },
    { id: "wall", kind: "wall", label: "Wall", x: 0, y: 0, w: 2, h: 80 },
    { id: "far", kind: "barstool", label: "B9", x: 60, y: 70, w: 4, h: 4, railBarId: "bar" },
    { id: "near", kind: "barstool", label: "B4", x: 15, y: 70, w: 4, h: 4, railBarId: "bar" },
  ];
  const bars = [{ id: "bar", x: 10, y: 68, points: [{ x: 10, y: 72 }, { x: 70, y: 72 }] }];
  const labels = Object.fromEntries(renumberPlan(pieces, bars).map((row) => [row.id, row.label]));
  assert.equal(labels.left, "1");
  assert.equal(labels.right, "2");
  assert.equal(labels.low, "3");
  assert.equal(labels.bbooth, undefined);
  assert.equal(labels.wall, undefined);
  assert.equal(labels.near, "B1");
  assert.equal(labels.far, "B2");
});

function gap(px: number, py: number, points: { x: number; y: number }[]): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)));
  }
  return best;
}

test("an L resets to capsules B1 through B14, and path text leaves the slab", () => {
  const plan = planFromLegInches("l", { x: 20, y: 30 }, [16 * 12, 10 * 12], room);
  const box = slabBounds(plan, 24, room, false);
  const bar = {
    id: "bar",
    kind: "bar_top",
    label: "BAR",
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    points: plan,
    barShape: "l" as const,
    barSide: "outside" as const,
    widthIn: 24,
    section: "Bar",
  };
  const poses = generateBarStools({
    bar: { ...bar, legLengths: [1, 1] },
    room,
    counts: { legA: 8, legB: 6 },
    side: "outside",
  });
  assert.equal(poses.length, 14);
  const stools = poses.map((pose, index) => ({
    id: `s${index}`,
    kind: "barstool",
    label: `X${index}`,
    x: pose.x,
    y: pose.y,
    w: pose.w,
    h: pose.h,
    railBarId: "bar",
  }));
  const dining = [
    { id: "right", kind: "table", label: "9", x: 70, y: 8, w: 6, h: 6 },
    { id: "left", kind: "table", label: "3", x: 8, y: 8, w: 6, h: 6 },
  ];
  const reset = resetFloorNumbers([...dining, ...stools, bar], [bar], room);
  const labels = Object.fromEntries(reset.labels.map((row) => [row.id, row.label]));
  assert.equal(labels.left, "1");
  assert.equal(labels.right, "2");
  assert.equal(reset.create.length, 0);
  assert.equal(labels.bar, undefined);
  const stoolLabels = stools.map((stool) => labels[stool.id]).sort((a, b) => Number(a!.slice(1)) - Number(b!.slice(1)));
  assert.deepEqual(stoolLabels, Array.from({ length: 14 }, (_, i) => `B${i + 1}`));
  const rail = outsideRail(bar, room);
  const alongOf = (id: string) => {
    const stool = stools.find((row) => row.id === id)!;
    return distanceAlong(rail, stool.x + stool.w / 2, stool.y + stool.h / 2);
  };
  const b1 = stools.find((stool) => labels[stool.id] === "B1")!;
  const b14 = stools.find((stool) => labels[stool.id] === "B14")!;
  assert.ok(alongOf(b1.id) < alongOf(b14.id));
  for (const stool of stools) {
    const cx = stool.x + stool.w / 2;
    const cy = stool.y + stool.h / 2;
    assert.ok(gap(cx, cy, rail) < gap(cx, cy, plan), stool.id);
  }

  const painted = { ...bar, label: Array.from({ length: 14 }, (_, i) => `B${i + 1}`).join(" ") };
  const migrated = resetFloorNumbers([painted], [painted], room);
  assert.equal(migrated.labels.find((row) => row.id === "bar")?.label, "BAR");
  assert.equal(migrated.create.length, 14);
  assert.deepEqual(
    migrated.create.map((row) => row.label),
    Array.from({ length: 14 }, (_, i) => `B${i + 1}`),
  );
  for (const made of migrated.create) {
    const cx = made.x + made.w / 2;
    const cy = made.y + made.h / 2;
    assert.ok(gap(cx, cy, outsideRail(painted, room)) < gap(cx, cy, plan));
    assert.equal(made.railBarId, "bar");
  }
});

test("grid snap and align two tables to a wall", () => {
  const step = (12 / room.widthIn) * 100;
  const raw = step * 2 + step * 0.4;
  const snapped = snapToGrid(raw, 3, room, 12);
  assert.equal(snapped.x, Math.round(raw / step) * step);
  assert.ok(Math.abs(snapped.x - raw) > 0);

  const wall = { id: "w", kind: "wall", x: 4, y: 0, w: 2, h: 90, label: "Wall" };
  const a = { id: "a", kind: "table", x: 20, y: 10, w: 10, h: 10, label: "1" };
  const b = { id: "b", kind: "table", x: 40, y: 30, w: 10, h: 10, label: "2" };
  const patches = alignSelection([wall, a, b], ["w", "a", "b"], "left");
  const byId = Object.fromEntries(patches.map((row) => [row.id, row]));
  assert.equal(byId.a!.x, 4);
  assert.equal(byId.b!.x, 4);
  assert.equal(byId.w, undefined);

  const bar = {
    id: "bar",
    x: 10,
    y: 10,
    w: 30,
    h: 10,
    points: [{ x: 10, y: 12 }, { x: 40, y: 12 }],
    legLengths: [30],
  };
  const table = { id: "t", x: 0, y: 10, w: 8, h: 8 };
  const moved = alignSelection([bar, table], ["bar", "t"], "left").find((row) => row.id === "bar");
  assert.equal(moved?.x, 0);
  assert.equal(moved?.points?.[0]?.x, 0);
  assert.equal(moved?.points?.[1]?.x, 30);

  const marks = rulerMarks(room.widthIn);
  assert.equal(marks[0]?.label, `0' 0"`);
  assert.equal(marks[marks.length - 1]?.label, `40' 0"`);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.equal(ADD_COUNT_TITLE, "How many?");
  assert.equal(RENUMBER_LABEL, "Reset table numbers");
  assert.match(editor, /ADD_COUNT_TITLE/);
  assert.match(editor, /data-floor-add-count=""/);
  assert.match(editor, /RENUMBER_LABEL/);
  assert.match(editor, /data-floor-renumber=""/);
  assert.match(editor, /RENUMBER_CONFIRM/);
  assert.equal(
    RENUMBER_CONFIRM,
    "Reset table numbers? Dining tables and booths become 1 through N from the top, left to right. Each bar’s stools become B1 through Bn on their own capsules, along the outside edge.",
  );
  assert.match(editor, /data-floor-grid=""/);
  assert.match(editor, /data-floor-ruler=""/);
  assert.match(editor, /data-floor-snap=""/);
  assert.match(editor, /data-floor-grid-size=""/);
  assert.match(editor, /data-floor-align="left"/);
  assert.match(editor, /data-floor-align="distribute-h"/);
  assert.doesNotMatch(editor, /publishLocationFn/);
});
