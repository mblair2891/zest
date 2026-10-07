import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { floorEditScope } from "../src/lib/pos/entity-floor.ts";
import {
  HOUSE_OWNER,
  lockedFloorMessage,
  orderEntityForRoom,
  ownerDisplayName,
  printerFollowsRoom,
  publishOwnerBlock,
  sectionForPiece,
  sectionOwnerId,
  sectionOwnerIsSet,
  staffMayTakeSection,
} from "../src/lib/pos/room-owner.ts";
import { floorPlanFromPos, parseFloorPlan } from "../src/lib/saas/location-catalog.ts";

test("unset rooms show as House and block publish until set", () => {
  assert.equal(HOUSE_OWNER, "host");
  assert.equal(sectionOwnerIsSet({}), false);
  assert.equal(sectionOwnerIsSet({ operatorId: "" }), false);
  assert.equal(sectionOwnerIsSet({ operatorId: null }), false);
  assert.equal(sectionOwnerId({}), "host");
  assert.equal(sectionOwnerIsSet({ operatorId: "host" }), true);
  assert.equal(sectionOwnerIsSet({ operatorId: "op_a" }), true);
  const block = publishOwnerBlock([
    { id: "d", name: "Dining" },
    { id: "b", name: "Bar", operatorId: "op_b" },
  ]);
  assert.match(block ?? "", /Dining/);
  assert.doesNotMatch(block ?? "", /Bar/);
  assert.equal(
    publishOwnerBlock([
      { id: "d", name: "Dining", operatorId: "op_a" },
      { id: "b", name: "Bar", operatorId: "op_b" },
    ]),
    null,
  );
  assert.equal(publishOwnerBlock([]), null);
  assert.equal(
    publishOwnerBlock([{ id: "d", name: "Dining", operatorId: "host" }]),
    null,
  );
});

test("staff, receipt printers, and empty lines follow the room owner", () => {
  assert.equal(staffMayTakeSection({ operatorId: "op_a" }, { operatorId: "op_a" }), true);
  assert.equal(staffMayTakeSection({ operatorId: "op_a" }, { operatorId: "op_b" }), false);
  assert.equal(staffMayTakeSection({ operatorId: "op_a" }, {}), false);
  assert.equal(staffMayTakeSection({ operatorId: "" }, {}), true);
  assert.equal(staffMayTakeSection({ operatorId: "host" }, { operatorId: "host" }), true);
  assert.equal(staffMayTakeSection({ operatorId: "host" }, { operatorId: "op_a" }), false);
  assert.equal(staffMayTakeSection(null, { operatorId: "host" }), false);

  assert.equal(printerFollowsRoom("op_a", { operatorId: "op_a" }), true);
  assert.equal(printerFollowsRoom("op_b", { operatorId: "op_a" }), false);
  assert.equal(printerFollowsRoom("", {}), true);
  assert.equal(printerFollowsRoom("host", {}), true);
  assert.equal(printerFollowsRoom("op_a", {}), false);

  assert.equal(orderEntityForRoom({ operatorId: "op_a" }), "op_a");
  assert.equal(orderEntityForRoom({ operatorId: "host" }), null);
  assert.equal(orderEntityForRoom({}), null);
  assert.equal(orderEntityForRoom(null), null);
});

test("a seating loan does not change the room owner", () => {
  const sections = [
    { id: "sec_dining", name: "Dining", operatorId: "op_a" },
    { id: "sec_bar", name: "Bar", operatorId: "op_b" },
  ];
  const scoped = floorEditScope({
    entityId: "op_a",
    sections,
    tables: [
      { id: "t_dining", section: "Dining", sectionId: "sec_dining" },
      { id: "t_bar", section: "Bar", sectionId: "sec_bar" },
    ],
    grants: [{ employeeId: "e_a", tableId: "t_bar", scope: "seating" }],
    employees: [{ id: "e_a", operatorId: "op_a" }],
  });
  assert.deepEqual(scoped.sectionIds, ["sec_dining"]);
  assert.ok(scoped.tableIds.includes("t_dining"));
  assert.ok(scoped.tableIds.includes("t_bar"));
  assert.equal(sections[1]!.operatorId, "op_b");
});

