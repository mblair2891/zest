/**
 * Entity labor rules: clock windows, shift approval, pay periods.
 * Summex exports hours; it does not process payroll.
 */

import {
  parseCcTipPayoutSetting,
  type CcTipPayoutSetting,
} from "@/lib/pos/cash-handling";
import { parseTipPoolingSetting, type TipPoolingSetting } from "@/lib/pos/tip-pooling";
import { parseStaffingRecs, type StaffingRecsConfig } from "@/lib/ops-ai/staffing";
import {
  parseAllocationPct,
  parseCategoryIds,
  parseRevenueBasis,
  type RevenueBasis,
} from "./revenue-basis";

import { type PayPeriodKind, type PayPeriodPolicy, type PayPeriodWindow } from "./pay-period";

export type { PayPeriodKind, PayPeriodPolicy, PayPeriodWindow, PayPeriodChange } from "./pay-period";
export { computePayPeriod, planPayPeriodChange, recordedInPeriod, samePayPeriodPolicy } from "./pay-period";

export type ClockWindowAction = "block" | "flag";
export type ApprovalMode = "manual" | "auto_shift_end" | "auto_last_ticket";
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
  notifyMissedPunch: boolean;
  notifyNoScheduledShift: boolean;
  dailyCloseoutTime: string;
  /** Period ends at this HH:mm in the venue timezone (morning after last day). */
  payPeriodEndTime: string;
  payPeriodType: PayPeriodKind;
  payPeriodStartWeekday: number;
  payPeriodAnchorDate: string;
  payPeriodCustomDays: number;
  /** Monthly start day, or semi-monthly first-half start day (1 keeps 1–15 / 16–end). */
  payPeriodStartDay: number;
  /**
   * Queued cycle. Live fields stay in force until `payPeriodPendingAt`.
   * Null until a mid-cycle change is saved for the next period.
   */
  payPeriodPending: PayPeriodPolicy | null;
  /** Epoch ms when `payPeriodPending` becomes live. 0 when nothing is queued. */
  payPeriodPendingAt: number;
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
  /** inherit = use location cash-handling tipPooling */
  tipPooling: TipPoolingSetting;
  staffingRecs: StaffingRecsConfig;
  /** Sales this labor % / SPLH / recs run against. */
  revenueBasis: RevenueBasis;
  /** When revenueBasis is custom_categories. */
  revenueCategoryIds: string[];
  /**
   * Share of location shared venue costs (rent, utilities) in this entity’s labor $.
   * Null = off. Do not dump the same cost into every entity.
   */
  sharedCostAllocationPct: number | null;
  /** When true, include attributed tips in labor $. Default off. */
  tipsInLabor: boolean;
  /** Statutory wage floor in cents. Null = not set. Never auto-written by bulletins. */
  minWageCents: number | null;
  /** Daily OT threshold hours. Null = weekly only / not set. */
  otDailyHours: number | null;
  /** Weekly OT threshold hours. Null = not set. */
  otWeeklyHours: number | null;
  /** Seventh consecutive day → OT flag on export. Not a legal determination. */
  otSeventhDay: boolean;
  /** Tip credit against min wage, cents. Null = none. */
  tipCreditCents: number | null;
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
  notifyMissedPunch: true,
  notifyNoScheduledShift: true,
  dailyCloseoutTime: "04:00",
  payPeriodEndTime: "04:00",
  payPeriodType: "biweekly",
  payPeriodStartWeekday: 0,
  payPeriodAnchorDate: "",
  payPeriodCustomDays: 14,
  payPeriodStartDay: 1,
  payPeriodPending: null,
  payPeriodPendingAt: 0,
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
  tipPooling: "inherit",
  staffingRecs: parseStaffingRecs(undefined),
  revenueBasis: "all_check",
  revenueCategoryIds: [],
  sharedCostAllocationPct: null,
  tipsInLabor: false,
  minWageCents: null,
  otDailyHours: null,
  otWeeklyHours: 40,
  otSeventhDay: false,
  tipCreditCents: null,
};

const PAY_PERIOD_KINDS: readonly PayPeriodKind[] = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "custom",
];

