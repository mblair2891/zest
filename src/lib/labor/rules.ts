/**
 * Entity labor rules: clock windows, shift approval, pay periods.
 * Summex exports hours; it does not process payroll.
 */

import {
  parseCcTipPayoutSetting,
  type CcTipPayoutSetting,
} from "@/lib/pos/cash-handling";

export type ClockWindowAction = "block" | "flag";
export type ApprovalMode = "manual" | "auto_shift_end" | "auto_last_ticket";
export type PayPeriodKind = "weekly" | "biweekly" | "semimonthly" | "custom";
export type PayrollSendMode = "automatic" | "automatic_after_review" | "manual";
export type AutoPayrollTrigger = "time_of_day" | "days_before_pay";
export type PayrollMode = "auto_export" | "manual";

export type EntityLaborRules = {
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
  punchRoundingMinutes: number;
  breakDeductMinutes: number;
  approvalMode: ApprovalMode;
  approvalWindowMinutes: number;
  notifyEarlyClockIn: boolean;
  notifyLateClockIn: boolean;
  notifyEarlyClockOut: boolean;
  notifyLateClockOut: boolean;
  dailyCloseoutTime: string;
  payPeriodType: PayPeriodKind;
  payPeriodStartWeekday: number;
  payPeriodAnchorDate: string;
  payPeriodCustomDays: number;
  payDateOffsetDays: number;
  autoPayroll: boolean;
  autoPayrollTrigger: AutoPayrollTrigger;
  autoPayrollTime: string;
  autoPayrollDaysBeforePay: number;
  requireAllApprovedToExport: boolean;
  sendMode: PayrollSendMode;
  notifyEmails: string;
  notifyRoles: string;
  payrollMode: PayrollMode;
  defaultSupervisorId: string;
  payrollProcessorId: string;
  /** Alias of !allowClockWithNoShift for older screens */
  requirePublishedShiftToClockIn: boolean;
  /** Alias of approvalWindowMinutes when last-ticket auto-approve is on */
  clockOutRedFlagMinutes: number;
  /** inherit = use location cash-handling ccTipPayout */
  ccTipPayout: CcTipPayoutSetting;
};

export const DEFAULT_LABOR_RULES: EntityLaborRules = {
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
  punchRoundingMinutes: 0,
  breakDeductMinutes: 0,
  approvalMode: "auto_last_ticket",
  approvalWindowMinutes: 20,
  notifyEarlyClockIn: true,
  notifyLateClockIn: true,
  notifyEarlyClockOut: true,
  notifyLateClockOut: true,
  dailyCloseoutTime: "04:00",
  payPeriodType: "biweekly",
  payPeriodStartWeekday: 0,
  payPeriodAnchorDate: "",
  payPeriodCustomDays: 14,
  payDateOffsetDays: 5,
  autoPayroll: false,
  autoPayrollTrigger: "days_before_pay",
  autoPayrollTime: "06:00",
  autoPayrollDaysBeforePay: 2,
  requireAllApprovedToExport: true,
  sendMode: "manual",
  notifyEmails: "",
  notifyRoles: "owner,manager,accountant",
  payrollMode: "manual",
  defaultSupervisorId: "",
  payrollProcessorId: "csv",
  requirePublishedShiftToClockIn: true,
  clockOutRedFlagMinutes: 20,
  ccTipPayout: "inherit",
};

function int(raw: unknown, fallback: number, min = 0, max = 10_080): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function action(raw: unknown, fallback: ClockWindowAction): ClockWindowAction {
  return raw === "block" || raw === "flag" ? raw : fallback;
}

function bool(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return fallback;
}

