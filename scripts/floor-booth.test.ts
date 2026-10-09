import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  asBoothKind,
  boothTableBox,
  clampBoothSeats,
  isBoothKind,
  nextBoothRotation,
  type BoothKind,
} from "../src/lib/pos/floor-booth.ts";
import { seatingScale } from "../src/lib/pos/floor-seating.ts";
import { DEFAULT_OBJECT_IN, DEFAULT_ROOM, percentFromInches } from "../src/lib/pos/floor-dimensions.ts";

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
  assert.match(live, /FloorFixtureArt/);
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
  assert.match(floor, /Booth numbers use the same type size as table numbers/);
  assert.match(floor, /open center, not stretched to the bench/);
  assert.match(floor, /editor and the live floor both do this/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.218/);
  assert.match(types, /Oregon spirits price list/);
});

test("booths 9–15 sit the number on the open table, not across the bench", () => {
  const kinds: BoothKind[] = ["booth_4", "booth_u", "booth_l"];
  for (let n = 9; n <= 15; n++) {
    const kind = kinds[(n - 9) % kinds.length]!;
    const spec = DEFAULT_OBJECT_IN[kind]!;
    const w = percentFromInches(spec.lengthIn, DEFAULT_ROOM.widthIn);
    const h = percentFromInches(spec.widthIn, DEFAULT_ROOM.depthIn);
    const box = boothTableBox(kind, seatingScale({ w, h, seats: 4 }));
    assert.ok(box.w <= 70 && box.h <= 70, `${n} ${kind} box ${box.w}x${box.h} fills the booth`);
    assert.ok(box.x >= 12 && box.y >= 12, `${n} ${kind} starts on a bench`);
    assert.ok(box.x + box.w <= 92 && box.y + box.h <= 92, `${n} ${kind} reaches the bench edge`);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    if (kind === "booth_4") assert.ok(cy > 35 && cy < 65, `booth ${n} center ${cy}`);
    if (kind === "booth_u") assert.ok(cx > 35 && cx < 65 && cy < 62, `booth ${n} center ${cx},${cy}`);
    if (kind === "booth_l") assert.ok(cx > 45 && cy < 60, `booth ${n} center ${cx},${cy}`);
  }
  const art = readFileSync("src/components/pos/FloorBoothMark.tsx", "utf8");
  assert.match(art, /data-floor-booth-label=""/);
  assert.match(art, /data-floor-label-place="open"/);
  assert.match(art, /text-\[11px\] font-semibold/);
  assert.match(art, /joined\?\.length \? "42cqmin" : "50cqmin"/);
  assert.match(art, /surface="editor"/);
  const live = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  assert.match(live, /surface="live"/);
  assert.match(live, /absolute inset-0 flex items-center justify-center px-1 text-center text-\[11px\] font-semibold/);
  assert.match(live, /fontSize: joined\?\.length \? "42cqmin" : "50cqmin"/);
  const tableLabel = live.indexOf("function FloorTableArt");
  const stoolLabel = live.indexOf("function FloorStoolArt");
  const tableArt = live.slice(tableLabel, stoolLabel);
  assert.match(tableArt, /text-\[11px\] font-semibold/);
  assert.doesNotMatch(tableArt, /data-floor-booth-label/);
});
