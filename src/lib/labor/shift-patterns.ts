/**
 * Named shift patterns. A pattern has no employees.
 * Place writes unpublished drafts. Update placed is opt-in.
 * No @/ value imports so node:test can load this file.
 */

export type ShiftPattern = {
  id: string;
  operatorId: string;
  name: string;
  /** 0 Sunday … 6 Saturday, unique and sorted. */
  days: number[];
  startHm: string;
  endHm: string;
  role: string;
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function parseHm(hm: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Saves the pattern fields only. Any employee list on the input is ignored. */
export function saveShiftPattern(input: {
  id: string;
  operatorId: string;
  name: string;
  days: number[];
  startHm: string;
  endHm: string;
  role: string;
  employeeIds?: string[];
}): ShiftPattern | { error: string } {
  const id = input.id.trim();
  const operatorId = input.operatorId.trim();
  const name = input.name.trim().slice(0, 40);
  const role = input.role.trim();
  const start = parseHm(input.startHm);
  const end = parseHm(input.endHm);
  if (!id || !name) return { error: "Name the pattern." };
  if (!operatorId) return { error: "Pick an entity." };
  if (!role) return { error: "Pick a role." };
  if (!start || !end) return { error: "Use a start and an end." };
  const days = [
    ...new Set(input.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  ].sort((a, b) => a - b);
  if (days.length === 0) return { error: "Pick at least one day." };
  void input.employeeIds;
  return {
    id,
    operatorId,
    name,
    days,
    startHm: `${pad2(start.h)}:${pad2(start.m)}`,
    endHm: `${pad2(end.h)}:${pad2(end.m)}`,
    role,
  };
}

/** Mon–Thu for a run of three or more. Pairs and gaps stay listed. */
export function formatPatternDays(days: number[]): string {
  const sorted = [...new Set(days.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  const groups: number[][] = [];
  for (const d of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1] === d - 1) last.push(d);
    else groups.push([d]);
  }
  return groups
    .map((g) => {
      const a = DAY_SHORT[g[0]!] ?? "";
      const b = DAY_SHORT[g[g.length - 1]!] ?? "";
      if (g.length >= 3) return `${a}–${b}`;
      if (g.length === 2) return `${a}, ${b}`;
      return a;
    })
    .join(", ");
}

/** Fixed 12-hour label. 11:00 → 11:00 AM. 19:00 → 7:00 PM. */
export function formatShiftHm(hm: string): string {
  const parsed = parseHm(hm);
  if (!parsed) return hm.trim();
  const hour12 = parsed.h % 12 === 0 ? 12 : parsed.h % 12;
  const suffix = parsed.h < 12 ? "AM" : "PM";
  return `${hour12}:${pad2(parsed.m)} ${suffix}`;
}

/** Inclusive week start through n weeks, exclusive end. Weeks clamp to 1–26. */
export function rangeFromWeeks(weekStart: number, weeks: number): { fromMs: number; toMs: number } {
  const n = Math.min(26, Math.max(1, Math.round(Number(weeks)) || 1));
  return { fromMs: weekStart, toMs: weekStart + n * 7 * 86_400_000 };
}

function localMidnights(fromMs: number, toMs: number): number[] {
  const out: number[] = [];
  const cursor = new Date(fromMs);
  cursor.setHours(0, 0, 0, 0);
  let t = cursor.getTime();
  if (t < fromMs) {
    cursor.setDate(cursor.getDate() + 1);
    t = cursor.getTime();
  }
  let n = 0;
  while (t < toMs && n < 400) {
    out.push(t);
    cursor.setDate(cursor.getDate() + 1);
    t = cursor.getTime();
    n += 1;
  }
  return out;
}

export function placePatternShifts(input: {
  pattern: ShiftPattern;
  employeeIds: string[];
  fromMs: number;
  toMs: number;
  /** null or omitted allows every id. Anyone else is returned in needsGrant and not drafted. */
  allowedEmployeeIds?: string[] | null;
}): {
  drafts: Array<{
    employeeId: string;
    operatorId: string;
    start: number;
    end: number;
    published: false;
    role: string;
    patternId: string;
  }>;
  needsGrant: string[];
} {
  const allowed = input.allowedEmployeeIds;
  const needsGrant: string[] = [];
  const people: string[] = [];
  for (const raw of input.employeeIds) {
    const id = raw.trim();
    if (!id) continue;
    if (allowed != null && !allowed.includes(id)) {
      if (!needsGrant.includes(id)) needsGrant.push(id);
      continue;
    }
    if (!people.includes(id)) people.push(id);
  }
  const startHm = parseHm(input.pattern.startHm) ?? { h: 11, m: 0 };
  const endHm = parseHm(input.pattern.endHm) ?? { h: 19, m: 0 };
  const daySet = new Set(input.pattern.days);
  const drafts: Array<{
    employeeId: string;
    operatorId: string;
    start: number;
    end: number;
    published: false;
    role: string;
    patternId: string;
  }> = [];
  for (const employeeId of people) {
    for (const day of localMidnights(input.fromMs, input.toMs)) {
      if (!daySet.has(new Date(day).getDay())) continue;
      const startAt = new Date(day);
      startAt.setHours(startHm.h, startHm.m, 0, 0);
      const endAt = new Date(day);
      endAt.setHours(endHm.h, endHm.m, 0, 0);
      const start = startAt.getTime();
      let end = endAt.getTime();
      if (end <= start) end = start + 8 * 3_600_000;
      drafts.push({
        employeeId,
        operatorId: input.pattern.operatorId,
        start,
        end,
        published: false,
        role: input.pattern.role,
        patternId: input.pattern.id,
      });
    }
  }
  return { drafts, needsGrant };
}

/**
 * Update placed rewrites hours and role on shifts from this pattern whose weekday is still in the pattern.
 * Published state and the employee stay. Shifts on a dropped day stay as they are.
 * updatePlaced false returns the same shifts.
 */
export function rewritePlacedFromPattern<
  T extends {
    patternId?: string;
    start: number;
    end: number;
    role?: string;
    published: boolean;
    employeeId: string;
  },
>(pattern: ShiftPattern, shifts: T[], updatePlaced: boolean): T[] {
  if (!updatePlaced) return shifts;
  const startHm = parseHm(pattern.startHm) ?? { h: 11, m: 0 };
  const endHm = parseHm(pattern.endHm) ?? { h: 19, m: 0 };
  const daySet = new Set(pattern.days);
  return shifts.map((s) => {
    if (s.patternId !== pattern.id) return s;
    if (!daySet.has(new Date(s.start).getDay())) return s;
    const startAt = new Date(s.start);
    startAt.setHours(startHm.h, startHm.m, 0, 0);
    const endAt = new Date(s.start);
    endAt.setHours(endHm.h, endHm.m, 0, 0);
    const start = startAt.getTime();
    let end = endAt.getTime();
    if (end <= start) end = start + 8 * 3_600_000;
    return { ...s, start, end, role: pattern.role, published: s.published, employeeId: s.employeeId };
  });
}
