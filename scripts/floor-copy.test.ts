import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planFloorCopies, COPY_OFFSET_IN } from "../src/lib/pos/floor-copy.ts";

const room = { widthIn: 40 * 12, depthIn: 30 * 12 };

test("copy table 4 three times steps one foot and takes the next numbers", () => {
  assert.equal(COPY_OFFSET_IN, 12);
  const source = {
    label: "4",
    section: "Dining",
    sectionId: "sec-dining",
    seats: 4,
    x: 10,
    y: 10,
    w: 7.5,
    h: 10,
    shape: "round" as const,
    kind: "table" as const,
    lengthIn: 36,
    widthIn: 36,
    rotation: 90,
  };
  const existing = ["1", "2", "3", "4", "17", "B9"];
  assert.deepEqual(planFloorCopies(source, existing, 0, room), []);
  assert.deepEqual(planFloorCopies(source, existing, -2, room), []);
  const copies = planFloorCopies(source, existing, 3, room);
  assert.equal(copies.length, 3);
  assert.deepEqual(
    copies.map((c) => c.label),
    ["18", "19", "20"],
  );
  const stepX = (12 / room.widthIn) * 100;
  const stepY = (12 / room.depthIn) * 100;
  const seen = new Set<string>(["10|10"]);
  copies.forEach((c, i) => {
    assert.ok(Math.abs(c.x - (10 + stepX * (i + 1))) < 0.05);
    assert.ok(Math.abs(c.y - (10 + stepY * (i + 1))) < 0.05);
    assert.equal(c.w, source.w);
    assert.equal(c.h, source.h);
    assert.equal(c.lengthIn, 36);
    assert.equal(c.widthIn, 36);
    assert.equal(c.rotation, 90);
    assert.equal(c.kind, "table");
    assert.equal(c.section, "Dining");
    assert.equal(c.seats, 4);
    const key = `${c.x}|${c.y}`;
    assert.equal(seen.has(key), false);
    seen.add(key);
  });

  const stools = planFloorCopies(
    { ...source, label: "B9" },
    ["B1", "B9", "B10", "4"],
    2,
    room,
  );
  assert.deepEqual(
    stools.map((s) => s.label),
    ["B11", "B12"],
  );
  assert.equal(stools[0]?.w, source.w);
  assert.equal(stools[1]?.lengthIn, 36);

  const bar = planFloorCopies(
    {
      label: "Bar",
      x: 10,
      y: 20,
      w: 30,
      h: 8,
      points: [
        { x: 10, y: 24 },
        { x: 40, y: 24 },
      ],
      legLengths: [30],
      rotation: 0,
    },
    ["Bar"],
    1,
    room,
  );
  assert.equal(bar.length, 1);
  assert.equal(bar[0]?.legLengths?.[0], 30);
  assert.ok(Math.abs((bar[0]?.points?.[0]?.x ?? 0) - (10 + stepX)) < 0.05);
  assert.ok(Math.abs((bar[0]?.points?.[1]?.x ?? 0) - (40 + stepX)) < 0.05);
  assert.ok(Math.abs((bar[0]?.points?.[0]?.y ?? 0) - (24 + stepY)) < 0.05);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /How many copies\?/);
  assert.match(editor, /data-floor-copy/);
  assert.match(editor, /data-floor-copy-count/);
  assert.match(editor, /Cancel/);
  const live = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.doesNotMatch(live, /How many copies\?/);
  assert.doesNotMatch(live, /data-floor-copy/);
});
