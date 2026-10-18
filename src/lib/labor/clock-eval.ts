/**
 * Clock-in / clock-out windows and shift approval.
 * Leaf module (no @/ imports) so node:test can load it.
 */

export type ClockWindowAction = "block" | "flag";
export type ApprovalMode = "manual" | "auto_shift_end" | "auto_last_ticket";

export type ClockEval = {
  ok: boolean;
  error?: string;
  flags: string[];
  notify: string[];
  forceRequired?: boolean;
};

export type ShiftWindow = { id: string; start: number; end: number; published: boolean } | null;

export type ClockRules = {
  clockInEarlyMinutes: number;
  clockInLateMinutes: number;
  clockOutEarlyMinutes: number;
  clockOutLateMinutes: number;
  clockInEarlyAction: ClockWindowAction;
  clockInLateAction: ClockWindowAction;
  clockOutEarlyAction: ClockWindowAction;
  clockOutLateAction: ClockWindowAction;
  allowClockWithNoShift: boolean;
  requireOverrideForNoShift: boolean;
  managerOverride: boolean;
  approvalMode: ApprovalMode;
  approvalWindowMinutes: number;
  notifyEarlyClockIn: boolean;
  notifyLateClockIn: boolean;
  notifyEarlyClockOut: boolean;
  notifyLateClockOut: boolean;
  notifyNoScheduledShift: boolean;
};

export function clockInWindowBounds(
  shiftStart: number,
  rules: Pick<ClockRules, "clockInEarlyMinutes" | "clockInLateMinutes">,
): { open: number; close: number } {
  return {
    open: shiftStart - rules.clockInEarlyMinutes * 60_000,
    close: shiftStart + rules.clockInLateMinutes * 60_000,
  };
}

export function isInsideClockInWindow(
  now: number,
  shiftStart: number,
  rules: Pick<ClockRules, "clockInEarlyMinutes" | "clockInLateMinutes">,
): boolean {
  const { open, close } = clockInWindowBounds(shiftStart, rules);
  return now >= open && now <= close;
}

export const NO_SHIFT_BLOCKED = "No shift scheduled. Clock-in not allowed.";
export const NO_SHIFT_CONFIRM = "No shift scheduled. Clock in anyway?";

/** A published shift covers now from the early window through the end plus the late window. */
export function shiftCoversClockIn(
  now: number,
  shift: { start: number; end: number; published: boolean } | null,
  rules: Pick<ClockRules, "clockInEarlyMinutes" | "clockInLateMinutes">,
): boolean {
  if (!shift || !shift.published) return false;
  return (
    now >= shift.start - rules.clockInEarlyMinutes * 60_000 &&
    now <= shift.end + rules.clockInLateMinutes * 60_000
  );
}

export type ClockShiftPick<T> =
  | { kind: "covering"; shift: T }
  | { kind: "upcoming"; shift: T }
  | { kind: "none" };

/**
 * Covering shift wins. The next shift that has not opened yet stays on the early-window path.
 * A shift that already ended is not a covering shift.
 */
export function pickClockShift<T extends { start: number; end: number; published: boolean }>(
  now: number,
  shifts: T[],
  rules: Pick<ClockRules, "clockInEarlyMinutes" | "clockInLateMinutes">,
): ClockShiftPick<T> {
  const covering = shifts.find((shift) => shiftCoversClockIn(now, shift, rules));
  if (covering) return { kind: "covering", shift: covering };
  const earlyMs = rules.clockInEarlyMinutes * 60_000;
  const upcoming = shifts
    .filter((shift) => shift.published && now < shift.start - earlyMs)
    .sort((a, b) => a.start - b.start)[0];
  if (upcoming) return { kind: "upcoming", shift: upcoming };
  return { kind: "none" };
}

export type UnscheduledClockAction =
  | { action: "scheduled" }
  | { action: "block"; message: string }
  | { action: "confirm"; message: string }
  | { action: "allow"; message: "Unscheduled" };

/** Location On/Off when no shift covers now. A manager force does not change this. */
export function unscheduledClockGate(input: {
  hasCoveringShift: boolean;
  allowUnscheduled: boolean;
  confirmed: boolean;
}): UnscheduledClockAction {
  if (input.hasCoveringShift) return { action: "scheduled" };
  if (!input.allowUnscheduled) return { action: "block", message: NO_SHIFT_BLOCKED };
  if (!input.confirmed) return { action: "confirm", message: NO_SHIFT_CONFIRM };
  return { action: "allow", message: "Unscheduled" };
}

