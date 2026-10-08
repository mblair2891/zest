import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeEntityFloor } from "../src/lib/pos/entity-floor.ts";
import { parseFloorPlan } from "../src/lib/saas/location-catalog.ts";

const room = { widthIn: 504, depthIn: 336 };

const stored = {
  room,
  sections: [
    { id: "sec_a", name: "Grill", operatorId: "ent_a", color: "sec-1", sort: 0 },
    { id: "sec_b", name: "Bar", operatorId: "ent_b", color: "sec-2", sort: 1 },
    { id: "sec_h", name: "Hall", operatorId: "host", color: "sec-3", sort: 2 },
    { id: "sec_u", name: "Patio", color: "sec-4", sort: 3 },
  ],
  tables: [
    { id: "t1", label: "1", section: "Grill", sectionId: "sec_a", x: 10, y: 10, w: 12, h: 12, seats: 4, shape: "round" as const },
    { id: "t2", label: "2", section: "Bar", sectionId: "sec_b", x: 20, y: 12, w: 12, h: 12, seats: 2, shape: "rect" as const },
    { id: "t3", label: "3", section: "Hall", sectionId: "sec_h", x: 30, y: 14, w: 12, h: 12, seats: 4, shape: "round" as const },
    { id: "t4", label: "4", section: "Patio", sectionId: "sec_u", x: 40, y: 16, w: 12, h: 12, seats: 4, shape: "round" as const },
    { id: "loan", label: "5", section: "Bar", sectionId: "sec_b", x: 50, y: 18, w: 10, h: 10, seats: 2, shape: "rect" as const },
  ],
};

test("peer venue entity publish keeps the moved table and leaves other rooms", () => {
  const draft = {
    sections: stored.sections.map((section) =>
      section.id === "sec_a" ? { ...section, operatorId: "ent_b" } : { ...section },
    ),
    tables: [
      { ...stored.tables[0], x: 55, y: 22, seats: 6, shape: "rect" as const },
      { ...stored.tables[1], x: 1, y: 1, seats: 9, shape: "round" as const },
      { ...stored.tables[2], x: 2, y: 2, seats: 8, shape: "rect" as const },
      { ...stored.tables[3], x: 3, y: 3, seats: 2, shape: "rect" as const },
      { ...stored.tables[4], x: 4, y: 4, seats: 6, shape: "round" as const },
      { id: "tnew", label: "6", section: "Grill", sectionId: "sec_a", x: 60, y: 10, w: 12, h: 12, seats: 4, shape: "round" as const },
      { id: "thief", label: "7", section: "Bar", sectionId: "sec_b", x: 70, y: 10, w: 12, h: 12, seats: 4, shape: "round" as const },
      { id: "extra", label: "8", section: "New", sectionId: "sec_new", x: 80, y: 10, w: 12, h: 12, seats: 4, shape: "round" as const },
    ],
  };
  const merged = mergeEntityFloor({
    stored,
    draft: {
      ...draft,
      sections: [
        ...draft.sections,
        { id: "sec_new", name: "New", operatorId: "ent_a", color: "sec-1", sort: 4 },
      ],
    },
    entityId: "ent_a",
  });

  const own = merged.tables.find((table) => table.id === "t1");
  assert.equal(own?.x, 55);
  assert.equal(own?.y, 22);
  assert.equal(own?.seats, 6);
  assert.equal(own?.shape, "rect");
  assert.equal(own?.sectionId, "sec_a");
  assert.equal(merged.tables.find((table) => table.id === "t2"), stored.tables[1]);
  assert.equal(merged.tables.find((table) => table.id === "t3"), stored.tables[2]);
  assert.equal(merged.tables.find((table) => table.id === "t4"), stored.tables[3]);
  assert.equal(merged.tables.find((table) => table.id === "loan"), stored.tables[4]);
  assert.equal(merged.tables.find((table) => table.id === "thief"), undefined);
  assert.equal(merged.tables.find((table) => table.id === "extra"), undefined);
  assert.equal(merged.tables.find((table) => table.id === "tnew")?.sectionId, "sec_a");
  assert.equal(merged.sections.find((section) => section.id === "sec_a")?.operatorId, "ent_a");
  assert.equal(merged.sections.find((section) => section.id === "sec_b"), stored.sections[1]);
  assert.equal(merged.sections.find((section) => section.id === "sec_h")?.operatorId, "host");
  assert.equal(merged.sections.find((section) => section.id === "sec_u")?.operatorId, undefined);
  assert.equal(merged.sections.find((section) => section.id === "sec_new"), undefined);
  assert.equal(merged.room, room);

  const published = parseFloorPlan(merged);
  const again = parseFloorPlan(published);
  assert.equal(published?.tables.find((table) => table.id === "t1")?.seats, 6);
  assert.equal(published?.tables.find((table) => table.id === "t1")?.shape, "rect");
  assert.equal(published?.tables.find((table) => table.id === "t1")?.x, 55);
  assert.equal(published?.tables.find((table) => table.id === "t2")?.x, 20);
  assert.equal(published?.tables.find((table) => table.id === "t2")?.seats, 2);
  assert.equal(published?.tables.find((table) => table.id === "t3")?.seats, 4);
  assert.equal(published?.tables.find((table) => table.id === "loan")?.x, 50);
  assert.equal(again?.tables.find((table) => table.id === "t1")?.x, 55);
  assert.equal(again?.tables.find((table) => table.id === "t1")?.seats, 6);
  assert.equal(again?.tables.find((table) => table.id === "t2")?.x, 20);
  assert.equal(again?.room?.widthIn, room.widthIn);

  const stable = mergeEntityFloor({ stored: merged, draft: merged, entityId: "ent_a" });
  assert.deepEqual(
    stable.tables.map((table) => ({ id: table.id, x: table.x, seats: table.seats, shape: table.shape })),
    merged.tables.map((table) => ({ id: table.id, x: table.x, seats: table.seats, shape: table.shape })),
  );
});