test("publish keeps House and entity owners", () => {
  const table = {
    id: "t1",
    label: "1",
    section: "Dining",
    seats: 4,
    x: 10,
    y: 10,
    w: 12,
    h: 12,
    shape: "round" as const,
    kind: "table" as const,
    status: "empty" as const,
  };
  const plan = floorPlanFromPos(
    [table],
    [
      { id: "sec_dining", name: "Dining", color: "sec-1", sort: 0, operatorId: "op_a" },
      { id: "sec_bar", name: "Bar", color: "sec-3", sort: 1, operatorId: "host" },
      { id: "sec_open", name: "Patio", color: "sec-2", sort: 2, operatorId: null },
    ],
  );
  const parsed = parseFloorPlan(plan);
  const dining = parsed?.sections.find((s) => s.id === "sec_dining");
  const bar = parsed?.sections.find((s) => s.id === "sec_bar");
  const patio = parsed?.sections.find((s) => s.id === "sec_open");
  assert.equal(dining?.operatorId, "op_a");
  assert.equal(bar?.operatorId, "host");
  assert.equal(patio?.operatorId, undefined);
  assert.match(publishOwnerBlock(parsed?.sections ?? []) ?? "", /Patio/);
});

test("a locked table names the owning entity", () => {
  const vendors = [{ id: "op_bbq", name: "Diamond House BBQ" }];
  const sections = [
    { id: "sec_dining", name: "Dining", operatorId: "op_bbq" },
    { id: "sec_patio", name: "Patio", operatorId: "host" },
    { id: "sec_open", name: "Garden" },
  ];
  const dining = sectionForPiece({ section: "Dining", sectionId: "sec_dining" }, sections);
  const patio = sectionForPiece({ section: "Patio", sectionId: "sec_patio" }, sections);
  const garden = sectionForPiece({ section: "Garden", sectionId: "sec_open" }, sections);
  const entityB = lockedFloorMessage({ label: "1", kind: "table" }, ownerDisplayName(dining!, vendors));
  assert.equal(entityB, "Table 1 is on Diamond House BBQ’s section.");
  assert.match(entityB, /Diamond House BBQ/);
  assert.doesNotMatch(entityB, /another entity/i);
  const house = lockedFloorMessage({ label: "2", kind: "table" }, ownerDisplayName(patio!, vendors));
  assert.equal(house, "Table 2 is on House (shared).");
  assert.match(house, /House/);
  assert.equal(
    lockedFloorMessage({ label: "3", kind: "table" }, ownerDisplayName(garden!, vendors)),
    "Table 3 is on House (shared).",
  );
  assert.equal(
    lockedFloorMessage({ label: "Wall", kind: "wall" }, "Diamond House BBQ"),
    "Wall is on Diamond House BBQ’s section.",
  );
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /lockedFloorMessage/);
  assert.match(editor, /data-floor-locked-copy/);
  assert.doesNotMatch(editor, /another entity/);
  const down = editor.slice(editor.indexOf("const onPointerDown"), editor.indexOf("const startResize"));
  const resize = editor.slice(editor.indexOf("const startResize"), editor.indexOf("const onPointerMove"));
  const remove = editor.slice(editor.indexOf("const removeIds"), editor.indexOf("const deleteSelection"));
  assert.match(down, /!pieceEditable\(id\)/);
  assert.match(resize, /!pieceEditable\(id\)\) return/);
  assert.match(remove, /pieceEditable\(id\)/);
  assert.match(editor, /wholeFloor \? null/);
});

test("floor editor owner dropdown and publish gate are wired", () => {
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-section-entity/);
  assert.match(editor, /data-owner-set/);
  assert.match(editor, /House/);
  assert.match(editor, /printerFollowsRoom/);
  const api = readFileSync("src/lib/access/api.ts", "utf8");
  assert.match(api, /publishOwnerBlock/);
  const staff = readFileSync("src/components/pos/EmployeesView.tsx", "utf8");
  assert.match(staff, /staffMayTakeSection/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /House/);
  assert.match(guide, /does not change the owner/);
});
