import test from "node:test";
import assert from "node:assert/strict";
import {
  NO_SHIFT_BLOCKED,
  NO_SHIFT_CONFIRM,
  evaluateClockIn,
  pickClockShift,
  unscheduledClockGate,
  type ClockRules,
} from "../src/lib/labor/clock-eval.ts";
import { payrollCsv, type PayrollRow } from "../src/lib/labor/payroll.ts";
import { sumLaborCents } from "../src/lib/labor/staff-record.ts";

const rules = {
  clockInEarlyMinutes: 15,
  clockInLateMinutes: 10,
} as Pick<ClockRules, "clockInEarlyMinutes" | "clockInLateMinutes">;

const start = Date.parse("2026-10-18T16:00:00Z");
const shift = {
  id: "sh",
  start,
  end: start + 6 * 3600_000,
  published: true,
};

test("a shift that covers now clocks in on the scheduled path", () => {
  const now = start + 5 * 60_000;
  const picked = pickClockShift(now, [shift], rules);
  assert.equal(picked.kind, "covering");
  assert.equal(unscheduledClockGate({
    hasCoveringShift: true,
    allowUnscheduled: false,
    confirmed: false,
  }).action, "scheduled");
  assert.equal(unscheduledClockGate({
    hasCoveringShift: true,
    allowUnscheduled: true,
    confirmed: false,
  }).action, "scheduled");
});

test("setting off blocks a clock-in when no shift covers now", () => {
  const now = start + 12 * 3600_000;
  assert.equal(pickClockShift(now, [shift], rules).kind, "none");
  assert.equal(pickClockShift(now, [], rules).kind, "none");
  const gate = unscheduledClockGate({
    hasCoveringShift: false,
    allowUnscheduled: false,
    confirmed: true,
  });
  assert.equal(gate.action, "block");
  if (gate.action === "block") assert.equal(gate.message, NO_SHIFT_BLOCKED);
  assert.equal(gate.action === "block" && "forceRequired" in gate, false);
});

test("setting on asks before an unscheduled punch, and confirm allows it", () => {
  const pending = unscheduledClockGate({
    hasCoveringShift: false,
    allowUnscheduled: true,
    confirmed: false,
  });
  assert.equal(pending.action, "confirm");
  if (pending.action === "confirm") assert.equal(pending.message, NO_SHIFT_CONFIRM);
  const allowed = unscheduledClockGate({
    hasCoveringShift: false,
    allowUnscheduled: true,
    confirmed: true,
  });
  assert.deepEqual(allowed, { action: "allow", message: "Unscheduled" });
});

test("a later shift stays on the early window, and an ended shift does not cover now", () => {
  const early = pickClockShift(start - 2 * 3600_000, [shift], rules);
  assert.equal(early.kind, "upcoming");
  const ended = pickClockShift(shift.end + 2 * 3600_000, [shift], rules);
  assert.equal(ended.kind, "none");
  const window: ClockRules = {
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
    approvalMode: "manual",
    approvalWindowMinutes: 20,
    notifyEarlyClockIn: false,
    notifyLateClockIn: false,
    notifyEarlyClockOut: false,
    notifyLateClockOut: false,
    notifyNoScheduledShift: false,
  };
  const tooEarly = evaluateClockIn(start - 2 * 3600_000, shift, window, false);
  assert.equal(tooEarly.ok, false);
  assert.match(tooEarly.error ?? "", /Too early/);
  assert.equal(tooEarly.forceRequired, true);
  const onTime = evaluateClockIn(start, shift, window, false);
  assert.equal(onTime.ok, true);
});

test("the hours file flags an unscheduled punch and still counts the hours", () => {
  const row: PayrollRow = {
    employeeId: "e1",
    name: "Ada Lovelace",
    role: "server",
    operatorId: "food",
    operatorName: "Kitchen",
    regularHours: 8,
    otHours: 1,
    otFlag: true,
    otDaily: false,
    otWeekly: false,
    otSeventh: false,
    tipsCents: 0,
    salesCents: 0,
    punchCount: 1,
    employeeNumber: "E-14",
    firstName: "Ada",
    lastName: "Lovelace",
    payRateType: "hourly",
    payRateCents: 1800,
    unscheduled: true,
  };
  const csv = payrollCsv([row]);
  assert.match(csv, /punches,unscheduled/);
  assert.match(csv, /E-14,Ada,Lovelace,hourly,18\.00,9\.00,Kitchen,server/);
  assert.match(csv, /,Y$/m);
  assert.doesNotMatch(csv, /net pay|paycheck|tax/i);
  const labor = sumLaborCents(
    [
      { minutes: 60, unscheduled: true },
      { minutes: 60 },
    ],
    1500,
  );
  assert.equal(labor.cents, 3000);
  assert.equal(labor.minutes, 120);
  assert.equal(labor.unscheduledMinutes, 60);
});
