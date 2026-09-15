import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clampSeatNum,
  railStoolCenters,
  seatAnchors,
  seatingScale,
} from "../src/lib/pos/floor-seating.ts";

test("seating marks scale with fixture size and seat count", () => {
  const two = seatingScale({ w: 10, h: 10, seats: 2 });
  const eight = seatingScale({ w: 22, h: 14, seats: 8 });
  const ten = seatingScale({ w: 24, h: 16, seats: 10 });
  assert.ok(two.iconCanvasPct > eight.iconCanvasPct * 0.85);
  assert.ok(ten.iconCanvasPct >= 1.35);
  assert.ok(two.iconCanvasPct <= 3.5);
  const small = seatingScale({ w: 8, h: 8, seats: 2 });
  const large = seatingScale({ w: 28, h: 22, seats: 2 });
  assert.ok(large.iconCanvasPct > small.iconCanvasPct);
  assert.equal(clampSeatNum(0, 1.35, 3.5), 1.35);
});

test("booth benches thicken with the body", () => {
  const compact = seatingScale({ w: 16, h: 18, seats: 4 });
  const wideU = seatingScale({ w: 32, h: 28, seats: 8 });
  assert.ok(wideU.benchVx * 32 > compact.benchVx * 16 * 0.9);
  assert.ok(wideU.benchVy * 28 > compact.benchVy * 18 * 0.9);
});

test("rail stools are evenly spaced from rail depth", () => {
  const six = railStoolCenters(6, 12, true);
  assert.equal(six.length, 6);
  const gaps = six.slice(1).map((p, i) => p.x - six[i]!.x);
  for (const g of gaps) assert.ok(Math.abs(g - gaps[0]!) < 0.01);
  assert.equal(railStoolCenters(1, 20, true).length, 1);
  const down = railStoolCenters(4, 14, false);
  assert.ok(down.every((p) => p.x === 50));
});

test("chairs sit on the fixture, not over the label hole", () => {
  const a = seatAnchors(4, false, 20, 20);
  assert.equal(a.length, 4);
  for (const p of a) {
    assert.ok(p.x >= 18 && p.x <= 82);
    assert.ok(p.y >= 18 && p.y <= 82);
  }
});

test("live floor and editor share seatingScale", () => {
  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  assert.match(art, /seatingScale/);
  assert.match(art, /railStoolCenters/);
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /FloorFixtureArt/);
  const live = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(live, /FloorFixtureArt/);
  const booth = readFileSync("src/components/pos/FloorBoothMark.tsx", "utf8");
  assert.match(booth, /seatingScale/);
  assert.match(booth, /benchVy/);
});
