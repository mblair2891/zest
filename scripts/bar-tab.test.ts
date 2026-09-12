import test from "node:test";
import assert from "node:assert/strict";
import {
  barTabVisibleTables,
  canOpenBarTabOnStool,
  canSeeAllBarSections,
  isBarRailSeat,
} from "../src/lib/pos/bar-tab.ts";
import type { Employee, FloorSection, Table } from "../src/lib/pos/types.ts";

const sections: FloorSection[] = [
  { id: "sec_dining", name: "Dining", color: "sec-1", sort: 0 },
  { id: "sec_bar", name: "Bar", color: "sec-3", sort: 2 },
];

function stool(id: string, section: string): Table {
  return {
    id,
    label: id.toUpperCase(),
    section,
    seats: 1,
    x: 8,
    y: 80,
    w: 8,
    h: 8,
    shape: "bar",
    kind: "barstool",
    status: "empty",
  };
}

function table(id: string, section: string): Table {
  return {
    id,
    label: id.toUpperCase(),
    section,
    seats: 4,
    x: 10,
    y: 10,
    w: 12,
    h: 12,
    shape: "rect",
    kind: "table",
    status: "empty",
  };
}

function emp(role: Employee["role"], homes: string[]): Employee {
  return {
    id: "e1",
    name: "Pat",
    pin: "1111",
    role,
    color: "#000",
    clockedIn: true,
    tipsEarned: 0,
    salesTotal: 0,
    active: true,
    homeSectionIds: homes,
  };
}

test("bar rail seats are stools, not dining tables", () => {
  assert.equal(isBarRailSeat(stool("b1", "Bar")), true);
  assert.equal(isBarRailSeat(table("t1", "Dining")), false);
  assert.equal(isBarRailSeat({ ...table("t2", "Bar"), kind: "table", shape: "rect" }), true);
});

test("bartender and server may open a tab on a stool; kitchen may not", () => {
  assert.equal(canOpenBarTabOnStool("bartender"), true);
  assert.equal(canOpenBarTabOnStool("server"), true);
  assert.equal(canOpenBarTabOnStool("supervisor"), true);
  assert.equal(canOpenBarTabOnStool("kitchen"), false);
});

test("manager and supervisor see every bar section", () => {
  assert.equal(canSeeAllBarSections("manager"), true);
  assert.equal(canSeeAllBarSections("supervisor"), true);
  assert.equal(canSeeAllBarSections("host"), true);
  assert.equal(canSeeAllBarSections("bartender"), false);
  const all = [stool("b1", "Bar"), stool("b2", "Dining")];
  const mgr = barTabVisibleTables({
    tables: all,
    emp: emp("manager", ["sec_bar"]),
    sections,
  });
  assert.equal(mgr.length, 2);
});

test("bartender PIN only sees assigned-section stools", () => {
  const tables = [stool("b1", "Bar"), stool("b2", "Dining"), table("t1", "Dining")];
  const list = barTabVisibleTables({
    tables,
    emp: emp("bartender", ["sec_bar"]),
    sections,
  });
  assert.deepEqual(
    list.map((t) => t.id),
    ["b1"],
  );
});
