import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLEAR_SLATE_CONFIRM,
  idsInMarquee,
  multiDeleteConfirm,
  nextSelection,
  viewportBoxToPlan,
} from "../src/lib/pos/floor-select.ts";

test("box select removes three tables and clear slate keeps the room", () => {
  const tables = [
    { id: "a", x: 2, y: 2, w: 10, h: 10 },
    { id: "b", x: 20, y: 2, w: 10, h: 10 },
    { id: "c", x: 40, y: 2, w: 10, h: 10 },
    { id: "d", x: 70, y: 70, w: 8, h: 8 },
  ];
  const hit = idsInMarquee(tables, { x: 0, y: 0, w: 55, h: 20 });
  assert.deepEqual(hit, ["a", "b", "c"]);
  const selected = nextSelection([], hit, false);
  const left = tables.filter((t) => !selected.includes(t.id));
  assert.deepEqual(left.map((t) => t.id), ["d"]);
  assert.equal(multiDeleteConfirm(selected.length), "Remove 3 objects?");
  assert.equal(multiDeleteConfirm(1), null);

  const room = { widthIn: 40 * 12, depthIn: 30 * 12 };
  const sections = ["Dining", "Bar"];
  const cleared = { tables: [] as typeof tables, room, sections };
  assert.equal(cleared.tables.length, 0);
  assert.equal(cleared.room.widthIn, room.widthIn);
  assert.equal(cleared.room.depthIn, room.depthIn);
  assert.deepEqual(cleared.sections, sections);

  const plan = viewportBoxToPlan(
    { left: 10, top: 10, width: 100, height: 40 },
    { x: 0, y: 0, s: 1 },
    1000,
    800,
  );
  assert.ok(plan.w > 0 && plan.h > 0);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-clear=""/);
  assert.match(editor, /CLEAR_SLATE_CONFIRM/);
  assert.equal(CLEAR_SLATE_CONFIRM, "Remove all objects in this room? Walls, tables, bar, stools.");
  assert.match(editor, /data-floor-marquee=""/);
  assert.match(editor, /data-floor-selected=/);
  assert.match(editor, /persistClearedFloor/);
  assert.doesNotMatch(editor, /publishLocationFn/);
});
