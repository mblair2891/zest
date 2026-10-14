import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DEFAULT_ROOM, fitRoomFocus, fitRoomToView } from "../src/lib/pos/floor-dimensions.ts";
import {
  initialStaffFloorSection,
  readStaffFloorSection,
  staffFloorSectionKey,
  tablesForStaffSection,
  writeStaffFloorSection,
} from "../src/lib/pos/floor-section-view.ts";

const room = DEFAULT_ROOM;
const dining = [1, 2, 3, 4].map((n, i) => ({
  id: `t${n}`,
  section: "Dining",
  kind: "table",
  x: 8 + (i % 2) * 18,
  y: 10 + Math.floor(i / 2) * 22,
  w: 12,
  h: 12,
}));
const bar = {
  id: "bar",
  section: "Bar",
  kind: "bar_top",
  x: 6,
  y: 70,
  w: 80,
  h: 6,
};
const stools = [1, 2, 3, 4, 5, 6].map((n, i) => ({
  id: `b${n}`,
  section: "Bar",
  kind: "barstool",
  railBarId: "bar",
  x: 8 + i * 12,
  y: 78,
  w: 8,
  h: 6,
}));

test("a section shows only that section and keeps the bar rail with its stools", () => {
  const tables = [...dining, bar, ...stools, { id: "wall", section: "Dining", kind: "wall", x: 0, y: 0, w: 4, h: 40 }];
  const onlyBar = tablesForStaffSection(tables, "Bar");
  assert.deepEqual(onlyBar.map((table) => table.id), ["bar", "b1", "b2", "b3", "b4", "b5", "b6"]);
  const onlyDining = tablesForStaffSection(tables, "Dining");
  assert.equal(onlyDining.some((table) => table.kind === "barstool"), false);
  assert.equal(tablesForStaffSection(tables, "All").length, tables.length);
});

test("the section choice is stored per person and does not publish the floor", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  };
  const sections = [
    { id: "sec_dining", name: "Dining" },
    { id: "sec_bar", name: "Bar" },
  ];
  writeStaffFloorSection(storage, "loc", "emp_bar", "Bar");
  writeStaffFloorSection(storage, "loc", "emp_server", "Dining");
  assert.equal(readStaffFloorSection(storage, "loc", "emp_bar", ["Dining", "Bar"]), "Bar");
  assert.equal(readStaffFloorSection(storage, "loc", "emp_server", ["Dining", "Bar"]), "Dining");
  assert.notEqual(staffFloorSectionKey("loc", "emp_bar"), staffFloorSectionKey("loc", "emp_server"));
  assert.equal(
    initialStaffFloorSection({ saved: null, sections, homeSectionIds: ["sec_bar"] }),
    "Bar",
  );
  assert.equal(initialStaffFloorSection({ saved: "All", sections, homeSectionIds: ["sec_bar"] }), "All");
  assert.equal(readStaffFloorSection(storage, "loc", "missing", ["Dining", "Bar"]), null);

  const view = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(view, /data-floor-section=/);
  assert.match(view, /writeStaffFloorSection/);
  assert.match(view, /fitRoomFocus/);
  const canvas = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(canvas, /mode="status"/);
  assert.match(canvas, /hollow=\{Boolean\(item\.hollow\)\}/);
  assert.doesNotMatch(canvas, /#f4efe6/);
  assert.doesNotMatch(view, /publishLocationFn/);
});

test("one section fills the screen so stools are larger than the whole room", () => {
  const view = { viewW: 1100, viewH: 700, marginPx: 16, minTapPx: 72 };
  const whole = fitRoomToView({ room, viewW: view.viewW, viewH: view.viewH, marginPx: 16 });
  const focus = fitRoomFocus({ room, fixtures: stools, ...view });
  const stoolIn = (8 / 100) * room.widthIn;
  const wholePx = stoolIn * whole.pxPerIn;
  const focusPx = stoolIn * focus.pxPerIn;
  assert.ok(focusPx > wholePx + 8, `focus ${focusPx} vs room ${wholePx}`);
  assert.ok(focusPx >= 64, `stool tap ${focusPx}`);
});