export function parseLaborRules(raw: unknown): EntityLaborRules {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_LABOR_RULES;
  const approvalMode: ApprovalMode =
    o.approvalMode === "manual" || o.approvalMode === "auto_shift_end" || o.approvalMode === "auto_last_ticket"
      ? o.approvalMode
      : d.approvalMode;
  const payPeriodType: PayPeriodKind =
    o.payPeriodType === "weekly" ||
    o.payPeriodType === "biweekly" ||
    o.payPeriodType === "semimonthly" ||
    o.payPeriodType === "custom" ||
    o.payPeriodType === "monthly"
      ? o.payPeriodType === "monthly"
        ? "custom"
        : o.payPeriodType
      : d.payPeriodType;
  const sendMode: PayrollSendMode =
    o.sendMode === "automatic" || o.sendMode === "automatic_after_review" || o.sendMode === "manual"
      ? o.sendMode
      : d.sendMode;
  const autoPayrollTrigger: AutoPayrollTrigger =
    o.autoPayrollTrigger === "time_of_day" || o.autoPayrollTrigger === "days_before_pay"
      ? o.autoPayrollTrigger
      : d.autoPayrollTrigger;
  const allowClockWithNoShift =
    "allowClockWithNoShift" in o
      ? bool(o.allowClockWithNoShift, d.allowClockWithNoShift)
      : !bool(o.requirePublishedShiftToClockIn, true);
  const approvalWindowMinutes = int(
    o.approvalWindowMinutes ?? o.clockOutRedFlagMinutes,
    d.approvalWindowMinutes,
    0,
    24 * 60,
  );
  const autoPayroll = "autoPayroll" in o ? bool(o.autoPayroll, false) : o.payrollMode === "auto_export";
  return {
    ...d,
    clockInEarlyMinutes: int(o.clockInEarlyMinutes, d.clockInEarlyMinutes, 0, 12 * 60),
    clockInLateMinutes: int(o.clockInLateMinutes, d.clockInLateMinutes, 0, 12 * 60),
    clockOutEarlyMinutes: int(o.clockOutEarlyMinutes, d.clockOutEarlyMinutes, 0, 12 * 60),
    clockOutLateMinutes: int(o.clockOutLateMinutes, d.clockOutLateMinutes, 0, 12 * 60),
    clockInEarlyAction: action(o.clockInEarlyAction, d.clockInEarlyAction),
    clockInLateAction: action(o.clockInLateAction, d.clockInLateAction),
    clockOutEarlyAction: action(o.clockOutEarlyAction, d.clockOutEarlyAction),
    clockOutLateAction: action(o.clockOutLateAction, d.clockOutLateAction),
    allowClockWithNoShift,
    requireOverrideForNoShift: bool(o.requireOverrideForNoShift, d.requireOverrideForNoShift),
    managerOverride: bool(o.managerOverride, d.managerOverride),
    punchRoundingMinutes: int(o.punchRoundingMinutes, 0, 0, 60),
    breakDeductMinutes: int(o.breakDeductMinutes, 0, 0, 240),
    approvalMode,
    approvalWindowMinutes,
    notifyEarlyClockIn: bool(o.notifyEarlyClockIn, d.notifyEarlyClockIn),
    notifyLateClockIn: bool(o.notifyLateClockIn, d.notifyLateClockIn),
    notifyEarlyClockOut: bool(o.notifyEarlyClockOut, d.notifyEarlyClockOut),
    notifyLateClockOut: bool(o.notifyLateClockOut, d.notifyLateClockOut),
    dailyCloseoutTime: String(o.dailyCloseoutTime ?? d.dailyCloseoutTime).slice(0, 8) || d.dailyCloseoutTime,
    payPeriodType,
    payPeriodStartWeekday: int(o.payPeriodStartWeekday ?? o.payPeriodEndDay, d.payPeriodStartWeekday, 0, 6),
    payPeriodAnchorDate: String(o.payPeriodAnchorDate ?? "").slice(0, 10),
    payPeriodCustomDays: int(o.payPeriodCustomDays, 14, 1, 62),
    payDateOffsetDays: int(o.payDateOffsetDays, d.payDateOffsetDays, 0, 45),
    autoPayroll,
    autoPayrollTrigger,
    autoPayrollTime: String(o.autoPayrollTime ?? d.autoPayrollTime).slice(0, 8) || d.autoPayrollTime,
    autoPayrollDaysBeforePay: int(o.autoPayrollDaysBeforePay, d.autoPayrollDaysBeforePay, 0, 14),
    requireAllApprovedToExport: bool(o.requireAllApprovedToExport, true),
    sendMode,
    notifyEmails: String(o.notifyEmails ?? "").slice(0, 400),
    notifyRoles: String(o.notifyRoles ?? d.notifyRoles).slice(0, 120),
    payrollMode: autoPayroll ? "auto_export" : "manual",
    defaultSupervisorId: String(o.defaultSupervisorId ?? "").slice(0, 80),
    payrollProcessorId: String(o.payrollProcessorId ?? "csv").slice(0, 40) || "csv",
    requirePublishedShiftToClockIn: !allowClockWithNoShift,
    clockOutRedFlagMinutes: approvalWindowMinutes,
    ccTipPayout: parseCcTipPayoutSetting(o.ccTipPayout),
  };
}

export function parseLaborMap(raw: unknown): Record<string, EntityLaborRules> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, EntityLaborRules> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k) continue;
    out[k] = parseLaborRules(v);
  }
  return out;
}

export function roundPunch(at: number, minutes: number): number {
  if (!minutes || minutes < 1) return at;
  const step = minutes * 60_000;
  return Math.round(at / step) * step;
}

export type ClockEval = {
  ok: boolean;
  error?: string;
  flags: string[];
  notify: string[];
  forceRequired?: boolean;
};

export type ShiftWindow = { id: string; start: number; end: number; published: boolean } | null;

