import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixtureEdgeBox } from "../src/lib/pos/floor-dimensions.ts";
import {
  duplicateSeatLabels,
  duplicateSeatMessage,
  snapFlushToArchitecture,
} from "../src/lib/pos/floor-arrange.ts";
import { openingOnWall, outlineWalls } from "../src/lib/pos/floor-room.ts";
import { floorPlanFromPos, parseFloorPlan, tablesFromFloorPlan } from "../src/lib/saas/location-catalog.ts";

const room = { widthIn: 40 * 12, depthIn: 30 * 12 };

test("a couch snaps flush to the window on its right", () => {
  const right = outlineWalls(room).find((wall) => wall.edge === "right");
  assert.ok(right);
  const window = openingOnWall({ ...right, id: "wall-r" }, room, { t: 0.45, lengthIn: 48 });
  assert.ok(window);
  const winBox = fixtureEdgeBox(window, room);
  const layoutRightIn = ((window.x + window.w) / 100) * room.widthIn;
  assert.ok(Math.abs(layoutRightIn - winBox.left) > 12);

  const couchW = 84;
  const couchH = 32;
  const couch = {
    x: ((winBox.left - 4 - couchW) / room.widthIn) * 100,
    y: (((winBox.top + winBox.bottom) / 2 - couchH / 2) / room.depthIn) * 100,
    w: (couchW / room.widthIn) * 100,
    h: (couchH / room.depthIn) * 100,
    rotation: 0,
    kind: "couch" as const,
  };
  const before = fixtureEdgeBox(couch, room);
  assert.ok(Math.abs(winBox.left - before.right - 4) < 0.05);

  const snapped = snapFlushToArchitecture(couch, [{ ...window, kind: "window" }], room);
  assert.ok(snapped);
  const after = fixtureEdgeBox({ ...couch, ...snapped }, room);
  assert.ok(Math.abs(after.right - winBox.left) < 0.05);
  assert.ok(snapped.x > couch.x);
  assert.equal(snapped.y, Math.round(couch.y * 10000) / 10000);
  assert.ok(Math.abs(after.right - layoutRightIn) > 12);

  const far = { ...couch, x: ((winBox.left - 20 - couchW) / room.widthIn) * 100 };
  assert.equal(snapFlushToArchitecture(far, [{ ...window, kind: "window" }], room), null);

  const top = outlineWalls(room).find((wall) => wall.edge === "top");
  assert.ok(top);
  const door = openingOnWall({ ...top, id: "wall-t" }, room, { t: 0.4, lengthIn: 36 });
  assert.ok(door);
  const doorBox = fixtureEdgeBox(door, room);
  const table = {
    x: ((doorBox.left + 4) / room.widthIn) * 100,
    y: ((doorBox.bottom + 3) / room.depthIn) * 100,
    w: (36 / room.widthIn) * 100,
    h: (36 / room.depthIn) * 100,
    rotation: 0,
    kind: "table" as const,
  };
  const tableSnap = snapFlushToArchitecture(table, [{ ...door, kind: "door" }], room);
  assert.ok(tableSnap);
  const tableAfter = fixtureEdgeBox({ ...table, ...tableSnap }, room);
  assert.ok(Math.abs(tableAfter.top - doorBox.bottom) < 0.05);

  const left = outlineWalls(room).find((wall) => wall.edge === "left");
  assert.ok(left);
  const leftBox = fixtureEdgeBox(left, room);
  const booth = {
    x: ((leftBox.right + 5) / room.widthIn) * 100,
    y: 30,
    w: (60 / room.widthIn) * 100,
    h: (48 / room.depthIn) * 100,
    rotation: 0,
    kind: "booth_4" as const,
  };
  const boothSnap = snapFlushToArchitecture(booth, [{ ...left, kind: "wall" }], room);
  assert.ok(boothSnap);
  const boothAfter = fixtureEdgeBox({ ...booth, ...boothSnap }, room);
  assert.ok(Math.abs(boothAfter.left - leftBox.right) < 0.05);

  const stool = {
    x: ((leftBox.right + 4) / room.widthIn) * 100,
    y: 50,
    w: (16 / room.widthIn) * 100,
    h: (16 / room.depthIn) * 100,
    rotation: 0,
    kind: "barstool" as const,
  };
  const stoolSnap = snapFlushToArchitecture(stool, [{ ...left, kind: "wall" }], room);
  assert.ok(stoolSnap);
  const stoolAfter = fixtureEdgeBox({ ...stool, ...stoolSnap }, room);
  assert.ok(Math.abs(stoolAfter.left - leftBox.right) < 0.05);
});

