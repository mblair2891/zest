import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  asBoothKind,
  clampBoothSeats,
  isBoothKind,
  nextBoothRotation,
} from "../src/lib/pos/floor-booth.ts";

test("legacy booth maps to 4-top; U and L stay distinct", () => {
  assert.equal(asBoothKind("booth"), "booth_4");
  assert.equal(asBoothKind(undefined, "booth"), "booth_4");
  assert.equal(asBoothKind("booth_u"), "booth_u");
  assert.equal(asBoothKind("booth_l"), "booth_l");
  assert.equal(isBoothKind("booth_4"), true);
  assert.equal(isBoothKind("table"), false);
  assert.equal(clampBoothSeats("booth_u", 3), 4);
  assert.equal(clampBoothSeats("booth_u", 9), 8);
  assert.equal(clampBoothSeats("booth_l", 5), 5);
  assert.equal(nextBoothRotation(0), 90);
  assert.equal(nextBoothRotation(270), 0);
});

test("full-service seed includes 4-top, U, and L booths", () => {
  const starter = readFileSync("src/lib/pos/starter-seed.ts", "utf8");
  assert.match(starter, /kind: "booth_4"/);
  assert.match(starter, /kind: "booth_u"/);
  assert.match(starter, /kind: "booth_l"/);
  const seed = readFileSync("src/lib/pos/seed.ts", "utf8");
  assert.match(seed, /kind: "booth_4"/);
  assert.match(seed, /kind: "booth_u"/);
  assert.match(seed, /kind: "booth_l"/);
});

test("editor palette and live floor share booth artwork", () => {
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /Booth 4-top/);
  assert.match(editor, /Booth U/);
  assert.match(editor, /Booth L/);
  assert.match(editor, /FloorBoothMark/);
  assert.match(editor, /FloorBoothIcon/);
  assert.match(editor, /Rotate 90/);
  const live = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(live, /FloorBoothMark/);
  assert.match(live, /asBoothKind/);
  const art = readFileSync("src/components/pos/FloorBoothMark.tsx", "utf8");
  assert.match(art, /Booth4Paths/);
  assert.match(art, /BoothUPaths/);
  assert.match(art, /BoothLPaths/);
  assert.match(art, /benchFill/);
});

test("guide floorplan covers booth shapes, not fat rectangles", () => {
  const floor = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(floor, /Booth 4-top/);
  assert.match(floor, /Booth U/);
  assert.match(floor, /Booth L/);
  assert.match(floor, /upholstery/);
  assert.doesNotMatch(floor, /Summit Hall/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.91/);
});