export function evaluateClockIn(
  now: number,
  shift: ShiftWindow,
  rules: ClockRules,
  force: boolean,
): ClockEval {
  const flags: string[] = [];
  const notify: string[] = [];
  if (!shift || !shift.published) {
    const noShift = "No scheduled shift";
    if (rules.notifyNoScheduledShift) notify.push(noShift);
    flags.push(noShift);
    if (rules.allowClockWithNoShift && !rules.requireOverrideForNoShift) {
      return { ok: true, flags, notify };
    }
    if (force && rules.managerOverride) {
      return { ok: true, flags: [...flags, "No published shift — manager override"], notify };
    }
    if (rules.requireOverrideForNoShift || !rules.allowClockWithNoShift) {
      return {
        ok: false,
        error: "No published shift — manager override required",
        flags,
        notify,
        forceRequired: rules.managerOverride,
      };
    }
  }
  if (!shift) return { ok: true, flags, notify };
  const { open: earlyOpen, close: lateClose } = clockInWindowBounds(shift.start, rules);
  if (now < earlyOpen) {
    const msg = `Too early — clock-in opens ${rules.clockInEarlyMinutes}m before shift`;
    if (rules.clockInEarlyAction === "block" && !(force && rules.managerOverride)) {
      return { ok: false, error: msg, flags, notify, forceRequired: rules.managerOverride };
    }
    flags.push(msg);
    if (rules.notifyEarlyClockIn) notify.push(msg);
  }
  if (now > lateClose) {
    const msg = `Late clock-in — more than ${rules.clockInLateMinutes}m after shift start`;
    if (rules.clockInLateAction === "block" && !(force && rules.managerOverride)) {
      return { ok: false, error: msg, flags, notify, forceRequired: rules.managerOverride };
    }
    flags.push(msg);
    if (rules.notifyLateClockIn) notify.push(msg);
  }
  return { ok: true, flags, notify };
}

export function evaluateClockOut(
  now: number,
  shift: ShiftWindow,
  lastTicketAt: number | undefined,
  rules: ClockRules,
  force: boolean,
): ClockEval & { autoApprove: boolean } {
  const flags: string[] = [];
  const notify: string[] = [];
  if (shift) {
    const earlyOpen = shift.end - rules.clockOutEarlyMinutes * 60_000;
    const lateClose = shift.end + rules.clockOutLateMinutes * 60_000;
    if (now < earlyOpen) {
      const msg = `Early clock-out — more than ${rules.clockOutEarlyMinutes}m before shift end`;
      if (rules.clockOutEarlyAction === "block" && !(force && rules.managerOverride)) {
        return { ok: false, error: msg, flags, notify, autoApprove: false, forceRequired: rules.managerOverride };
      }
      flags.push(msg);
      if (rules.notifyEarlyClockOut) notify.push(msg);
    }
    if (now > lateClose) {
      const msg = `Late clock-out — more than ${rules.clockOutLateMinutes}m after shift end`;
      if (rules.clockOutLateAction === "block" && !(force && rules.managerOverride)) {
        return { ok: false, error: msg, flags, notify, autoApprove: false, forceRequired: rules.managerOverride };
      }
      flags.push(msg);
      if (rules.notifyLateClockOut) notify.push(msg);
    }
  }
  let autoApprove = false;
  if (rules.approvalMode === "auto_shift_end" && shift) {
    const mins = Math.round(Math.abs(now - shift.end) / 60_000);
    autoApprove = mins <= rules.approvalWindowMinutes;
    if (!autoApprove) flags.push(`Clock-out ${mins}m from shift end (auto-approve window ${rules.approvalWindowMinutes}m)`);
  } else if (rules.approvalMode === "auto_last_ticket") {
    if (lastTicketAt) {
      const mins = Math.round(Math.abs(now - lastTicketAt) / 60_000);
      autoApprove = mins <= rules.approvalWindowMinutes;
      if (!autoApprove) {
        flags.push(`Clock-out ${mins}m after last closed ticket (window ${rules.approvalWindowMinutes}m)`);
      }
    } else {
      flags.push("No closed tickets on this shift — needs supervisor review");
    }
  }
  return { ok: true, flags, notify, autoApprove };
}
