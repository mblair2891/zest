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
