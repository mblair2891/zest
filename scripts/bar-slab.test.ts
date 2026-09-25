import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  barDepthIn,
  barSlabEdges,
  legInches,
  planFromLegInches,
  resizeBarLeg,
} from "../src/lib/pos/floor-architecture.ts";

const room = { widthIn: 40 * 12, depthIn: 30 * 12 };

test("a 22 foot bar is 5.5 times a 4 foot table, and an L is a 24 inch hollow slab", () => {
  assert.equal(barDepthIn(undefined), 24);
  assert.equal(barDepthIn(30), 30);
  assert.equal(barDepthIn(96), 24);

  const straight = planFromLegInches("straight", { x: 5, y: 12 }, [22 * 12], room);
  const span = straight[1]!.x - straight[0]!.x;
  const table4 = ((4 * 12) / room.widthIn) * 100;
  assert.ok(Math.abs(span / table4 - 5.5) < 0.02);
  const band = barSlabEdges(straight, 24, room, false);
  const thick = legInches([band.outer[0]!, band.inner[0]!], room)[0]!;
  assert.ok(Math.abs(thick - 24) < 0.5);
  const along = legInches(straight, room)[0]!;
  assert.ok(Math.abs(along - 22 * 12) < 0.5);

  const el = planFromLegInches("l", { x: 10, y: 10 }, [12 * 12, 8 * 12], room);
  assert.equal(el.length, 3);
  assert.equal(el[1]!.x, el[2]!.x);
  assert.equal(el[0]!.y, el[1]!.y);
  const legs = legInches(el, room);
  assert.ok(Math.abs(legs[0]! - 144) < 0.5);
  assert.ok(Math.abs(legs[1]! - 96) < 0.5);
  const lBand = barSlabEdges(el, 24, room, false);
  const lThick = legInches([lBand.outer[0]!, lBand.inner[0]!], room)[0]!;
  assert.ok(Math.abs(lThick - 24) < 0.6);
  assert.ok(lBand.outer.length >= 3 && lBand.inner.length >= 3);

  const grown = resizeBarLeg(el, "l", 1, 10 * 12, room);
  const after = legInches(grown, room);
  assert.ok(Math.abs(after[0]! - 144) < 0.6);
  assert.ok(Math.abs(after[1]! - 120) < 0.6);
  assert.equal(grown[1]!.x, el[1]!.x);
  assert.equal(grown[1]!.y, el[1]!.y);

  const three = ((3 * 12) / room.widthIn) * 100;
  assert.ok(span / three > 7);

  const mark = readFileSync("src/components/pos/FloorArchitectureMark.tsx", "utf8");
  assert.match(mark, /data-floor-bar="slab"/);
  assert.match(mark, /data-floor-bar-fill="slab"/);
  assert.match(mark, /#b7b2aa/);
  assert.match(mark, /data-floor-bar-label="BAR"/);
  assert.match(mark, /data-floor-bar-depth/);
  assert.doesNotMatch(mark, /strokeWidth=\{4\}/);
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-bar-depth/);
  assert.match(editor, /data-bar-slab/);
  assert.match(editor, /Counter depth/);
  const live = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(live, /room=\{room\}/);
  assert.match(live, /data-floor-bar="slab"/);
});
