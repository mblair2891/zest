import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateClockOut, type ClockRules } from "../src/lib/labor/clock-eval.ts";
import {
  copyWeekShifts,
  missedPublishedShifts,
  publishedShiftsForClock,
} from "../src/lib/labor/schedule-entity.ts";
import { splitWorkedMinutes } from "../src/lib/labor/hours-split.ts";
import { payrollCsv, payrollPdf, type PayrollRow } from "../src/lib/labor/payroll.ts";

const clockRules = (patch: Partial<ClockRules> = {}): ClockRules => ({
  clockInEarlyMinutes: 15,
  clockInLateMinutes: 10,
  clockOutEarlyMinutes: 15,
  clockOutLateMinutes: 15,
  clockInEarlyAction: "block",
  clockInLateAction: "flag",
  clockOutEarlyAction: "flag",
  clockOutLateAction: "flag",
  allowClockWithNoShift: false,
  requireOverrideForNoShift: true,
  managerOverride: true,
  approvalMode: "auto_shift_end",
  approvalWindowMinutes: 5,
  notifyEarlyClockIn: true,
  notifyLateClockIn: true,
  notifyEarlyClockOut: true,
  notifyLateClockOut: true,
  notifyNoScheduledShift: true,
  ...patch,
});

const start = Date.parse("2026-09-14T17:00:00-07:00");
const barShift = {
  id: "sh_bar",
  employeeId: "emp_a",
  operatorId: "opr_bar",
  start,
  end: start + 8 * 3600_000,
  published: true,
};
const kitchenShift = {
  ...barShift,
  id: "sh_kit",
  operatorId: "opr_kitchen",
};

test("entity B clock cannot take entity A’s published bar shift", () => {
  const onBar = publishedShiftsForClock({
    shifts: [barShift],
    employeeId: "emp_a",
    homeOperatorId: "opr_bar",
    now: start,
    grants: [],
    clockOperatorId: "opr_bar",
  });
  assert.equal(onBar.length, 1);
  const onKitchen = publishedShiftsForClock({
    shifts: [barShift],
    employeeId: "emp_a",
    homeOperatorId: "opr_bar",
    now: start,
    grants: [],
    clockOperatorId: "opr_kitchen",
  });
  assert.equal(onKitchen.length, 0);
  const kitchenOwn = publishedShiftsForClock({
    shifts: [barShift, kitchenShift],
    employeeId: "emp_a",
    homeOperatorId: "opr_kitchen",
    now: start,
    grants: [],
    clockOperatorId: "opr_kitchen",
  });
  assert.equal(kitchenOwn.length, 1);
  assert.equal(kitchenOwn[0].id, "sh_kit");
});

test("unpublished drafts do not appear on the clock", () => {
  const draft = { ...barShift, published: false };
  const hits = publishedShiftsForClock({
    shifts: [draft],
    employeeId: "emp_a",
    homeOperatorId: "opr_bar",
    now: start,
    grants: [],
    clockOperatorId: "opr_bar",
  });
  assert.equal(hits.length, 0);
});

test("copy last week clones as unpublished drafts on that entity only", () => {
  const week = Date.parse("2026-09-13T00:00:00-07:00");
  const clones = copyWeekShifts(
    [barShift, kitchenShift],
    week,
    week + 7 * 86_400_000,
    "opr_bar",
  );
  assert.equal(clones.length, 1);
  assert.equal(clones[0].published, false);
  assert.equal(clones[0].operatorId, "opr_bar");
  assert.equal(clones[0].start, barShift.start + 7 * 86_400_000);
});

test("clock-out 4 minutes after end + auto_shift_end X=5 → auto-approved", () => {
  const ev = evaluateClockOut(
    barShift.end + 4 * 60_000,
    { id: barShift.id, start: barShift.start, end: barShift.end, published: true },
    undefined,
    clockRules({ approvalMode: "auto_shift_end", approvalWindowMinutes: 5, clockOutLateMinutes: 15 }),
    false,
  );
  assert.equal(ev.ok, true);
  assert.equal(ev.autoApprove, true);
});

test("clock-out 20 minutes late → exception + manager notify", () => {
  const ev = evaluateClockOut(
    barShift.end + 20 * 60_000,
    { id: barShift.id, start: barShift.start, end: barShift.end, published: true },
    undefined,
    clockRules({
      approvalMode: "auto_shift_end",
      approvalWindowMinutes: 5,
      clockOutLateMinutes: 15,
      notifyLateClockOut: true,
    }),
    false,
  );
  assert.equal(ev.ok, true);
  assert.equal(ev.autoApprove, false);
  assert.ok(ev.notify.some((n) => /Late clock-out/i.test(n)));
  assert.ok(ev.flags.length > 0);
});

