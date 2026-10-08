import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dragLengthEnd } from "../src/lib/pos/floor-architecture.ts";
import {
  BOOTH_DEFAULTS,
  clampBoothSeats,
  isBoothKind,
} from "../src/lib/pos/floor-booth.ts";
import { DEFAULT_OBJECT_IN } from "../src/lib/pos/floor-dimensions.ts";
import { isAddCountKind } from "../src/lib/pos/floor-arrange.ts";
import { placeSectionName } from "../src/lib/pos/entity-floor.ts";
import { floorPlanFromPos, parseFloorPlan, tablesFromFloorPlan } from "../src/lib/saas/location-catalog.ts";

test("a couch keeps its sofa, four seats, and a quarter turn after publish", () => {
  const sections = [
    { id: "dining", name: "Dining", color: "sec-1", sort: 0 },
    { id: "bar", name: "Bar", color: "sec-2", sort: 1 },
  ];
  const room = placeSectionName("Bar", sections, null);
  assert.equal(room?.name, "Bar");
  assert.equal(room?.id, "bar");

  const couch = {
    id: "c1",
    label: "12",
    section: room?.name ?? "Bar",
    sectionId: room?.id,
    seats: 4,
    x: 22,
    y: 30,
    w: 18,
    h: 9,
    shape: "rect" as const,
    kind: "couch" as const,
    rotation: 90,
    lengthIn: 84,
    widthIn: 32,
    status: "empty" as const,
  };
  const booth = {
    id: "b1",
    label: "2",
    section: "Dining",
    seats: 4,
    x: 10,
    y: 12,
    w: 16,
    h: 20,
    shape: "booth" as const,
    kind: "booth_4" as const,
    rotation: 0,
    lengthIn: 60,
    widthIn: 48,
    status: "empty" as const,
  };
  const plan = floorPlanFromPos([couch, booth], sections);
  const parsed = parseFloorPlan(plan);
  const live = tablesFromFloorPlan(parsed!);
  const back = live.find((row) => row.id === "c1");
  const boothBack = live.find((row) => row.id === "b1");
  assert.equal(back?.kind, "couch");
  assert.equal(back?.seats, 4);
  assert.equal(back?.rotation, 90);
  assert.equal(back?.section, "Bar");
  assert.equal(back?.sectionId, "bar");
  assert.equal(back?.label, "12");
  assert.equal(back?.lengthIn, 84);
  assert.equal(back?.widthIn, 32);
  assert.ok((back?.lengthIn ?? 0) > (back?.widthIn ?? 0));
  assert.equal(boothBack?.kind, "booth_4");
  assert.equal(boothBack?.shape, "booth");
  assert.equal(boothBack?.seats, 4);

  assert.equal(isBoothKind("couch"), false);
  assert.equal(isBoothKind("booth_4"), true);
  assert.equal(isBoothKind("booth_u"), true);
  assert.equal(isBoothKind("booth_l"), true);
  assert.equal(clampBoothSeats("booth_4", 4), 4);
  assert.equal(clampBoothSeats("booth_u", 6), BOOTH_DEFAULTS.booth_u.seats);
  assert.equal(clampBoothSeats("booth_l", 5), 5);
  assert.equal(isAddCountKind("couch"), false);
  assert.equal(isAddCountKind("booth_4"), true);
  assert.ok(DEFAULT_OBJECT_IN.couch!.lengthIn > DEFAULT_OBJECT_IN.couch!.widthIn);

  const stretched = dragLengthEnd(
    { x: 20, y: 30, w: 18, h: 9, rotation: 0 },
    "end",
    { x: 48, y: 34.5 },
    { min: 2, max: 100, snap: 0 },
  );
  assert.ok(stretched.w > 18);
  assert.equal(stretched.h, 9);
  const turned = dragLengthEnd(
    { x: 20, y: 30, w: 18, h: 9, rotation: 90 },
    "end",
    { x: 29, y: 60 },
    { min: 2, max: 100, snap: 0 },
  );
  assert.ok(turned.w > 18);
  assert.equal(turned.h, 9);
});

test("the pieces bar puts Couch beside the booths, and the live floor draws the sofa", () => {
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  const kinds = editor.slice(editor.indexOf("const KINDS"), editor.indexOf("export function FloorEditorView"));
  const boothL = kinds.indexOf('id: "booth_l"');
  const couch = kinds.indexOf('id: "couch"');
  const stool = kinds.indexOf('id: "barstool"');
  assert.ok(boothL >= 0 && couch > boothL && stool > couch);
  assert.match(kinds, /label: "Couch"/);
  assert.match(kinds, /id: "couch", label: "Couch", shape: "rect", w: 18, h: 9, seats: 3/);
  assert.match(editor, /FloorCouchIcon/);
  assert.match(editor, /data-floor-kind=\{k\.id\}/);
  assert.match(editor, /k\.id === "couch" \? \(\s*<FloorCouchIcon/);
  assert.match(editor, /t\.kind === "couch" \? \(\s*<LengthHandles/);
  assert.match(editor, /t\.kind !== "couch" \? \(\s*<CornerHandle/);
  assert.match(editor, /section: dining/);
  assert.match(editor, /value=\{selectedTable\.seats\}/);
  assert.doesNotMatch(editor, /publishLocationFn/);

  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  const status = art.split("function StatusFixture")[1]?.split("function FloorTableArt")[0] ?? "";
  assert.match(art, /table\.kind === "couch"/);
  assert.match(art, /FloorCouchMark/);
  assert.match(status, /FloorCouchGlyph/);
  assert.match(status, /data-floor-status-shape=\{shape\}/);
  assert.match(status, /data-floor-nubs="0"/);
  assert.match(status, /couch \? "couch"/);

  const glyph = readFileSync("src/components/pos/FloorCouchMark.tsx", "utf8");
  assert.match(glyph, /data-floor-couch=""/);
  assert.match(glyph, /data-floor-couch-icon=""/);
  assert.match(glyph, /data-floor-nubs="0"/);
  assert.doesNotMatch(glyph, /<circle/);
  assert.doesNotMatch(glyph, /data-floor-nub="1"/);

  const boothArt = readFileSync("src/components/pos/FloorBoothMark.tsx", "utf8");
  assert.match(boothArt, /Booth4Paths/);
  assert.match(boothArt, /BoothUPaths/);
  assert.match(boothArt, /BoothLPaths/);

  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /Booth L, Couch, Barstool/);
  assert.match(guide, /low sofa/);
  assert.match(guide, /seat count starts at 3/);
  assert.match(guide, /Resize the sofa from the ends/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.207/);
  assert.match(types, /Bar length fields read Long leg and Short leg/);
});
