import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bulkShiftDrafts,
  entityLoginHeader,
  entityToday,
  menuGroups,
  venueYmd,
} from "../src/lib/saas/entity-owner.ts";
import {
  entityFloorEditorId,
  floorEditMode,
  floorEditScope,
  placeSectionName,
} from "../src/lib/pos/entity-floor.ts";

const DAY = "2026-10-02";
const at = (h: number, m = 0) => Date.UTC(2026, 9, 2, h, m);

test("entity login header is entity then venue", () => {
  assert.equal(entityLoginHeader("Bar", "Harbor"), "Bar · Harbor");
  assert.equal(entityLoginHeader("  Bar  ", " Harbor "), "Bar · Harbor");
  assert.equal(entityLoginHeader("", "Harbor"), "Harbor");
  assert.equal(entityLoginHeader("Bar", ""), "Bar");
});

test("today snapshot counts this entity’s lines only", () => {
  const snap = entityToday({
    entityId: "op_bar",
    dayYmd: DAY,
    todayYmd: DAY,
    timeZone: "UTC",
    wageCentsPerHour: 1500,
    orders: [
      {
        status: "closed",
        createdAt: at(15),
        lines: [
          {
            entityId: "op_bar",
            name: "Well vodka",
            menuItemId: "vodka",
            quantity: 2,
            unitPriceCents: 800,
            discountCents: 100,
            voided: false,
            comped: false,
            createdAt: at(15, 30),
          },
          {
            vendorId: "op_kitchen",
            name: "Burger",
            quantity: 1,
            unitPriceCents: 5000,
            createdAt: at(15, 30),
          },
          {
            entityId: "op_bar",
            name: "Comp martini",
            quantity: 1,
            unitPriceCents: 1400,
            comped: true,
            createdAt: at(16),
          },
          {
            entityId: "op_bar",
            name: "Void shot",
            quantity: 1,
            unitPriceCents: 700,
            voided: true,
            createdAt: at(16),
          },
        ],
      },
      {
        status: "open",
        createdAt: at(18),
        lines: [
          {
            entityId: "op_bar",
            name: "Rum",
            quantity: 1,
            unitPriceCents: 900,
            createdAt: at(18),
          },
        ],
      },
      {
        status: "open",
        createdAt: at(12),
        lines: [{ entityId: "op_kitchen", name: "Salad", quantity: 1, unitPriceCents: 1200, createdAt: at(12) }],
      },
    ],
    punches: [
      { operatorId: "op_bar", clockInAt: at(14), clockOutAt: at(16) },
      { operatorId: "op_kitchen", clockInAt: at(14), clockOutAt: at(22) },
    ],
    items: [
      { name: "Well vodka", vendorId: "op_bar", available: false },
      { name: "Old", vendorId: "op_bar", available: false, archived: true },
      { name: "Rum", entityId: "op_bar", available: true },
      { name: "Burger", vendorId: "op_kitchen", available: false },
    ],
  });
  assert.equal(venueYmd(at(15, 30), "UTC"), DAY);
  assert.equal(snap.salesCents, 1500 + 900);
  assert.equal(snap.hourlyCents[15], 1500);
  assert.equal(snap.hourlyCents[18], 900);
  assert.equal(snap.openChecks, 1);
  assert.equal(snap.laborMinutes, 120);
  assert.equal(snap.laborCents, 3000);
  assert.equal(snap.laborPct, 3000 / 2400);
  assert.equal(snap.topItems[0]?.name, "Well vodka");
  assert.equal(snap.eightySixCount, 1);
});

test("a past day does not count today’s still-open checks from another day", () => {
  const snap = entityToday({
    entityId: "op_bar",
    dayYmd: "2026-10-01",
    todayYmd: DAY,
    timeZone: "UTC",
    wageCentsPerHour: 0,
    orders: [
      {
        status: "open",
        createdAt: at(18),
        lines: [{ entityId: "op_bar", name: "Rum", quantity: 1, unitPriceCents: 900, createdAt: at(18) }],
      },
    ],
    punches: [],
    items: [],
  });
  assert.equal(snap.openChecks, 0);
  assert.equal(snap.salesCents, 0);
  assert.equal(snap.laborPct, null);
});

test("menu groups follow category and the active filter", () => {
  const items = [
    { categoryId: "well", name: "Vodka", archived: false },
    { categoryId: "rum", name: "Aged", archived: false },
    { categoryId: "well", name: "Old well", archived: true },
  ];
  const cats = [
    { id: "rum", name: "Rum", sort: 2 },
    { id: "well", name: "Well", sort: 1 },
    { id: "specialty", name: "Specialty", sort: 3 },
  ];
  const active = menuGroups(items, cats, { archived: false });
  assert.deepEqual(active.map((g) => g.name), ["Well", "Rum"]);
  const well = menuGroups(items, cats, { archived: false, categoryId: "well" });
  assert.deepEqual(well.map((g) => g.id), ["well"]);
  const archived = menuGroups(items, cats, { archived: true });
  assert.equal(archived[0]?.items.length, 1);
});