export function evaluateClockIn(
  now: number,
  shift: ShiftWindow,
  rules: EntityLaborRules,
  force: boolean,
): ClockEval {
  const flags: string[] = [];
  const notify: string[] = [];
  if (!shift || !shift.published) {
    if (rules.allowClockWithNoShift && !rules.requireOverrideForNoShift) {
      return { ok: true, flags: ["No published shift"], notify };
    }
    if (force && rules.managerOverride) {
      return { ok: true, flags: ["No published shift — manager override"], notify };
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
  const earlyOpen = shift.start - rules.clockInEarlyMinutes * 60_000;
  const lateClose = shift.start + rules.clockInLateMinutes * 60_000;
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
  rules: EntityLaborRules,
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

export function applyBreakDeduct(regularMinutes: number, rules: EntityLaborRules): number {
  if (!rules.breakDeductMinutes) return regularMinutes;
  return Math.max(0, regularMinutes - rules.breakDeductMinutes);
}

function startOfLocalDay(ms: number): number {
  const x = new Date(ms);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(":").map((n) => Number(n));
  return { h: Number.isFinite(h) ? h : 6, m: Number.isFinite(m) ? m : 0 };
}

export type PayPeriodWindow = {
  start: number;
  end: number;
  payDate: number;
  startIso: string;
  endIso: string;
  payDateIso: string;
};

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function computePayPeriod(now: number, rules: EntityLaborRules): PayPeriodWindow {
  const day = startOfLocalDay(now);
  let start = day;
  let end = day + 7 * 86_400_000 - 1;
  if (rules.payPeriodType === "weekly") {
    const wd = new Date(day).getDay();
    const back = (wd - rules.payPeriodStartWeekday + 7) % 7;
    start = day - back * 86_400_000;
    end = start + 7 * 86_400_000 - 1;
  } else if (rules.payPeriodType === "biweekly") {
    const anchor = rules.payPeriodAnchorDate
      ? startOfLocalDay(Date.parse(rules.payPeriodAnchorDate + "T00:00:00"))
      : (() => {
          const wd = new Date(day).getDay();
          const back = (wd - rules.payPeriodStartWeekday + 7) % 7;
          return day - back * 86_400_000;
        })();
    const span = 14 * 86_400_000;
    const n = Math.floor((day - anchor) / span);
    start = anchor + n * span;
    end = start + span - 1;
  } else if (rules.payPeriodType === "semimonthly") {
    const d = new Date(day);
    if (d.getDate() <= 15) {
      start = startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
      end = startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), 16).getTime()) - 1;
    } else {
      start = startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), 16).getTime());
      end = startOfLocalDay(new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()) - 1;
    }
  } else {
    const days = rules.payPeriodCustomDays || 14;
    const anchor = rules.payPeriodAnchorDate
      ? startOfLocalDay(Date.parse(rules.payPeriodAnchorDate + "T00:00:00"))
      : day;
    const span = days * 86_400_000;
    const n = Number.isFinite(anchor) ? Math.floor((day - anchor) / span) : 0;
    start = (Number.isFinite(anchor) ? anchor : day) + n * span;
    end = start + span - 1;
  }
  const payDate = startOfLocalDay(end + 1) + rules.payDateOffsetDays * 86_400_000;
  return { start, end, payDate, startIso: iso(start), endIso: iso(end), payDateIso: iso(payDate) };
}

export function autoExportDueAt(period: PayPeriodWindow, rules: EntityLaborRules): number {
  const { h, m } = parseHm(rules.autoPayrollTime);
  if (rules.autoPayrollTrigger === "days_before_pay") {
    const d = startOfLocalDay(period.payDate - rules.autoPayrollDaysBeforePay * 86_400_000);
    const t = new Date(d);
    t.setHours(h, m, 0, 0);
    return t.getTime();
  }
  const t = new Date(startOfLocalDay(period.end + 1));
  t.setHours(h, m, 0, 0);
  return t.getTime();
}

export type HoursExportStatus =
  | "open"
  | "pending_approval"
  | "ready"
  | "download_ready"
  | "sent"
  | "held";

export function hoursExportStatus(opts: {
  now: number;
  period: PayPeriodWindow;
  rules: EntityLaborRules;
  pendingReview: number;
  alreadySent: boolean;
  providerConnected: boolean;
}): { status: HoursExportStatus; label: string; dueAt: number } {
  const dueAt = autoExportDueAt(opts.period, opts.rules);
  if (opts.alreadySent) return { status: "sent", label: "Sent to provider", dueAt };
  if (opts.now < opts.period.end) return { status: "open", label: "Period still open", dueAt };
  if (opts.rules.requireAllApprovedToExport && opts.pendingReview > 0) {
    return { status: "pending_approval", label: `${opts.pendingReview} shift(s) need approval`, dueAt };
  }
  if (!opts.rules.autoPayroll || opts.rules.sendMode === "manual") {
    return { status: "download_ready", label: "Download hours file", dueAt };
  }
  if (opts.rules.sendMode === "automatic_after_review") {
    return { status: "ready", label: "Ready — send after review", dueAt };
  }
  if (opts.providerConnected) return { status: "ready", label: "Ready to send", dueAt };
  return { status: "download_ready", label: "No provider — download and notify", dueAt };
}

export function parseNotifyEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    .slice(0, 12);
}
