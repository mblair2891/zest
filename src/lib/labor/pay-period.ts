/**
 * Pay-period windows for one selling entity.
 * A queued change does not move the open cycle.
 * Recorded punches and shifts keep the window they were stamped with.
 */

export type PayPeriodKind = "weekly" | "biweekly" | "semimonthly" | "monthly" | "custom";

export type PayPeriodPolicy = {
  payPeriodType: PayPeriodKind;
  /** 0 = Sunday … 6 = Saturday. Weekly, and biweekly/custom when no anchor date. */
  payPeriodStartWeekday: number;
  /** YYYY-MM-DD. Biweekly and custom. */
  payPeriodAnchorDate: string;
  /** Custom length in days (1–62). */
  payPeriodCustomDays: number;
  /** HH:mm venue-local close. The window ends the morning after the last day. */
  payPeriodEndTime: string;
  /**
   * Day of month (1–28). Monthly start day.
   * Semi-monthly: first half starts on this day (1–15). 1 keeps the 1–15 / 16–end split.
   */
  payPeriodStartDay: number;
  payDateOffsetDays: number;
};

export type PayPeriodWindow = {
  start: number;
  end: number;
  payDate: number;
  startIso: string;
  endIso: string;
  payDateIso: string;
};

export type PayPeriodChange = {
  policy: PayPeriodPolicy;
  pending: PayPeriodPolicy | null;
  /** Epoch ms when `pending` becomes the live policy. 0 when nothing is queued. */
  pendingAt: number;
  applied: "now" | "next";
  warning: string | null;
  open: PayPeriodWindow;
};

const DAY = 86_400_000;