test("moving a table into another room does not publish that move", () => {
  const merged = mergeEntityFloor({
    stored,
    draft: {
      sections: stored.sections,
      tables: stored.tables.map((table) =>
        table.id === "t1" ? { ...table, section: "Bar", sectionId: "sec_b", x: 99, seats: 8, shape: "rect" as const } : table,
      ),
    },
    entityId: "ent_a",
  });
  const own = merged.tables.find((table) => table.id === "t1");
  assert.equal(own?.x, 10);
  assert.equal(own?.seats, 4);
  assert.equal(own?.sectionId, "sec_a");
  assert.equal(merged.tables.find((table) => table.id === "t2")?.x, 20);
});

test("publish drops a deleted bar and the stools bound to it", () => {
  const withBar = {
    ...stored,
    tables: [
      ...stored.tables,
      { id: "bar", label: "BAR", kind: "bar_top", section: "Grill", sectionId: "sec_a", x: 8, y: 8, w: 40, h: 8, seats: 0, shape: "rect" as const, railBarId: undefined },
      { id: "b1", label: "B1", kind: "barstool", railBarId: "bar", section: "Grill", sectionId: "sec_a", x: 8, y: 16, w: 4, h: 4, seats: 1, shape: "rect" as const },
      { id: "loose", label: "B9", kind: "barstool", section: "Grill", sectionId: "sec_a", x: 70, y: 16, w: 4, h: 4, seats: 1, shape: "rect" as const },
      { id: "bOther", label: "B2", kind: "barstool", railBarId: "barB", section: "Bar", sectionId: "sec_b", x: 20, y: 30, w: 4, h: 4, seats: 1, shape: "rect" as const },
    ],
  };
  const draftTables = withBar.tables.filter((table) => table.id !== "bar" && table.id !== "b1");
  const merged = mergeEntityFloor({
    stored: withBar,
    draft: { sections: withBar.sections, tables: draftTables },
    entityId: "ent_a",
  });
  assert.equal(merged.tables.find((table) => table.id === "bar"), undefined);
  assert.equal(merged.tables.find((table) => table.id === "b1"), undefined);
  assert.equal(merged.tables.find((table) => table.id === "loose")?.label, "B9");
  assert.equal(merged.tables.find((table) => table.id === "bOther")?.label, "B2");
  assert.equal(merged.tables.find((table) => table.id === "t2")?.sectionId, "sec_b");
});

test("entity floor editor publishes its rooms and still leaves the host publish alone", () => {
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  const persist = readFileSync("src/lib/pos/persist-location-setup.ts", "utf8");
  const server = readFileSync("src/lib/pos/entity-floor-publish.server.ts", "utf8");
  const house = readFileSync("src/components/platform/VenueHouseSettings.tsx", "utf8");
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(editor, /data-floor-publish/);
  assert.match(editor, /Publish floor/);
  assert.match(editor, /peerVenue/);
  assert.match(editor, /lockedFloorMessage/);
  assert.doesNotMatch(editor, /publishLocationFn/);
  assert.match(persist, /if \(_kind === "floor" && editorId\) return/);
  assert.match(server, /mergeEntityFloor/);
  assert.match(server, /isPeerVenueModel/);
  assert.doesNotMatch(server, /updateLocationSetupForUser/);
  assert.match(house, /publishLocationFn/);
  assert.match(guide, /the entity floor editor has Publish floor/);
  assert.match(guide, /A House room stays locked unless this login is the location contact/);
});
