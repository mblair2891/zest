import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dragLengthEnd, dragRotatedCorner, lengthEndWorld } from "../src/lib/pos/floor-architecture.ts";

test("wall at 90 degrees lengthens on the vertical ends", () => {
  const box = { x: 20, y: 30, w: 28, h: 2, rotation: 90 };
  const start = lengthEndWorld(box, "start");
  const end = lengthEndWorld(box, "end");
  assert.ok(Math.abs(start.x - end.x) < 0.05);
  assert.ok(end.y > start.y + 20);

  const next = dragLengthEnd(box, "end", { x: end.x, y: end.y + 12 }, { min: 2, max: 100, snap: 2 });
  assert.equal(next.h, box.h);
  assert.ok(next.w > box.w + 8);
  const spun = { ...next, rotation: 90 };
  const nextStart = lengthEndWorld(spun, "start");
  const nextEnd = lengthEndWorld(spun, "end");
  assert.ok(Math.abs(nextStart.x - start.x) < 0.6);
  assert.ok(Math.abs(nextStart.y - start.y) < 0.6);
  assert.ok(Math.abs(nextEnd.x - end.x) < 0.6);
  assert.ok(nextEnd.y > end.y + 8);

  const flat = dragLengthEnd(
    { x: 20, y: 30, w: 28, h: 2, rotation: 0 },
    "end",
    { x: 60, y: 31 },
    { snap: 2 },
  );
  assert.equal(flat.h, 2);
  assert.ok(flat.w > 28);
  assert.ok(Math.abs(flat.x - 20) < 0.6);

  const table = { x: 10, y: 20, w: 12, h: 16, rotation: 90 };
  const grown = dragRotatedCorner(table, { x: 8, y: 44 }, { minW: 6, maxW: 40, minH: 6, maxH: 40 });
  assert.equal(grown.h, 16);
  assert.ok(grown.w > 18);
  assert.ok(Math.abs(grown.x + grown.w / 2 - (table.x + table.w / 2)) < 0.6);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-end=\{end\}/);
  assert.match(editor, /data-floor-resize/);
  assert.match(editor, /bg-neutral-950/);
  assert.match(editor, /pointer-events-none absolute overflow-visible/);
  assert.match(editor, /className=\{cn\("pointer-events-auto cursor-grab", spinRing\)\}/);
  const mark = readFileSync("src/components/pos/FloorArchitectureMark.tsx", "utf8");
  assert.match(mark, /data-floor-spin/);
  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  assert.match(art, /data-floor-spin/);
  const booth = readFileSync("src/components/pos/FloorBoothMark.tsx", "utf8");
  assert.match(booth, /data-floor-spin/);
});
