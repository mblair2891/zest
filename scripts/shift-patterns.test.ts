import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { publishedShiftsForClock } from "../src/lib/labor/schedule-entity.ts";
import {
  formatPatternDays,
  formatShiftHm,
  placePatternShifts,
  rangeFromWeeks,
  rewritePlacedFromPattern,
  saveShiftPattern,
} from "../src/lib/labor/shift-patterns.ts";
import { addDays, sameDay, startOfWeek, weekDays } from "../src/lib/labor/week.ts";

test("Open saves with no staff, then two people land on next week as drafts", () => {
  const saved = saveShiftPattern({
    id: "pat_open",
    operatorId: "op_dining",
    name: "Open",
    days: [1, 2, 3, 4],
    startHm: "11:00",
    endHm: "19:00",
    role: "server",
    employeeIds: ["should-ignore"],
  });
  assert.ok(!("error" in saved));
  if ("error" in saved) return;
  assert.equal(formatPatternDays(saved.days), "Mon–Thu");
  assert.equal(formatShiftHm(saved.startHm), "11:00 AM");
  assert.equal(formatShiftHm(saved.endHm), "7:00 PM");
  assert.deepEqual(Object.keys(saved).sort(), [
    "days",
    "endHm",
    "id",
    "name",
    "operatorId",
    "role",
    "startHm",
  ]);
  const before = JSON.stringify(saved);

  const wednesday = new Date(2026, 9, 7);
  const nextSunday = addDays(startOfWeek(wednesday), 7);
  const range = rangeFromWeeks(nextSunday, 1);
  const placed = placePatternShifts({
    pattern: saved,
    employeeIds: ["a", "b", "outsider"],
    fromMs: range.fromMs,
    toMs: range.toMs,
    allowedEmployeeIds: ["a", "b"],
  });
  assert.deepEqual(placed.needsGrant, ["outsider"]);
  assert.equal(placed.drafts.length, 8);
  assert.ok(
    placed.drafts.every(
      (d) =>
        d.published === false &&
        d.patternId === "pat_open" &&
        d.role === "server" &&
        d.operatorId === "op_dining" &&
        d.end - d.start === 8 * 3_600_000,
    ),
  );
  const weekdays = new Set(placed.drafts.map((d) => new Date(d.start).getDay()));
  assert.deepEqual([...weekdays].sort(), [1, 2, 3, 4]);
  const grid = weekDays(nextSunday);
  const onGrid = placed.drafts.filter((d) => grid.some((day) => sameDay(d.start, day)));
  assert.equal(onGrid.length, 8);
  assert.equal(JSON.stringify(saved), before);

  const clock = publishedShiftsForClock({
    shifts: placed.drafts.map((d, i) => ({ ...d, id: `sh_${i}` })),
    employeeId: "a",
    homeOperatorId: "op_dining",
    now: addDays(nextSunday, 1) + 12 * 3_600_000,
    grants: [],
    clockOperatorId: "op_dining",
  });
  assert.equal(clock.length, 0);

  const kept = rewritePlacedFromPattern({ ...saved, endHm: "20:00" }, placed.drafts, false);
  assert.equal(kept[0]!.end - kept[0]!.start, 8 * 3_600_000);
  const rewritten = rewritePlacedFromPattern({ ...saved, endHm: "20:00" }, placed.drafts, true);
  assert.equal(rewritten[0]!.end - rewritten[0]!.start, 9 * 3_600_000);
  assert.equal(rewritten[0]!.employeeId, placed.drafts[0]!.employeeId);
  assert.equal(rewritten[0]!.published, false);

  const thursday = placed.drafts.find((d) => new Date(d.start).getDay() === 4)!;
  const narrower = rewritePlacedFromPattern(
    { ...saved, days: [1, 2, 3], endHm: "20:00" },
    placed.drafts,
    true,
  );
  const thursdayAfter = narrower.find(
    (d) => d.employeeId === thursday.employeeId && new Date(d.start).getDay() === 4,
  )!;
  assert.equal(thursdayAfter.end, thursday.end);

  const afterWeek = range.toMs;
  assert.ok(afterWeek > placed.drafts[placed.drafts.length - 1]!.end);
  assert.equal(JSON.stringify(saved), before);
  assert.equal("employeeIds" in saved, false);
});

test("set shifts is wired beside bulk add", () => {
  const schedule = readFileSync("src/components/pos/EntityScheduleView.tsx", "utf8");
  assert.match(schedule, /data-set-shifts/);
  assert.match(schedule, /data-pattern-save/);
  assert.match(schedule, /data-pattern-place/);
  assert.match(schedule, /data-pattern-update-placed/);
  assert.match(schedule, /data-pattern-empty/);
  assert.match(schedule, /placePatternShifts/);
  assert.match(schedule, /canPlaceEmployeeOnEntityBoard/);
  assert.match(schedule, /data-bulk-place/);
  assert.match(schedule, /bulkShiftDrafts/);
  assert.match(schedule, /No staff on this pattern/);
  const sql = readFileSync("migrations/0051_shift_patterns.sql", "utf8");
  assert.match(sql, /location_shift_patterns/);
  assert.match(sql, /pattern_id/);
  assert.doesNotMatch(sql, /employee_id/i);
});