test("pay-period end → downloadable hours file, no paycheck", () => {
  const rulesSrc = readFileSync("src/lib/labor/rules.ts", "utf8");
  assert.match(rulesSrc, /download_ready/);
  assert.match(rulesSrc, /payPeriodEndTime/);
  assert.match(rulesSrc, /does not process payroll/);
  const rows: PayrollRow[] = [
    {
      employeeId: "emp_a",
      name: "Alex",
      role: "bartender",
      operatorId: "opr_bar",
      operatorName: "Bar",
      regularHours: 8,
      otHours: 1,
      otFlag: true,
      otDaily: true,
      otWeekly: false,
      otSeventh: false,
      tipsCents: 0,
      salesCents: 0,
      punchCount: 1,
    },
  ];
  const csv = payrollCsv(rows);
  assert.match(csv, /regular_hours/);
  assert.match(csv, /ot_daily/);
  assert.doesNotMatch(csv, /net pay|paycheck|tax/i);
  const pdf = payrollPdf(rows);
  assert.equal(pdf.type, "application/pdf");
});

test("OT split uses venue daily / weekly / seventh-day flags — not a legal determination", () => {
  const daily = splitWorkedMinutes({
    workedMinutes: 9 * 60,
    priorMinutesThisDay: 0,
    priorMinutesThisWeek: 0,
    consecutiveDaysWorked: 1,
    rules: { otDailyHours: 8, otWeeklyHours: 40, otSeventhDay: false, breakDeductMinutes: 0 },
  });
  assert.equal(daily.regularMinutes, 8 * 60);
  assert.equal(daily.otMinutes, 60);
  assert.deepEqual(daily.flags, ["daily"]);
  const seventh = splitWorkedMinutes({
    workedMinutes: 4 * 60,
    priorMinutesThisDay: 0,
    priorMinutesThisWeek: 0,
    consecutiveDaysWorked: 6,
    rules: { otDailyHours: 8, otWeeklyHours: 40, otSeventhDay: true, breakDeductMinutes: 0 },
  });
  assert.equal(seventh.regularMinutes, 0);
  assert.equal(seventh.otMinutes, 4 * 60);
  assert.deepEqual(seventh.flags, ["seventh"]);
});

test("missed published shift with no punch is flagged after grace", () => {
  const missed = missedPublishedShifts({
    shifts: [barShift],
    punches: [],
    now: barShift.end + 20 * 60_000,
    graceMinutes: 10,
  });
  assert.equal(missed.length, 1);
  const stillOpen = missedPublishedShifts({
    shifts: [barShift],
    punches: [],
    now: barShift.end + 5 * 60_000,
    graceMinutes: 10,
  });
  assert.equal(stillOpen.length, 0);
});

test("PIN pad is Enter and Clock in and does not open order entry from a punch", () => {
  const pin = readFileSync("src/components/pos/EntityHome.tsx", "utf8");
  const pad = readFileSync("src/components/pos/PinKeypad.tsx", "utf8");
  assert.match(pin, /PIN signs you onto this station/);
  assert.match(pin, /punchClockByPin/);
  assert.doesNotMatch(pin, /\["clock_out", "Clock out"\]/);
  assert.doesNotMatch(pin, /Clock out · 4-digit PIN/);
  assert.match(pad, /data-pin-keys="12"/);
  assert.match(pad, /data-pin-key="enter"/);
  assert.match(pad, /data-pin-key="clock-in"/);
  assert.match(pad, /Clock in/);
  assert.doesNotMatch(pad, /Clock out/);
  const flow = readFileSync("src/components/pos/EndShiftFlow.tsx", "utf8");
  assert.match(flow, /punchOutAfterCloseout/);
  const punchOnly = readFileSync("src/components/pos/EndShiftPunch.tsx", "utf8");
  assert.match(punchOnly, /End shift/);
  assert.match(punchOnly, /punchOutAfterCloseout/);
  const clock = readFileSync("src/lib/pos/station-clock.ts", "utf8");
  assert.match(clock, /does not open order entry/);
  assert.doesNotMatch(clock, /setView/);
  assert.doesNotMatch(clock, /login\(/);
});
