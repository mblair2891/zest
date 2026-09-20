/**
 * Regular vs OT minutes from owner-entered venue rules.
 * Export columns and red flags only — not a legal determination.
 */
type OtRules = {
  otDailyHours: number | null;
  otWeeklyHours: number | null;
  otSeventhDay: boolean;
  breakDeductMinutes: number;
};

export type OtFlag = "daily" | "weekly" | "seventh";

export type HoursSplit = {
  regularMinutes: number;
  otMinutes: number;
  flags: OtFlag[];
};

export function splitWorkedMinutes(opts: {
  workedMinutes: number;
  priorMinutesThisDay: number;
  priorMinutesThisWeek: number;
  consecutiveDaysWorked: number;
  rules: OtRules;
}): HoursSplit {
  let remaining = Math.max(0, Math.round(opts.workedMinutes));
  if (opts.rules.breakDeductMinutes) {
    remaining = Math.max(0, remaining - opts.rules.breakDeductMinutes);
  }
  const flags: OtFlag[] = [];
  let ot = 0;
  let regular = remaining;

  if (opts.rules.otSeventhDay && opts.consecutiveDaysWorked >= 6) {
    flags.push("seventh");
    ot = remaining;
    regular = 0;
    return { regularMinutes: regular, otMinutes: ot, flags };
  }

  const dailyCap =
    opts.rules.otDailyHours != null && opts.rules.otDailyHours > 0
      ? Math.round(opts.rules.otDailyHours * 60)
      : null;
  if (dailyCap != null) {
    const room = Math.max(0, dailyCap - opts.priorMinutesThisDay);
    if (regular > room) {
      const extra = regular - room;
      ot += extra;
      regular = room;
      flags.push("daily");
    }
  }

  const weeklyCap =
    opts.rules.otWeeklyHours != null && opts.rules.otWeeklyHours > 0
      ? Math.round(opts.rules.otWeeklyHours * 60)
      : null;
  if (weeklyCap != null) {
    const allowed = Math.max(0, weeklyCap - opts.priorMinutesThisWeek);
    if (regular > allowed) {
      ot += regular - allowed;
      regular = allowed;
      flags.push("weekly");
    }
  }

  return { regularMinutes: regular, otMinutes: ot, flags };
}

export function consecutiveDaysWorked(daysWithHours: number[]): number {
  if (!daysWithHours.length) return 0;
  const uniq = [...new Set(daysWithHours)].sort((a, b) => a - b);
  let streak = 1;
  for (let i = uniq.length - 1; i > 0; i--) {
    if (uniq[i] - uniq[i - 1] === 1) streak += 1;
    else break;
  }
  return streak;
}
