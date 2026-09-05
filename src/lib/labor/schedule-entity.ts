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
