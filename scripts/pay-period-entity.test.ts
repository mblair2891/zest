import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  computePayPeriod,
  planPayPeriodChange,
  recordedInPeriod,
  type PayPeriodPolicy,
} from "../src/lib/labor/pay-period.ts";

function noon(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

function ymd(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function policy(partial: Partial<PayPeriodPolicy> = {}): PayPeriodPolicy {
  return {
    payPeriodType: "weekly",
    payPeriodStartWeekday: 0,
    payPeriodAnchorDate: "",
    payPeriodCustomDays: 14,
    payPeriodEndTime: "04:00",
    payPeriodStartDay: 1,
    payDateOffsetDays: 5,
    ...partial,
  };
}

const now = noon(2026, 10, 21);

test("two entities on the same day use different windows", () => {
  const weekly = computePayPeriod(now, policy({ payPeriodType: "weekly", payPeriodStartWeekday: 0 }));
  const monthly = computePayPeriod(now, policy({ payPeriodType: "monthly", payPeriodStartDay: 1 }));
  assert.notEqual(weekly.start, monthly.start);
  assert.equal(new Date(weekly.start).getDay(), 0);
  assert.equal(ymd(monthly.start), "2026-10-01");
  assert.ok(weekly.start <= now && now < weekly.end);
  assert.ok(monthly.start <= now && now < monthly.end);
});

test("semi-monthly default and monthly day 1 stay on the calendar split", () => {
  const semi = computePayPeriod(now, policy({ payPeriodType: "semimonthly", payPeriodStartDay: 1 }));
  assert.equal(ymd(semi.start), "2026-10-16");
  const month = computePayPeriod(now, policy({ payPeriodType: "monthly", payPeriodStartDay: 1 }));
  assert.equal(ymd(month.start), "2026-10-01");
  const nextMonth = new Date(month.end);
  assert.equal(nextMonth.getDate(), 1);
  assert.equal(nextMonth.getMonth(), 10);
});

test("period end snaps to 04:00 the morning after the last day", () => {
  const weekly = computePayPeriod(now, policy({ payPeriodType: "weekly", payPeriodEndTime: "04:00" }));
  const end = new Date(weekly.end);
  assert.equal(end.getHours(), 4);
  assert.equal(end.getMinutes(), 0);
  assert.ok(end.getTime() > now);
});

test("custom length counts from the anchor date", () => {
  const custom = computePayPeriod(
    noon(2026, 10, 25),
    policy({
      payPeriodType: "custom",
      payPeriodCustomDays: 10,
      payPeriodAnchorDate: "2026-10-01",
    }),
  );
  assert.equal(ymd(custom.start), "2026-10-21");
});

test("custom with no anchor uses the start weekday", () => {
  const custom = computePayPeriod(
    now,
    policy({ payPeriodType: "custom", payPeriodCustomDays: 7, payPeriodAnchorDate: "", payPeriodStartWeekday: 0 }),
  );
  assert.equal(new Date(custom.start).getDay(), 0);
  assert.notEqual(ymd(custom.start), ymd(now));
});

test("a mid-cycle change waits for the next period unless apply now", () => {
  const current = policy({ payPeriodType: "weekly", payPeriodStartWeekday: 0 });
  const next = policy({ payPeriodType: "monthly", payPeriodStartDay: 1 });
  const queued = planPayPeriodChange({ current, next, now, applyNow: false });
  assert.equal(queued.applied, "next");
  assert.equal(queued.policy.payPeriodType, "weekly");
  assert.equal(queued.pending?.payPeriodType, "monthly");
  assert.equal(queued.pendingAt, queued.open.end);
  assert.match(queued.warning ?? "", /open through/);
  assert.match(queued.warning ?? "", /apply now/);
  const still = computePayPeriod(now, queued.policy);
  assert.equal(still.start, queued.open.start);
  assert.equal(still.end, queued.open.end);

  const applied = planPayPeriodChange({ current, next, now, applyNow: true });
  assert.equal(applied.applied, "now");
  assert.equal(applied.pending, null);
  assert.equal(applied.pendingAt, 0);
  assert.equal(applied.warning, null);
  assert.equal(applied.policy.payPeriodType, "monthly");
  const opened = computePayPeriod(now, current);
  const moved = computePayPeriod(now, next);
  const punch = { payPeriodStart: opened.start, payPeriodEnd: opened.end, at: now };
  assert.equal(recordedInPeriod(punch, moved), false);
  assert.equal(recordedInPeriod(punch, opened), true);
});

test("the same policy and a pay-date-only edit apply now", () => {
  const current = policy({ payPeriodType: "weekly", payPeriodStartWeekday: 0 });
  const same = planPayPeriodChange({ current, next: { ...current }, now, applyNow: false });
  assert.equal(same.applied, "now");
  assert.equal(same.pending, null);
  assert.equal(same.warning, null);

  const offset = planPayPeriodChange({
    current,
    next: { ...current, payDateOffsetDays: 7 },
    now,
    applyNow: false,
  });
  assert.equal(offset.applied, "now");
  assert.equal(offset.warning, null);
  assert.equal(offset.open.start, computePayPeriod(now, current).start);
  assert.equal(offset.open.end, computePayPeriod(now, current).end);
});

test("an unstamped punch still falls in by its clock-in", () => {
  const window = computePayPeriod(now, policy());
  assert.equal(recordedInPeriod({ at: now }, window), true);
  assert.equal(recordedInPeriod({ at: window.start - 1 }, window), false);
});

test("Scheduling / Payroll documents Apply now", () => {
  const roles = readFileSync("src/lib/guide/content/roles.ts", "utf8");
  const hr = readFileSync("src/lib/guide/content/hr.ts", "utf8");
  const ui = readFileSync("src/components/pos/EntityPayPeriodSettings.tsx", "utf8");
  assert.match(roles, /Scheduling \/ Payroll/);
  assert.match(roles, /Apply now/);
  assert.match(hr, /Scheduling \/ Payroll/);
  assert.match(hr, /Apply now/);
  assert.match(ui, /Scheduling \/ Payroll/);
  assert.match(ui, /Save for next cycle/);
  assert.match(ui, /Apply now/);
  const migration = readFileSync("migrations/0063_entity_pay_period.sql", "utf8");
  assert.match(migration, /location_punches/);
  assert.match(migration, /location_shifts/);
  assert.match(migration, /pay_period_start/);
});