test("publish keeps bar, stools, tables, and couch coordinates", () => {
  const sections = [{ id: "bar", name: "Bar", color: "sec-2", sort: 0, operatorId: "ent" }];
  const pieces = [
    {
      id: "bar",
      label: "BAR",
      section: "Bar",
      sectionId: "bar",
      seats: 0,
      x: 8.2,
      y: 16.4,
      w: 36.5,
      h: 9.2,
      shape: "rect" as const,
      kind: "bar_top" as const,
      barShape: "straight" as const,
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 20 },
      ],
      legLengths: [30],
      lengthIn: 144,
      widthIn: 24,
      rotation: 0,
      status: "empty" as const,
    },
    {
      id: "b1",
      label: "B1",
      section: "Bar",
      sectionId: "bar",
      seats: 1,
      x: 9.15,
      y: 24.65,
      w: 3.4,
      h: 3.4,
      shape: "rect" as const,
      kind: "barstool" as const,
      lengthIn: 16,
      widthIn: 16,
      rotation: 17,
      railBarId: "bar",
      status: "empty" as const,
    },
    {
      id: "b2",
      label: "B2",
      section: "Bar",
      sectionId: "bar",
      seats: 1,
      x: 14.25,
      y: 24.65,
      w: 3.4,
      h: 3.4,
      shape: "rect" as const,
      kind: "barstool" as const,
      lengthIn: 16,
      widthIn: 16,
      rotation: 17,
      railBarId: "bar",
      status: "empty" as const,
    },
    {
      id: "t1",
      label: "1",
      section: "Bar",
      sectionId: "bar",
      seats: 4,
      x: 22.2,
      y: 40.5,
      w: 7.5,
      h: 10,
      shape: "round" as const,
      kind: "table" as const,
      lengthIn: 36,
      widthIn: 36,
      rotation: 0,
      status: "empty" as const,
    },
    {
      id: "c1",
      label: "",
      section: "Bar",
      sectionId: "bar",
      seats: 3,
      x: 48.35,
      y: 55.1,
      w: 17.5,
      h: 8.9,
      shape: "rect" as const,
      kind: "couch" as const,
      lengthIn: 84,
      widthIn: 32,
      rotation: 90,
      status: "empty" as const,
    },
  ];
  const plan = floorPlanFromPos(pieces, sections, room);
  const parsed = parseFloorPlan(plan);
  assert.ok(parsed);
  const back = tablesFromFloorPlan(parsed);
  assert.deepEqual(
    back.map((row) => row.id),
    pieces.map((row) => row.id),
  );
  for (const piece of pieces) {
    const row = back.find((item) => item.id === piece.id);
    assert.ok(row);
    assert.equal(row.x, piece.x);
    assert.equal(row.y, piece.y);
    assert.equal(row.w, piece.w);
    assert.equal(row.h, piece.h);
    assert.equal(row.rotation, piece.rotation);
    assert.equal(row.label, piece.label);
    assert.equal(row.kind, piece.kind);
  }
  const again = tablesFromFloorPlan(parseFloorPlan(parsed)!);
  assert.equal(again.find((row) => row.id === "bar")?.w, 36.5);
  assert.equal(again.find((row) => row.id === "b1")?.x, 9.15);
  assert.equal(again.find((row) => row.id === "b1")?.rotation, 17);
  assert.equal(again.find((row) => row.id === "c1")?.label, "");
  assert.deepEqual(
    again.map((row) => row.id),
    pieces.map((row) => row.id),
  );
});

test("duplicate seating numbers name both pieces and empty labels stay open", () => {
  const clash = duplicateSeatLabels([
    { id: "t1", label: "4", kind: "table", section: "Dining" },
    { id: "c1", label: "4", kind: "couch", section: "Lounge" },
    { id: "wall", label: "4", kind: "wall", section: "Dining" },
  ]);
  assert.ok(clash);
  assert.equal(clash.a.id, "t1");
  assert.equal(clash.b.id, "c1");
  const message = duplicateSeatMessage(clash);
  assert.match(message, /Table 4 in Dining/);
  assert.match(message, /Couch 4 in Lounge/);
  assert.equal(
    duplicateSeatLabels([
      { id: "a", label: "", kind: "table" },
      { id: "b", label: "   ", kind: "couch" },
      { id: "c", label: "1", kind: "booth_4" },
    ]),
    null,
  );
  assert.equal(
    duplicateSeatLabels([
      { id: "w1", label: "Wall", kind: "wall" },
      { id: "w2", label: "Wall", kind: "door" },
    ]),
    null,
  );
  assert.equal(
    duplicateSeatLabels([
      { id: "t1", label: "4", kind: "table", section: "Dining" },
      { id: "t2", label: "5", kind: "table", section: "Dining" },
    ]),
    null,
  );
  const stools = duplicateSeatLabels([
    { id: "b1", label: "B1", kind: "barstool", section: "Bar" },
    { id: "b2", label: "B1", kind: "barstool", section: "Bar" },
  ]);
  assert.ok(stools);
  assert.match(duplicateSeatMessage(stools), /Stool B1 in Bar/);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  const publish = editor.slice(editor.indexOf("const publishFloor"), editor.indexOf("const dockAt"));
  const clashAt = publish.indexOf("duplicateSeatLabels");
  const sendAt = publish.indexOf("publishEntityFloorFn");
  assert.ok(clashAt >= 0 && sendAt > clashAt);
  assert.match(editor, /snapFlushToArchitecture/);
  assert.match(editor, /data-floor-duplicate=""/);
  assert.doesNotMatch(editor, /publishLocationFn/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /sit flush against a wall, a door, or a window/);
  assert.match(guide, /Empty labels are allowed/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.206/);
  assert.match(types, /Sandbox card on a PAX D135/);
});