test("bulk add is one unpublished shift per person per day", () => {
  const monday = new Date(2026, 9, 5);
  monday.setHours(0, 0, 0, 0);
  const days = [0, 1, 2].map((n) => monday.getTime() + n * 86_400_000);
  const drafts = bulkShiftDrafts({
    employeeIds: ["a", "b"],
    dayStarts: days,
    startHm: "16:00",
    endHm: "23:00",
    role: "bartender",
    operatorId: "op_bar",
  });
  assert.equal(drafts.length, 6);
  assert.ok(drafts.every((d) => d.published === false && d.operatorId === "op_bar" && d.role === "bartender"));
  assert.equal(drafts[0]!.end - drafts[0]!.start, 7 * 3_600_000);
  const flipped = bulkShiftDrafts({
    employeeIds: ["a"],
    dayStarts: [monday.getTime()],
    startHm: "18:00",
    endHm: "10:00",
    role: "server",
    operatorId: "op_bar",
  });
  assert.equal(flipped[0]!.end - flipped[0]!.start, 8 * 3_600_000);
});

test("floor edit is this entity’s sections plus seating loans", () => {
  const sections = [
    { id: "sec_bar", name: "Bar", operatorId: "op_bar" },
    { id: "sec_kit", name: "Kitchen", operatorId: "op_kitchen" },
    { id: "sec_hall", name: "Hall" },
  ];
  const tables = [
    { id: "t1", section: "Bar", sectionId: "sec_bar" },
    { id: "t2", section: "Kitchen", sectionId: "sec_kit" },
    { id: "t3", section: "Hall", sectionId: "sec_hall" },
  ];
  const employees = [
    { id: "e_bar", operatorId: "op_bar" },
    { id: "e_kit", operatorId: "op_kitchen" },
  ];
  const scoped = floorEditScope({
    entityId: "op_bar",
    sections,
    tables,
    grants: [
      { employeeId: "e_bar", tableId: "t2", scope: "seating" },
      { employeeId: "e_bar", tableId: "t3", scope: "shift" },
      { employeeId: "e_kit", tableId: "t1", scope: "seating" },
    ],
    employees,
  });
  assert.equal(scoped.whole, false);
  assert.deepEqual(scoped.sectionIds, ["sec_bar"]);
  assert.ok(scoped.tableIds.includes("t1"));
  assert.ok(scoped.tableIds.includes("t2"));
  assert.ok(!scoped.tableIds.includes("t3"));
  const whole = floorEditScope({
    entityId: null,
    sections,
    tables,
    grants: [],
    employees,
  });
  assert.equal(whole.whole, true);
  assert.equal(whole.tableIds.length, 3);
  assert.equal(entityFloorEditorId({ role: "vendor_operator", operatorId: "op_bar" }, "backoffice"), "op_bar");
  assert.equal(entityFloorEditorId({ role: "bartender", operatorId: "op_bar" }, "pin"), null);
  assert.equal(entityFloorEditorId({ role: "owner", operatorId: null }, "backoffice"), null);
  assert.equal(floorEditMode({ role: "manager", operatorId: "op_bar" }, "backoffice"), "entity");
  assert.equal(floorEditMode({ role: "owner" }, "backoffice"), "whole");
  assert.equal(floorEditMode({ role: "bartender", operatorId: "op_bar" }, "pin"), "none");
  assert.equal(placeSectionName("Kitchen", sections, ["sec_bar"])?.name, "Bar");
  assert.equal(placeSectionName("All", sections, []) , null);
});

test("entity owner surfaces are wired", () => {
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /entityLoginHeader/);
  assert.match(venue, /EntityTodayHome/);
  assert.match(venue, /data-login-title/);
  assert.match(venue, /peopleOnly/);
  const menu = readFileSync("src/components/pos/MenuAdminView.tsx", "utf8");
  assert.match(menu, /data-menu-category-filter/);
  assert.match(menu, /data-item-sheet/);
  assert.match(menu, /data-menu-archive/);
  const staff = readFileSync("src/components/pos/OperatorOpsView.tsx", "utf8");
  assert.match(staff, /peopleOnly/);
  assert.match(staff, /data-staff-people/);
  const schedule = readFileSync("src/components/pos/EntityScheduleView.tsx", "utf8");
  assert.match(schedule, /data-bulk-place/);
  assert.match(schedule, /bulkShiftDrafts/);
  const floor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(floor, /floorEditScope/);
  assert.match(floor, /data-floor-entity-scope/);
  assert.match(floor, /data-section-entity/);
});
