/** Independent per-entity staff schedules. No merged calendar unless they opt in. */

export const HOST_SCOPE = "host";

export type ExtraEntityShiftGrant = {
  id: string;
  employeeId: string;
  homeOperatorId: string;
  workOperatorId: string;
  scope: "shift" | "standing";
  grantedById: string;
  grantedAt: number;
  reason?: string;
};

export function defaultScheduleEntity(opts: {
  managerOperatorId?: string | null;
  peerVenue: boolean;
  vendorIds: string[];
}): string {
  const home = String(opts.managerOperatorId ?? "").trim();
  if (home && home !== HOST_SCOPE) return home;
  if (opts.peerVenue) return opts.vendorIds[0] || HOST_SCOPE;
  if (home === HOST_SCOPE) return HOST_SCOPE;
  return opts.vendorIds[0] ? HOST_SCOPE : HOST_SCOPE;
}

export function scheduleEntityIds(opts: {
  peerVenue: boolean;
  vendorIds: string[];
}): string[] {
  if (opts.peerVenue) return [...opts.vendorIds];
  return [HOST_SCOPE, ...opts.vendorIds];
}

export function canPlaceEmployeeOnEntityBoard(opts: {
  homeOperatorId: string;
  boardOperatorId: string;
  employeeId: string;
  grants: Array<{ employeeId: string; workOperatorId: string }>;
}): boolean {
  const home = opts.homeOperatorId || HOST_SCOPE;
  const board = opts.boardOperatorId || HOST_SCOPE;
  if (home === board) return true;
  return opts.grants.some(
    (g) => g.employeeId === opts.employeeId && g.workOperatorId === board,
  );
}

export function hoursEntityForPunch(opts: {
  shiftOperatorId?: string | null;
  homeOperatorId?: string | null;
}): string {
  return String(opts.shiftOperatorId || opts.homeOperatorId || HOST_SCOPE);
}

/** Clock only sees published shifts for this employee on this entity (or a granted board). */
export function publishedShiftsForClock<T extends {
  employeeId: string;
  operatorId: string;
  published: boolean;
  start: number;
}>(opts: {
  shifts: T[];
  employeeId: string;
  homeOperatorId: string;
  now: number;
  grants: Array<{ employeeId: string; workOperatorId: string }>;
  /** Station / pad entity. Kitchen clock cannot take a bar shift. */
  clockOperatorId?: string | null;
}): T[] {
  const dayStart = new Date(opts.now);
  dayStart.setHours(0, 0, 0, 0);
  const from = dayStart.getTime();
  const to = from + 86_400_000;
  const clockOp = String(opts.clockOperatorId || "").trim();
  return opts.shifts.filter((s) => {
    if (!s.published) return false;
    if (s.employeeId !== opts.employeeId) return false;
    if (s.start < from || s.start >= to) return false;
    if (clockOp && s.operatorId !== clockOp) return false;
    if (s.operatorId === opts.homeOperatorId) return true;
    return opts.grants.some(
      (g) => g.employeeId === opts.employeeId && g.workOperatorId === s.operatorId,
    );
  });
}

/** Published shifts that ended (plus late-in grace) with no punch. */
export function missedPublishedShifts<T extends {
  id: string;
  employeeId: string;
  operatorId: string;
  start: number;
  end: number;
  published: boolean;
}>(opts: {
  shifts: T[];
  punches: Array<{ employeeId: string; shiftId?: string; clockInAt: number; status: string }>;
  now: number;
  graceMinutes: number;
}): T[] {
  const grace = Math.max(0, opts.graceMinutes) * 60_000;
  return opts.shifts.filter((s) => {
    if (!s.published) return false;
    if (opts.now < s.end + grace) return false;
    return !opts.punches.some(
      (p) =>
        p.employeeId === s.employeeId &&
        p.status !== "rejected" &&
        (p.shiftId === s.id ||
          (p.clockInAt >= s.start - 3 * 3_600_000 && p.clockInAt <= s.end + 3 * 3_600_000)),
    );
  });
}

export function copyWeekShifts<T extends { start: number; end: number; operatorId: string }>(
  shifts: T[],
  fromWeekStart: number,
  toWeekStart: number,
  operatorId: string,
): Array<T & { published: false }> {
  const fromEnd = fromWeekStart + 7 * 86_400_000;
  const delta = toWeekStart - fromWeekStart;
  return shifts
    .filter((s) => s.operatorId === operatorId && s.start >= fromWeekStart && s.start < fromEnd)
    .map((s) => ({
      ...s,
      start: s.start + delta,
      end: s.end + delta,
      published: false as const,
    }));
}

export function publishWeekShifts<T extends { start: number; operatorId: string; published: boolean }>(
  shifts: T[],
  weekStart: number,
  weekEnd: number,
  operatorId: string,
): T[] {
  return shifts.map((s) => {
    if (s.start < weekStart || s.start >= weekEnd) return s;
    if (s.operatorId !== operatorId) return s;
    return { ...s, published: true };
  });
}