function pendingAtMs(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

function parsePayPeriodPending(raw: unknown): PayPeriodPolicy | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = o.payPeriodType;
  if (!PAY_PERIOD_KINDS.includes(kind as PayPeriodKind)) return null;
  return {
    payPeriodType: kind as PayPeriodKind,
    payPeriodStartWeekday: int(o.payPeriodStartWeekday, 0, 0, 6),
    payPeriodAnchorDate: String(o.payPeriodAnchorDate ?? "").slice(0, 10),
    payPeriodCustomDays: int(o.payPeriodCustomDays, 14, 1, 62),
    payPeriodEndTime: String(o.payPeriodEndTime ?? "04:00").slice(0, 8) || "04:00",
    payPeriodStartDay: int(o.payPeriodStartDay, 1, 1, 28),
    payDateOffsetDays: int(o.payDateOffsetDays, 5, 0, 45),
  };
}

export function payPeriodPolicyOf(rules: EntityLaborRules): PayPeriodPolicy {
  return {
    payPeriodType: rules.payPeriodType,
    payPeriodStartWeekday: rules.payPeriodStartWeekday,
    payPeriodAnchorDate: rules.payPeriodAnchorDate,
    payPeriodCustomDays: rules.payPeriodCustomDays,
    payPeriodEndTime: rules.payPeriodEndTime,
    payPeriodStartDay: rules.payPeriodStartDay,
    payDateOffsetDays: rules.payDateOffsetDays,
  };
}

/** Live policy until `payPeriodPendingAt`, then the queued cycle. */
export function laborRulesAt(rules: EntityLaborRules, now: number): EntityLaborRules {
  if (!rules.payPeriodPending || !rules.payPeriodPendingAt || now < rules.payPeriodPendingAt) {
    return rules;
  }
  return parseLaborRules({
    ...rules,
    ...rules.payPeriodPending,
    payPeriodPending: null,
    payPeriodPendingAt: 0,
  });
}

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
    o.payPeriodType === "monthly" ||
    o.payPeriodType === "custom"
      ? o.payPeriodType
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
    notifyMissedPunch: bool(o.notifyMissedPunch, d.notifyMissedPunch),
    notifyNoScheduledShift: bool(o.notifyNoScheduledShift, d.notifyNoScheduledShift),
    dailyCloseoutTime: String(o.dailyCloseoutTime ?? d.dailyCloseoutTime).slice(0, 8) || d.dailyCloseoutTime,
    payPeriodEndTime:
      String(o.payPeriodEndTime ?? o.dailyCloseoutTime ?? d.payPeriodEndTime).slice(0, 8) ||
      d.payPeriodEndTime,
    payPeriodType,
    payPeriodStartWeekday: int(o.payPeriodStartWeekday ?? o.payPeriodEndDay, d.payPeriodStartWeekday, 0, 6),
    payPeriodAnchorDate: String(o.payPeriodAnchorDate ?? "").slice(0, 10),
    payPeriodCustomDays: int(o.payPeriodCustomDays, 14, 1, 62),
    payPeriodStartDay: int(o.payPeriodStartDay, d.payPeriodStartDay, 1, 28),
    payPeriodPending: parsePayPeriodPending(o.payPeriodPending),
    payPeriodPendingAt: pendingAtMs(o.payPeriodPendingAt),
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
    tipPooling: parseTipPoolingSetting(o.tipPooling),
    staffingRecs: parseStaffingRecs(o.staffingRecs),
    revenueBasis: parseRevenueBasis(o.revenueBasis),
    revenueCategoryIds: parseCategoryIds(o.revenueCategoryIds),
    sharedCostAllocationPct: parseAllocationPct(o.sharedCostAllocationPct),
    tipsInLabor: bool(o.tipsInLabor, false),
    minWageCents:
      o.minWageCents == null || o.minWageCents === ""
        ? d.minWageCents
        : int(o.minWageCents, 0, 0, 100_000),
    otDailyHours:
      o.otDailyHours == null || o.otDailyHours === ""
        ? d.otDailyHours
        : int(o.otDailyHours, 8, 0, 24),
    otWeeklyHours:
      o.otWeeklyHours == null || o.otWeeklyHours === ""
        ? d.otWeeklyHours
        : int(o.otWeeklyHours, 40, 0, 80),
    otSeventhDay: bool(o.otSeventhDay, false),
    tipCreditCents:
      o.tipCreditCents == null || o.tipCreditCents === ""
        ? d.tipCreditCents
        : int(o.tipCreditCents, 0, 0, 100_000),
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

export {
  NO_SHIFT_BLOCKED,
  NO_SHIFT_CONFIRM,
  clockInWindowBounds,
  evaluateClockIn,
  evaluateClockOut,
  isInsideClockInWindow,
  pickClockShift,
  shiftCoversClockIn,
  unscheduledClockGate,
  type ClockEval,
  type ShiftWindow,
} from "./clock-eval";

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