function startOfLocalDay(ms: number): number {
  const x = new Date(ms);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(":").map((n) => Number(n));
  return { h: Number.isFinite(h) ? h : 4, m: Number.isFinite(m) ? m : 0 };
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function localDate(year: number, month: number, day: number): number {
  return startOfLocalDay(new Date(year, month, day).getTime());
}

function snapEnd(end: number, endTime: string): number {
  const { h, m } = parseHm(endTime || "04:00");
  const morningAfter = startOfLocalDay(end + 1);
  const close = new Date(morningAfter);
  close.setHours(h, m, 0, 0);
  return close.getTime();
}

function weekdayBack(day: number, startWeekday: number): number {
  const wd = new Date(day).getDay();
  const back = (wd - startWeekday + 7) % 7;
  return day - back * DAY;
}

function semimonthlyBounds(day: number, startDay: number): { start: number; end: number } {
  const origin = clamp(startDay || 1, 1, 15);
  const second = origin + 15;
  const d = new Date(day);
  const date = d.getDate();
  const y = d.getFullYear();
  const m = d.getMonth();
  if (date >= origin && date < second) {
    return { start: localDate(y, m, origin), end: localDate(y, m, second) - 1 };
  }
  if (date >= second) {
    return { start: localDate(y, m, second), end: localDate(y, m + 1, origin) - 1 };
  }
  return { start: localDate(y, m - 1, second), end: localDate(y, m, origin) - 1 };
}

function monthlyBounds(day: number, startDay: number): { start: number; end: number } {
  const origin = clamp(startDay || 1, 1, 28);
  const d = new Date(day);
  let y = d.getFullYear();
  let m = d.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  if (d.getDate() < Math.min(origin, dim)) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  const dimStart = new Date(y, m + 1, 0).getDate();
  const start = localDate(y, m, Math.min(origin, dimStart));
  const next = m + 1;
  const ny = y + (next > 11 ? 1 : 0);
  const nm = next % 12;
  const dimNext = new Date(ny, nm + 1, 0).getDate();
  const end = localDate(ny, nm, Math.min(origin, dimNext)) - 1;
  return { start, end };
}

export function computePayPeriod(now: number, policy: PayPeriodPolicy): PayPeriodWindow {
  const day = startOfLocalDay(now);
  let start = day;
  let end = day + 7 * DAY - 1;
  if (policy.payPeriodType === "weekly") {
    start = weekdayBack(day, policy.payPeriodStartWeekday);
    end = start + 7 * DAY - 1;
  } else if (policy.payPeriodType === "biweekly") {
    const anchor = policy.payPeriodAnchorDate
      ? startOfLocalDay(Date.parse(`${policy.payPeriodAnchorDate}T00:00:00`))
      : weekdayBack(day, policy.payPeriodStartWeekday);
    const span = 14 * DAY;
    const base = Number.isFinite(anchor) ? anchor : weekdayBack(day, policy.payPeriodStartWeekday);
    const n = Math.floor((day - base) / span);
    start = base + n * span;
    end = start + span - 1;
  } else if (policy.payPeriodType === "semimonthly") {
    const bounds = semimonthlyBounds(day, policy.payPeriodStartDay || 1);
    start = bounds.start;
    end = bounds.end;
  } else if (policy.payPeriodType === "monthly") {
    const bounds = monthlyBounds(day, policy.payPeriodStartDay || 1);
    start = bounds.start;
    end = bounds.end;
  } else {
    const days = policy.payPeriodCustomDays || 14;
    let anchor = policy.payPeriodAnchorDate
      ? startOfLocalDay(Date.parse(`${policy.payPeriodAnchorDate}T00:00:00`))
      : Number.NaN;
    if (!Number.isFinite(anchor)) anchor = weekdayBack(day, policy.payPeriodStartWeekday);
    const span = days * DAY;
    const n = Math.floor((day - anchor) / span);
    start = anchor + n * span;
    end = start + span - 1;
  }
  end = snapEnd(end, policy.payPeriodEndTime || "04:00");
  const payDate = startOfLocalDay(end) + (policy.payDateOffsetDays || 0) * DAY;
  return { start, end, payDate, startIso: iso(start), endIso: iso(end), payDateIso: iso(payDate) };
}

export function samePayPeriodPolicy(a: PayPeriodPolicy, b: PayPeriodPolicy): boolean {
  return (
    a.payPeriodType === b.payPeriodType &&
    a.payPeriodStartWeekday === b.payPeriodStartWeekday &&
    a.payPeriodAnchorDate === b.payPeriodAnchorDate &&
    a.payPeriodCustomDays === b.payPeriodCustomDays &&
    a.payPeriodEndTime === b.payPeriodEndTime &&
    a.payPeriodStartDay === b.payPeriodStartDay &&
    a.payDateOffsetDays === b.payDateOffsetDays
  );
}

function localLabel(ms: number): string {
  const d = new Date(ms);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Mid-cycle: keep the open window and queue `next` at the open period's end.
 * Apply now writes `next` immediately. The caller stamps existing rows first.
 */
export function planPayPeriodChange(input: {
  current: PayPeriodPolicy;
  next: PayPeriodPolicy;
  now: number;
  applyNow: boolean;
}): PayPeriodChange {
  const open = computePayPeriod(input.now, input.current);
  if (samePayPeriodPolicy(input.current, input.next)) {
    return {
      policy: input.current,
      pending: null,
      pendingAt: 0,
      applied: "now",
      warning: null,
      open,
    };
  }
  const immediate = computePayPeriod(input.now, input.next);
  const movesOpenWindow = immediate.start !== open.start || immediate.end !== open.end;
  const midCycle = input.now >= open.start && input.now < open.end && movesOpenWindow;
  if (!midCycle || input.applyNow) {
    return {
      policy: input.next,
      pending: null,
      pendingAt: 0,
      applied: "now",
      warning: null,
      open,
    };
  }
  return {
    policy: input.current,
    pending: input.next,
    pendingAt: open.end,
    applied: "next",
    warning: `This pay period is open through ${localLabel(open.end)}. The new cycle starts on the next period unless you apply now.`,
    open,
  };
}

/** A stamped row stays on that window. An unstamped row falls in by its clock-in or shift start. */
export function recordedInPeriod(
  row: { payPeriodStart?: number | null; payPeriodEnd?: number | null; at?: number | null },
  window: { start: number; end: number },
): boolean {
  if (row.payPeriodStart != null && row.payPeriodEnd != null) {
    return row.payPeriodStart === window.start && row.payPeriodEnd === window.end;
  }
  const at = row.at ?? 0;
  return at >= window.start && at <= window.end;
}
