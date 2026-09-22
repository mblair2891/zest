import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Table } from "../src/lib/pos/types.ts";
import {
  canCombineTables,
  clusterNumbers,
  dragJoinParty,
  partyHeader,
  separateMember,
} from "../src/lib/pos/table-combine.ts";

function table(id: string, label: string): Table {
  return {
    id,
    label,
    section: "Dining",
    seats: 4,
    x: 10,
    y: 10,
    w: 12,
    h: 12,
    shape: "rect",
    status: "sat_no_order",
  };
}

test("drag T3 onto T1 makes one party and leaves T1-01 alone", () => {
  const t1 = table("t1", "1");
  const t3 = table("t3", "3");
  const check = {
    id: "c1",
    number: "T1-01",
    status: "open",
    tableId: "t1",
    lines: [{ id: "soup", name: "Soup", sent: true, voided: false }],
  };
  const joined = dragJoinParty({
    tables: [t1, t3],
    orders: [check],
    dragId: "t3",
    ontoId: "t1",
  });
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  const primary = joined.tables.find((t) => t.id === "t1");
  const child = joined.tables.find((t) => t.id === "t3");
  assert.deepEqual(primary?.mergedChildIds, ["t3"]);
  assert.equal(child?.mergedIntoId, "t1");
  assert.equal(joined.orders[0]?.number, "T1-01");
  assert.equal(joined.orders[0]?.tableId, "t1");
  assert.equal(joined.orders[0]?.lines.length, 1);
  assert.equal(partyHeader(joined.tables, "t1"), "T1 + T3");
  const marks = clusterNumbers(joined.tables, "t1");
  assert.equal(marks.primary, "1");
  assert.deepEqual(marks.joined, ["3"]);
  const split = separateMember({
    tables: joined.tables,
    orders: joined.orders,
    primaryId: "t1",
    removeId: "t3",
  });
  assert.equal(split.ok, true);
  if (!split.ok) return;
  assert.equal(split.tables.find((t) => t.id === "t3")?.mergedIntoId, undefined);
  assert.equal(split.tables.find((t) => t.id === "t1")?.mergedChildIds, undefined);
  assert.equal(split.orders[0]?.number, "T1-01");
  assert.equal(split.orders[0]?.tableId, "t1");
  assert.equal(split.orders[0]?.lines[0]?.name, "Soup");
  assert.equal(split.tables.find((t) => t.id === "t3")?.status, "empty");
});

test("a joined table with an open check cannot leave until the check moves", () => {
  const t1 = table("t1", "1");
  const t3 = table("t3", "3");
  const joined = dragJoinParty({
    tables: [t1, t3],
    orders: [{ id: "c3", number: "T3-01", status: "open", tableId: "t3", lines: [{ name: "Wine" }] }],
    dragId: "t3",
    ontoId: "t1",
  });
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  const blocked = separateMember({
    tables: joined.tables,
    orders: joined.orders,
    primaryId: "t1",
    removeId: "t3",
  });
  assert.equal(blocked.ok, false);
  const moved = separateMember({
    tables: joined.tables,
    orders: joined.orders,
    primaryId: "t1",
    removeId: "t3",
    transferToId: "t1",
  });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.equal(moved.orders[0]?.number, "T3-01");
  assert.equal(moved.orders[0]?.tableId, "t1");
  assert.equal(moved.orders[0]?.lines.length, 1);
});

test("combine is open to clocked-in floor roles unless the venue requires a manager", () => {
  assert.equal(canCombineTables({ role: "server", clockedIn: true }).ok, true);
  assert.equal(canCombineTables({ role: "host", clockedIn: true }).ok, true);
  assert.equal(canCombineTables({ role: "bartender", clockedIn: true }).ok, true);
  assert.equal(canCombineTables({ role: "kitchen", clockedIn: true }).ok, false);
  assert.equal(canCombineTables({ role: "server", clockedIn: false }).ok, false);
  assert.equal(
    canCombineTables({ role: "server", clockedIn: true, combineRequiresManager: true }).ok,
    false,
  );
  assert.equal(
    canCombineTables({
      role: "server",
      clockedIn: true,
      combineRequiresManager: true,
      managerPinOk: true,
    }).ok,
    true,
  );
});

test("floor sheet offers separate and the map draws joined numbers", () => {
  const floor = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  const map = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  assert.match(floor, /Move checks to primary/);
  assert.match(floor, /data-separate-sheet/);
  assert.match(floor, /Separate all/);
  assert.match(map, /onCombine/);
  assert.match(art, /data-floor-joined/);
  assert.match(art, /data-no-chairs/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /Move checks to primary/);
  assert.match(guide, /Combine requires manager/);
});
