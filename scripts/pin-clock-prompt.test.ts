import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_LABOR_RULES, isInsideClockInWindow } from "../src/lib/labor/rules.ts";
import { shouldPromptClockInAfterPin } from "../src/lib/labor/pin-clock-prompt.ts";

const start = Date.parse("2026-09-11T12:00:00-07:00");
const shift = {
  id: "sh_1",
  employeeId: "emp_srv",
  operatorId: "opr_food",
  start,
  end: start + 8 * 3600_000,
  published: true,
};

test("clock-in window is early minutes before start through late minutes after start", () => {
  const rules = { clockInEarlyMinutes: 15, clockInLateMinutes: 10 };
  assert.equal(isInsideClockInWindow(start - 15 * 60_000, start, rules), true);
  assert.equal(isInsideClockInWindow(start - 15 * 60_000 - 1, start, rules), false);
  assert.equal(isInsideClockInWindow(start + 10 * 60_000, start, rules), true);
  assert.equal(isInsideClockInWindow(start + 10 * 60_000 + 1, start, rules), false);
  assert.equal(isInsideClockInWindow(start, start, rules), true);
});

test("station PIN offers clock-in only inside the entity window while off the clock", () => {
  const inside = shouldPromptClockInAfterPin({
    stationPinSession: true,
    clockedIn: false,
    employeeId: "emp_srv",
    homeOperatorId: "opr_food",
    shifts: [shift],
    now: start,
  });
  assert.equal(inside.prompt, true);
  assert.equal(inside.shift?.id, "sh_1");
  assert.equal(inside.entityId, "opr_food");

  assert.equal(
    shouldPromptClockInAfterPin({
      stationPinSession: true,
      clockedIn: true,
      employeeId: "emp_srv",
      shifts: [shift],
      now: start,
    }).prompt,
    false,
  );
  assert.equal(
    shouldPromptClockInAfterPin({
      stationPinSession: false,
      clockedIn: false,
      employeeId: "emp_srv",
      shifts: [shift],
      now: start,
    }).prompt,
    false,
  );
});

test("outside the window: no prompt (Labor can still flag later)", () => {
  const tooEarly = shouldPromptClockInAfterPin({
    stationPinSession: true,
    clockedIn: false,
    employeeId: "emp_srv",
    shifts: [shift],
    now: start - 20 * 60_000,
  });
  assert.equal(tooEarly.prompt, false);
  const tooLate = shouldPromptClockInAfterPin({
    stationPinSession: true,
    clockedIn: false,
    employeeId: "emp_srv",
    shifts: [shift],
    now: start + 30 * 60_000,
  });
  assert.equal(tooLate.prompt, false);
});

test("no published shift today: no prompt", () => {
  assert.equal(
    shouldPromptClockInAfterPin({
      stationPinSession: true,
      clockedIn: false,
      employeeId: "emp_srv",
      shifts: [{ ...shift, published: false }],
      now: start,
    }).prompt,
    false,
  );
  assert.equal(
    shouldPromptClockInAfterPin({
      stationPinSession: true,
      clockedIn: false,
      employeeId: "emp_srv",
      shifts: [{ ...shift, start: start - 86400_000, end: start - 86400_000 + 8 * 3600_000 }],
      now: start,
    }).prompt,
    false,
  );
});

test("entity on the shift supplies that entity’s window", () => {
  const tight = shouldPromptClockInAfterPin({
    stationPinSession: true,
    clockedIn: false,
    employeeId: "emp_srv",
    homeOperatorId: "host",
    shifts: [shift],
    laborByEntity: {
      opr_food: { ...DEFAULT_LABOR_RULES, clockInEarlyMinutes: 5, clockInLateMinutes: 5 },
      host: { ...DEFAULT_LABOR_RULES, clockInEarlyMinutes: 60, clockInLateMinutes: 60 },
    },
    now: start - 10 * 60_000,
  });
  assert.equal(tight.prompt, false);
});

test("PIN pad does not punch; modal is station-only copy", () => {
  const pin = readFileSync("src/components/pos/EntityHome.tsx", "utf8");
  assert.match(pin, /PIN signs you onto this station/);
  const modal = readFileSync("src/components/pos/ClockInAfterPinDialog.tsx", "utf8");
  assert.match(modal, /Clock in for this shift\?/);
  assert.match(modal, /Clock in/);
  assert.match(modal, /Not now/);
  assert.doesNotMatch(modal, /\/login/);
});
