import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  defaultBarPlan,
  dragLegEnd,
  hitsBar,
  legHandles,
  legLengthsOf,
} from "../src/lib/pos/floor-architecture.ts";
import { floorPlanFromPos, parseFloorPlan } from "../src/lib/saas/location-catalog.ts";

test("L bar wing drag keeps the other leg, and the empty box misses", () => {
  const points = defaultBarPlan("l", 20, 30, 36, 28);
  assert.equal(points.length, 3);
  const before = legLengthsOf(points);
  const corner = points[1]!;
  const far = points[2]!;
  const handles = legHandles(points, "l");
  assert.equal(handles.length, 2);
  const wing = handles[0]!;
  const anchor = points[wing.anchor]!;
  const end = points[wing.index]!;
  const span = Math.hypot(end.x - anchor.x, end.y - anchor.y);
  const ux = (end.x - anchor.x) / span;
  const uy = (end.y - anchor.y) / span;
  const next = dragLegEnd(points, wing, {
    x: anchor.x + ux * (span + 18),
    y: anchor.y + uy * (span + 18),
  });
  const after = legLengthsOf(next);
  assert.equal(next[1]!.x, corner.x);
  assert.equal(next[1]!.y, corner.y);
  assert.equal(next[2]!.x, far.x);
  assert.equal(next[2]!.y, far.y);
  assert.ok(after[0]! > before[0]! + 8);
  assert.equal(after[1], before[1]);

  const straight = legHandles(defaultBarPlan("straight", 10, 40, 50, 8), "straight");
  assert.equal(straight.length, 2);

  assert.equal(hitsBar(points[0]!.x + 2, points[2]!.y, points), false);
  assert.equal(hitsBar((points[0]!.x + points[1]!.x) / 2, points[0]!.y, points), true);

  const plan = floorPlanFromPos(
    [
      {
        id: "bar1",
        label: "Bar",
        section: "Bar",
        seats: 0,
        x: 20,
        y: 30,
        w: 36,
        h: 28,
        shape: "rect",
        kind: "bar_top",
        barShape: "l",
        points: next,
        legLengths: after,
        status: "empty",
      },
    ],
    [],
  );
  const parsed = parseFloorPlan(plan);
  assert.deepEqual(parsed?.tables[0]?.legLengths, after);
  assert.equal(parsed?.tables[0]?.points?.[1]?.x, corner.x);
  assert.equal(parsed?.tables[0]?.points?.[2]?.x, far.x);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-bar-hit="path"/);
  assert.match(editor, /data-bar-leg=/);
  assert.match(editor, /startLeg\(/);
  assert.match(editor, /pointer-events-none absolute overflow-visible/);
  const mark = readFileSync("src/components/pos/FloorArchitectureMark.tsx", "utf8");
  assert.match(mark, /pointerEvents: "fill"/);
  const live = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(live, /data-floor-bar-hit/);
  assert.match(live, /item\.table\.kind === "bar_top" && "pointer-events-none"/);
  const catalog = readFileSync("src/lib/saas/location-catalog.ts", "utf8");
  assert.match(catalog, /legLengths/);
});
