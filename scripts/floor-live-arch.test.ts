import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { liveArchCaption } from "../src/lib/pos/floor-architecture.ts";
import { planPixelBox, tablePixelBox } from "../src/lib/pos/floor-fit.ts";

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
  assert.match(mark, /data-floor-arch-tone/);
  const canvas = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(canvas, /planPixelBox/);
  assert.match(canvas, /variant="live"/);
  assert.match(canvas, /floor-wood/);
  assert.match(canvas, /data-floor-chairs="0"/);
  const view = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(view, /floor-wood/);
  assert.match(view, /data-floor-map="wood"/);
  assert.match(view, /FloorArchitectureMark table=\{t\} variant="live"/);
  assert.match(view, /mode="status"/);
  const css = readFileSync("src/styles.css", "utf8");
  assert.match(css, /\.floor-wood/);
});
