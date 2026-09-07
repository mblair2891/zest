import type { Employee, EmployeeRole } from "./types";

/** Full drawer total vs turn-in only (drawer minus bank left in till). */
export const TILL_COUNT_MODES = ["full_drawer", "turn_in"] as const;
export type TillCountMode = (typeof TILL_COUNT_MODES)[number];

export const TILL_COUNT_MODE_LABEL: Record<TillCountMode, string> = {
  full_drawer: "Full drawer total",
  turn_in: "Turn-in only (leave the bank)",
};

export const VARIANCE_ACTIONS = ["warn", "block_clockout", "require_manager"] as const;
export type VarianceAction = (typeof VARIANCE_ACTIONS)[number];

export const VARIANCE_ACTION_LABEL: Record<VarianceAction, string> = {
  warn: "Warn (auto-accept within tolerance)",
  block_clockout: "Flag and block clock-out until manager review",
  require_manager: "Lock for manager before the shift is accepted",
};

export const TILL_CLOSE_STATUSES = [
  "counting",
  "recounting",
  "denom_required",
  "submitted",
  "auto_accepted",
  "pending_review",
  "needs_review",
  "accepted",
  "dropped",
  "voided",
] as const;
export type TillCloseStatus = (typeof TILL_CLOSE_STATUSES)[number];

export const TILL_CLOSE_STATUS_LABEL: Record<TillCloseStatus, string> = {
  counting: "Counting",
  recounting: "Recount",
  denom_required: "Count by denomination",
  submitted: "Submitted",
  auto_accepted: "Balanced",
  pending_review: "Pending review",
  needs_review: "Needs review",
  accepted: "Accepted",
  dropped: "Dropped",
  voided: "Voided",
};

export const COUNTERFEIT_REASONS = [
  "counterfeit",
  "pulled_bill",
  "damaged",
  "other",
] as const;
export type CounterfeitReason = (typeof COUNTERFEIT_REASONS)[number];

export const COUNTERFEIT_REASON_LABEL: Record<CounterfeitReason, string> = {
  counterfeit: "Counterfeit",
  pulled_bill: "Pulled bill",
  damaged: "Damaged / unusable",
  other: "Other",
};

export type DenomKind = "bill" | "coin";

export type TillDenom = {
  id: string;
  label: string;
  cents: number;
  kind: DenomKind;
};

/** US bills and coins used on the count grid. Never prefilled. */
export const TILL_DENOMS: TillDenom[] = [
  { id: "100", label: "$100", cents: 10000, kind: "bill" },
  { id: "50", label: "$50", cents: 5000, kind: "bill" },
  { id: "20", label: "$20", cents: 2000, kind: "bill" },
  { id: "10", label: "$10", cents: 1000, kind: "bill" },
  { id: "5", label: "$5", cents: 500, kind: "bill" },
  { id: "1", label: "$1", cents: 100, kind: "bill" },
  { id: "dollar", label: "$1 coin", cents: 100, kind: "coin" },
  { id: "half", label: "50¢", cents: 50, kind: "coin" },
  { id: "quarter", label: "25¢", cents: 25, kind: "coin" },
  { id: "dime", label: "10¢", cents: 10, kind: "coin" },
  { id: "nickel", label: "5¢", cents: 5, kind: "coin" },
  { id: "penny", label: "1¢", cents: 1, kind: "coin" },
];

export type DenomCounts = Record<string, number>;

export type BankMixLine = { denomId: string; qty: number };

export type TillCloseConfig = {
  countMode: TillCountMode;
  denominationRequired: boolean;
  dualControlRequired: boolean;
  dropBagRequired: boolean;
  otherTendersEnabled: boolean;
  /** Next-shift / leftover bank. 0 = use the drawer’s opening bank. */
  nextShiftBankCents: number;
  varianceAction: VarianceAction;
  /** Optional required leftover mix for the next-shift bank. */
  bankMix: BankMixLine[];
  /** Turn-in bag slip copies after a successful submit. */
  turnInSlipCopies: 1 | 2;
  /** 0 = exact cent match. Amounts within this window count as balanced. */
  matchToleranceCents: number;
  /** After a second mismatch, show over/short to the cashier. */
  revealVarianceAfterFinalMismatch: boolean;
  notifyInApp: boolean;
  notifySms: boolean;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifyEmails: string[];
};

export const DEFAULT_TILL_CLOSE: TillCloseConfig = {
  countMode: "full_drawer",
  denominationRequired: false,
  dualControlRequired: false,
  dropBagRequired: false,
  otherTendersEnabled: true,
  nextShiftBankCents: 0,
  varianceAction: "warn",
  bankMix: [],
  turnInSlipCopies: 1,
  matchToleranceCents: 0,
  revealVarianceAfterFinalMismatch: false,
  notifyInApp: true,
  notifySms: true,
  notifyEmail: true,
  notifyPush: true,
  notifyEmails: [],
};

export type ExpectedSnapshot = {
  openingBankCents: number;
  cashSalesCents: number;
  cashRefundsCents: number;
  paidOutsCents: number;
  paidInsCents: number;
  dropsCents: number;
  transfersInCents?: number;
  transfersOutCents?: number;
  transferLines?: {
    dir: "in" | "out";
    amountCents: number;
    otherTillName: string;
    otherEmployeeName: string;
    id?: string;
  }[];
  expectedCents: number;
};

export type OtherTenderLine = {
  kind: "check" | "money_order";
  cents: number;
  ref?: string;
};

export type TillCloseRecord = {
  id: string;
  locationId: string;
  drawerId: string;
  drawerName: string;
  sinkType: "drawer" | "bank";
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  status: TillCloseStatus;
  countMode: TillCountMode;
  denominationRequired: boolean;
  nextShiftBankCents: number;
  denoms: DenomCounts | null;
  countedCents: number | null;
  turnInCents: number | null;
  bankLeftCents: number | null;
  overShortCents: number | null;
  checksCents: number;
  moneyOrdersCents: number;
  bagNumber: string | null;
  comment: string | null;
  managerNote: string | null;
  witnessEmployeeId: string | null;
  witnessEmployeeName: string | null;
  startedAt: number;
  submittedAt: number | null;
  acceptedAt: number | null;
  acceptedById: string | null;
  acceptedByName: string | null;
  droppedAt: number | null;
  droppedById: string | null;
  voidedAt: number | null;
  voidedById: string | null;
  recountOfId: string | null;
  recountCount: number;
  deviceId: string | null;
  ip: string | null;
  cashBlocked: boolean;
  openingBankCorrectedCents: number | null;
  counterfeitPulledCents: number;
  /** Sealed until submit. Never put on the cashier count screen. */
  expected: ExpectedSnapshot | null;
  slipPrintOk: boolean;
  slipPrintedAt: number | null;
  slipReprintCount: number;
  printOverrideReason: string | null;
  printOverrideById: string | null;
  printOverrideByName: string | null;
  firstCountedCents: number | null;
  firstSubmittedAt: number | null;
  denomCountedCents: number | null;
  managerAckAt: number | null;
  managerAckById: string | null;
  notifySentAt: number | null;
};

/** Fields the cashier may see before submit. No expected, sales, or variance. */
export type BlindCountScreen = {
  closeoutId: string;
  drawerId: string;
  drawerName: string;
  sinkType: "drawer" | "bank";
  employeeId: string;
  employeeName: string;
  status: "counting" | "recounting" | "denom_required";
  step: "total" | "denom";
  countMode: TillCountMode;
  denominationRequired: boolean;
  /** Configured leftover bank — shown as “leave $X in the till”, not expected. */
  nextShiftBankCents: number;
  otherTendersEnabled: boolean;
  dropBagRequired: boolean;
  startedAt: number;
  witnessEmployeeName: string | null;
};

export type TillCloseResult = {
  closeoutId: string;
  drawerName: string;
  employeeName: string;
  employeeId: string;
  status: TillCloseStatus;
  countedCents: number;
  expectedCents: number;
  overShortCents: number;
  turnInCents: number;
  bankLeftCents: number;
  bagNumber: string | null;
  submittedAt: number;
  openingBankCents: number;
  cashSalesCents: number;
  cashRefundsCents: number;
  paidOutsCents: number;
  paidInsCents: number;
  dropsCents: number;
  transfersInCents: number;
  transfersOutCents: number;
  transferLines: {
    dir: "in" | "out";
    amountCents: number;
    otherTillName: string;
    otherEmployeeName: string;
    id?: string;
  }[];
  checksCents: number;
  moneyOrdersCents: number;
  comment: string | null;
  managerNote: string | null;
  droppedAt: number | null;
  denoms: DenomCounts | null;
  clockOutBlocked: boolean;
  drawerId: string;
  witnessEmployeeName: string | null;
  witnessEmployeeId: string | null;
  slipPrintOk: boolean;
  printOverrideReason: string | null;
  firstCountedCents: number | null;
  denomCountedCents: number | null;
  revealVariance: boolean;
  slipStatus: "BALANCED" | "MANAGER REVIEW";
};

export type TillAuditPayload = {
  countedCents?: number | null;
  expectedCents?: number | null;
  overShortCents?: number | null;
  turnInCents?: number | null;
  bagNumber?: string | null;
  checksCents?: number | null;
  moneyOrdersCents?: number | null;
  pulledCents?: number | null;
  from?: number | null;
  to?: number | null;
  clearedCountedCents?: number | null;
  expectedHidden?: boolean | null;
  openingBankCents?: number | null;
  cashSalesCents?: number | null;
  cashRefundsCents?: number | null;
  paidOutsCents?: number | null;
  paidInsCents?: number | null;
  dropsCents?: number | null;
  denomsJson?: string | null;
  slipPrintOk?: boolean | null;
  firstCountedCents?: number | null;
  denomCountedCents?: number | null;
};

export type TillAuditEvent = {
  id: string;
  closeoutId: string;
  at: number;
  actorId: string;
  actorName: string;
  action: string;
  detail: string;
  payload: TillAuditPayload | null;
  ip: string | null;
  deviceId: string | null;
};

export type CountSubmitInput = {
  denoms?: DenomCounts | null;
  countedTotalCents?: number | null;
  bankRemoved?: boolean;
  checksCents?: number;
  moneyOrdersCents?: number;
  bagNumber?: string | null;
};

const BLIND_STATUSES: TillCloseStatus[] = ["counting", "recounting", "denom_required"];
const LOCKED_STATUSES: TillCloseStatus[] = [
  "submitted",
  "auto_accepted",
  "pending_review",
  "needs_review",
  "accepted",
  "dropped",
];
const BLOCK_CASH_STATUSES: TillCloseStatus[] = [
  "counting",
  "recounting",
  "denom_required",
  "submitted",
  "auto_accepted",
  "pending_review",
  "needs_review",
  "accepted",
  "dropped",
];

export function isBlindPhase(status: TillCloseStatus): boolean {
  return BLIND_STATUSES.includes(status);
}

export function isCountLocked(status: TillCloseStatus): boolean {
  return LOCKED_STATUSES.includes(status);
}

export function blocksCashSales(status: TillCloseStatus): boolean {
  return BLOCK_CASH_STATUSES.includes(status);
}

export function isManagerTillRole(role: EmployeeRole | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

export function parseTillCountMode(raw: unknown, fallback: TillCountMode = "full_drawer"): TillCountMode {
  const s = String(raw ?? "");
  return (TILL_COUNT_MODES as readonly string[]).includes(s) ? (s as TillCountMode) : fallback;
}

export function parseVarianceAction(raw: unknown, fallback: VarianceAction = "warn"): VarianceAction {
  const s = String(raw ?? "");
  return (VARIANCE_ACTIONS as readonly string[]).includes(s) ? (s as VarianceAction) : fallback;
}

export function parseBankMix(raw: unknown): BankMixLine[] {
  if (!Array.isArray(raw)) return [];
  const out: BankMixLine[] = [];
  for (const row of raw.slice(0, 16)) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const denomId = String(o.denomId ?? "").trim();
    if (!TILL_DENOMS.some((d) => d.id === denomId)) continue;
    const qty = Math.max(0, Math.min(9999, Math.round(Number(o.qty) || 0)));
    out.push({ denomId, qty });
  }
  return out;
}

export function parseTillCloseConfig(raw: unknown): TillCloseConfig {
  const base = { ...DEFAULT_TILL_CLOSE };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    countMode: parseTillCountMode(o.countMode, base.countMode),
    denominationRequired: Boolean(o.denominationRequired),
    dualControlRequired: Boolean(o.dualControlRequired),
    dropBagRequired: Boolean(o.dropBagRequired),
    otherTendersEnabled: o.otherTendersEnabled !== false,
    nextShiftBankCents: Math.max(0, Math.round(Number(o.nextShiftBankCents) || 0)),
    varianceAction: parseVarianceAction(o.varianceAction, base.varianceAction),
    bankMix: parseBankMix(o.bankMix),
    turnInSlipCopies: Math.round(Number(o.turnInSlipCopies) || 1) >= 2 ? 2 : 1,
    matchToleranceCents: Math.max(0, Math.round(Number(o.matchToleranceCents) || 0)),
    revealVarianceAfterFinalMismatch: Boolean(o.revealVarianceAfterFinalMismatch),
    notifyInApp: o.notifyInApp !== false,
    notifySms: o.notifySms !== false,
    notifyEmail: o.notifyEmail !== false,
    notifyPush: o.notifyPush !== false,
    notifyEmails: Array.isArray(o.notifyEmails)
      ? o.notifyEmails.map((x) => String(x).trim()).filter((x) => x.includes("@")).slice(0, 12)
      : [],
  };
}

export function tillCloseFromHandling(cfg: {
  countMode?: unknown;
  denominationRequired?: unknown;
  dualControlRequired?: unknown;
  dropBagRequired?: unknown;
  otherTendersEnabled?: unknown;
  nextShiftBankCents?: unknown;
  varianceAction?: unknown;
  bankMix?: unknown;
  turnInSlipCopies?: unknown;
  matchToleranceCents?: unknown;
  revealVarianceAfterFinalMismatch?: unknown;
  notifyInApp?: unknown;
  notifySms?: unknown;
  notifyEmail?: unknown;
  notifyPush?: unknown;
  notifyEmails?: unknown;
}): TillCloseConfig {
  return parseTillCloseConfig(cfg);
}

export function resolveNextShiftBank(opts: {
  till: TillCloseConfig;
  openingBankCents: number;
}): number {
  if (opts.till.nextShiftBankCents > 0) return opts.till.nextShiftBankCents;
  return Math.max(0, opts.openingBankCents);
}

/**
 * Drawer math (cents):
 * expected = opening_bank + cash_sales − cash_refunds − paid_outs − mid_shift_drops + paid_ins
 *   + transfers_in − transfers_out (accepted till-to-till only)
 *
 * Paid-in is cash that landed in the till (change order, etc.) and must be in expected
 * or the count will false-over. Mid-shift drops already left the till — do not count them again.
 */
export function expectedTillCashCents(snap: Omit<ExpectedSnapshot, "expectedCents">): number {
  return (
    snap.openingBankCents +
    snap.cashSalesCents -
    snap.cashRefundsCents -
    snap.paidOutsCents -
    snap.dropsCents +
    snap.paidInsCents +
    (snap.transfersInCents ?? 0) -
    (snap.transfersOutCents ?? 0)
  );
}

export function snapshotExpected(snap: Omit<ExpectedSnapshot, "expectedCents">): ExpectedSnapshot {
  return { ...snap, expectedCents: expectedTillCashCents(snap) };
}

export function parseTransferLines(raw: unknown): NonNullable<ExpectedSnapshot["transferLines"]> {
  if (!Array.isArray(raw)) return [];
  const out: NonNullable<ExpectedSnapshot["transferLines"]> = [];
  for (const row of raw.slice(0, 40)) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const dir = o.dir === "out" ? "out" : o.dir === "in" ? "in" : null;
    if (!dir) continue;
    out.push({
      dir,
      amountCents: Math.max(0, Math.round(Number(o.amountCents) || 0)),
      otherTillName: String(o.otherTillName ?? "").trim().slice(0, 80),
      otherEmployeeName: String(o.otherEmployeeName ?? "").trim().slice(0, 80),
      id: o.id ? String(o.id).slice(0, 80) : undefined,
    });
  }
  return out;
}

export function parseDenomCounts(raw: unknown): DenomCounts {
  const out: DenomCounts = {};
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const d of TILL_DENOMS) {
    const n = Math.max(0, Math.min(9999, Math.round(Number(o[d.id]) || 0)));
    if (n > 0) out[d.id] = n;
  }
  return out;
}

export function denomQty(counts: DenomCounts | null | undefined, id: string): number {
  return Math.max(0, Math.round(Number(counts?.[id]) || 0));
}

export function countedFromDenoms(counts: DenomCounts | null | undefined): number {
  if (!counts) return 0;
  let sum = 0;
  for (const d of TILL_DENOMS) {
    sum += denomQty(counts, d.id) * d.cents;
  }
  return sum;
}

export function denomsHaveEntries(counts: DenomCounts | null | undefined): boolean {
  if (!counts) return false;
  return TILL_DENOMS.some((d) => denomQty(counts, d.id) > 0);
}

/**
 * Official counted amount.
 * If any denomination is entered, the denom sum is official — never a typed total,
 * and never the expected amount.
 */
export function officialCountedCents(input: {
  denoms?: DenomCounts | null;
  countedTotalCents?: number | null;
  denominationRequired: boolean;
}): { ok: true; countedCents: number } | { ok: false; error: string } {
  const hasDenoms = denomsHaveEntries(input.denoms);
  if (input.denominationRequired && !hasDenoms) {
    return { ok: false, error: "Enter a denomination breakdown. The house requires bills and coin." };
  }
  if (hasDenoms) {
    return { ok: true, countedCents: countedFromDenoms(input.denoms) };
  }
  const total = input.countedTotalCents;
  if (total == null || !Number.isFinite(total)) {
    return { ok: false, error: "Enter the counted total." };
  }
  const cents = Math.round(total);
  if (cents < 0) return { ok: false, error: "Counted total cannot be negative." };
  return { ok: true, countedCents: cents };
}

export function applyTurnIn(opts: {
  countMode: TillCountMode;
  enteredCents: number;
  nextShiftBankCents: number;
  bankRemoved: boolean;
}): { ok: true; countedCents: number; turnInCents: number; bankLeftCents: number } | { ok: false; error: string } {
  const bank = Math.max(0, opts.nextShiftBankCents);
  if (opts.countMode === "turn_in") {
    if (!opts.bankRemoved) {
      return {
        ok: false,
        error: `Confirm you removed the ${dollars(bank)} bank and left it in the till.`,
      };
    }
    const counted = opts.enteredCents + bank;
    return {
      ok: true,
      countedCents: counted,
      turnInCents: opts.enteredCents,
      bankLeftCents: bank,
    };
  }
  const counted = opts.enteredCents;
  const turnIn = counted - bank;
  return {
    ok: true,
    countedCents: counted,
    turnInCents: turnIn,
    bankLeftCents: bank,
  };
}

export function overShortCents(countedCents: number, expectedCents: number): number {
  return countedCents - expectedCents;
}

/** turn-in + remaining bank === counted cash */
export function turnInPlusBankEqualsCounted(
  turnInCents: number,
  bankLeftCents: number,
  countedCents: number,
): boolean {
  return turnInCents + bankLeftCents === countedCents;
}

export function resolveSubmitStatus(opts: {
  overShortCents: number;
  warnCents: number;
  requireNoteCents: number;
  varianceAction: VarianceAction;
}): TillCloseStatus {
  const abs = Math.abs(opts.overShortCents);
  if (abs === 0) return "auto_accepted";
  if (opts.warnCents > 0 && abs <= opts.warnCents) return "auto_accepted";
  if (opts.varianceAction === "require_manager") return "needs_review";
  if (opts.varianceAction === "block_clockout") return "needs_review";
  if (opts.requireNoteCents > 0 && abs >= opts.requireNoteCents) return "needs_review";
  return "submitted";
}

export function clockOutBlockedForVariance(opts: {
  status: TillCloseStatus;
  overShortCents: number | null;
  varianceAction: VarianceAction;
  warnCents: number;
}): boolean {
  if (opts.status === "accepted" || opts.status === "auto_accepted" || opts.status === "dropped") {
    return false;
  }
  if (opts.status === "voided") return false;
  if (opts.status === "pending_review" || opts.status === "denom_required") return true;
  if (opts.overShortCents == null) {
    return opts.status === "counting" || opts.status === "recounting" || opts.status === "needs_review";
  }
  const abs = Math.abs(opts.overShortCents);
  if (opts.varianceAction === "warn") return false;
  if (abs === 0) return false;
  if (opts.warnCents > 0 && abs <= opts.warnCents) return false;
  return opts.status === "needs_review" || opts.status === "submitted";
}

const EXPECTED_KEYS = [
  "expected",
  "expectedCents",
  "expected_cents",
  "cashSalesCents",
  "cash_sales",
  "cashSales",
  "overShort",
  "overShortCents",
  "over_short",
  "variance",
  "zTotal",
  "zSales",
  "tenderTotals",
  "openingBankCents",
  "paidOutsCents",
  "dropsCents",
  "paidInsCents",
  "cashRefundsCents",
] as const;

export function stripExpectedFields<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of EXPECTED_KEYS) {
    delete out[k];
  }
  return out;
}

export function toBlindScreen(
  rec: Pick<
    TillCloseRecord,
    | "id"
    | "drawerId"
    | "drawerName"
    | "sinkType"
    | "employeeId"
    | "employeeName"
    | "status"
    | "countMode"
    | "denominationRequired"
    | "nextShiftBankCents"
    | "startedAt"
    | "witnessEmployeeName"
  >,
  till: TillCloseConfig,
): BlindCountScreen {
  const status: BlindCountScreen["status"] =
    rec.status === "denom_required"
      ? "denom_required"
      : rec.status === "recounting"
        ? "recounting"
        : "counting";
  return {
    closeoutId: rec.id,
    drawerId: rec.drawerId,
    drawerName: rec.drawerName,
    sinkType: rec.sinkType,
    employeeId: rec.employeeId,
    employeeName: rec.employeeName,
    status,
    step: rec.status === "denom_required" ? "denom" : "total",
    countMode: rec.countMode,
    denominationRequired: rec.denominationRequired,
    nextShiftBankCents: rec.nextShiftBankCents,
    otherTendersEnabled: till.otherTendersEnabled,
    dropBagRequired: till.dropBagRequired,
    startedAt: rec.startedAt,
    witnessEmployeeName: rec.witnessEmployeeName,
  };
}

export function assertBlindScreen(screen: BlindCountScreen): string[] {
  const leaks: string[] = [];
  const raw = JSON.stringify(screen);
  for (const k of [
    "expected",
    "overShort",
    "over_short",
    "cashSales",
    "cash_sales",
    "variance",
    "zTotal",
    "tender",
  ]) {
    if (raw.toLowerCase().includes(k.toLowerCase()) && k !== "expected") {
      /* nextShiftBank is allowed; expected* is not */
    }
  }
  const rec = screen as unknown as Record<string, unknown>;
  for (const k of EXPECTED_KEYS) {
    if (k === "openingBankCents") continue;
    if (k in rec && rec[k] != null) leaks.push(String(k));
  }
  return leaks;
}

export function toResult(rec: TillCloseRecord): TillCloseResult | { error: string } {
  if (isBlindPhase(rec.status) || rec.status === "voided") {
    return { error: "Count is not submitted." };
  }
  if (
    rec.countedCents == null ||
    rec.expected == null ||
    rec.overShortCents == null ||
    rec.turnInCents == null ||
    rec.bankLeftCents == null ||
    rec.submittedAt == null
  ) {
    return { error: "Count is not submitted." };
  }
  return {
    closeoutId: rec.id,
    drawerName: rec.drawerName,
    employeeName: rec.employeeName,
    employeeId: rec.employeeId,
    status: rec.status,
    countedCents: rec.countedCents,
    expectedCents: rec.expected.expectedCents,
    overShortCents: rec.overShortCents,
    turnInCents: rec.turnInCents,
    bankLeftCents: rec.bankLeftCents,
    bagNumber: rec.bagNumber,
    submittedAt: rec.submittedAt,
    openingBankCents: rec.expected.openingBankCents,
    cashSalesCents: rec.expected.cashSalesCents,
    cashRefundsCents: rec.expected.cashRefundsCents,
    paidOutsCents: rec.expected.paidOutsCents,
    paidInsCents: rec.expected.paidInsCents,
    dropsCents: rec.expected.dropsCents,
    transfersInCents: rec.expected.transfersInCents ?? 0,
    transfersOutCents: rec.expected.transfersOutCents ?? 0,
    transferLines: parseTransferLines(rec.expected.transferLines),
    checksCents: rec.checksCents,
    moneyOrdersCents: rec.moneyOrdersCents,
    comment: rec.comment,
    managerNote: rec.managerNote,
    droppedAt: rec.droppedAt,
    denoms: rec.denoms,
    clockOutBlocked: clockOutBlockedForVariance({
      status: rec.status,
      overShortCents: rec.overShortCents,
      varianceAction: "block_clockout",
      warnCents: 0,
    }),
    drawerId: rec.drawerId,
    witnessEmployeeName: rec.witnessEmployeeName,
    witnessEmployeeId: rec.witnessEmployeeId,
    slipPrintOk: rec.slipPrintOk,
    printOverrideReason: rec.printOverrideReason,
    firstCountedCents: rec.firstCountedCents,
    denomCountedCents: rec.denomCountedCents,
    revealVariance:
      rec.status === "pending_review" || rec.status === "needs_review"
        ? false
        : rec.status === "auto_accepted" || rec.status === "submitted" || rec.status === "accepted" || rec.status === "dropped",
    slipStatus:
      rec.status === "pending_review" || rec.status === "needs_review"
        ? "MANAGER REVIEW"
        : "BALANCED",
  };
}

export function countsMatch(counted: number, expected: number, toleranceCents: number): boolean {
  return Math.abs(counted - expected) <= Math.max(0, toleranceCents);
}

export type CountAttemptOutcome =
  | { ok: true; kind: "matched"; rec: TillCloseRecord }
  | { ok: true; kind: "need_denoms"; rec: TillCloseRecord; message: string }
  | { ok: true; kind: "pending_review"; rec: TillCloseRecord }
  | { ok: false; error: string };

export const DENOM_MISMATCH_MESSAGE = "Counted total does not match. Count again by denomination.";

export function dropBlockedForPrint(rec: Pick<TillCloseRecord, "slipPrintOk" | "printOverrideReason">): boolean {
  return !rec.slipPrintOk && !rec.printOverrideReason;
}

export function blankSlipPrintState(): Pick<
  TillCloseRecord,
  | "slipPrintOk"
  | "slipPrintedAt"
  | "slipReprintCount"
  | "printOverrideReason"
  | "printOverrideById"
  | "printOverrideByName"
> {
  return {
    slipPrintOk: false,
    slipPrintedAt: null,
    slipReprintCount: 0,
    printOverrideReason: null,
    printOverrideById: null,
    printOverrideByName: null,
  };
}

export function blankAttemptState(): Pick<
  TillCloseRecord,
  | "firstCountedCents"
  | "firstSubmittedAt"
  | "denomCountedCents"
  | "managerAckAt"
  | "managerAckById"
  | "notifySentAt"
> {
  return {
    firstCountedCents: null,
    firstSubmittedAt: null,
    denomCountedCents: null,
    managerAckAt: null,
    managerAckById: null,
    notifySentAt: null,
  };
}

export function applyCountAttempt(
  rec: TillCloseRecord,
  input: CountSubmitInput,
  till: TillCloseConfig,
): CountAttemptOutcome {
  if (isCountLocked(rec.status)) {
    return { ok: false, error: "This count is locked. Only a manager can void it and start a recount." };
  }
  if (rec.status === "voided") {
    return { ok: false, error: "This close was voided." };
  }
  if (!rec.expected) {
    return { ok: false, error: "Expected snapshot is missing. Retry the close from this station." };
  }
  const bag = String(input.bagNumber ?? rec.bagNumber ?? "").trim().slice(0, 40) || null;
  if (till.dropBagRequired && !bag) {
    return { ok: false, error: "Bag / drop number is required." };
  }
  const checksCents = Math.max(0, Math.round(input.checksCents || rec.checksCents || 0));
  const moneyOrdersCents = Math.max(0, Math.round(input.moneyOrdersCents || rec.moneyOrdersCents || 0));
  const bankRemoved = rec.countMode === "full_drawer" ? true : Boolean(input.bankRemoved);
  const tolerance = till.matchToleranceCents;
  const expected = rec.expected.expectedCents;

  const finishMatched = (entered: number, denoms: DenomCounts | null, first: number | null, second: number | null) => {
    const turn = applyTurnIn({
      countMode: rec.countMode,
      enteredCents: entered,
      nextShiftBankCents: rec.nextShiftBankCents,
      bankRemoved,
    });
    if (!turn.ok) return turn;
    const variance = overShortCents(turn.countedCents, expected);
    const balanced = countsMatch(turn.countedCents, expected, tolerance);
    const next: TillCloseRecord = {
      ...rec,
      status: balanced ? "auto_accepted" : "pending_review",
      denoms,
      countedCents: turn.countedCents,
      turnInCents: turn.turnInCents,
      bankLeftCents: turn.bankLeftCents,
      overShortCents: variance,
      checksCents,
      moneyOrdersCents,
      bagNumber: bag,
      submittedAt: Date.now(),
      cashBlocked: true,
      firstCountedCents: first,
      denomCountedCents: second,
      ...blankSlipPrintState(),
    };
    if (balanced) return { ok: true as const, kind: "matched" as const, rec: next };
    return { ok: true as const, kind: "pending_review" as const, rec: next };
  };

  if (rec.status === "denom_required") {
    if (!denomsHaveEntries(input.denoms)) {
      return { ok: false, error: "Enter the denomination breakdown. You cannot retype a single total." };
    }
    const entered = countedFromDenoms(input.denoms);
    const turn = applyTurnIn({
      countMode: rec.countMode,
      enteredCents: entered,
      nextShiftBankCents: rec.nextShiftBankCents,
      bankRemoved,
    });
    if (!turn.ok) return turn;
    const denoms = parseDenomCounts(input.denoms);
    const first = rec.firstCountedCents;
    if (countsMatch(turn.countedCents, expected, tolerance)) {
      const closed = finishMatched(entered, denoms, first, turn.countedCents);
      if (!closed.ok) return closed;
      if (closed.kind === "matched") {
        closed.rec.overShortCents = 0;
        closed.rec.status = "auto_accepted";
      }
      return closed;
    }
    const next: TillCloseRecord = {
      ...rec,
      status: "pending_review",
      denoms,
      countedCents: turn.countedCents,
      turnInCents: turn.turnInCents,
      bankLeftCents: turn.bankLeftCents,
      overShortCents: overShortCents(turn.countedCents, expected),
      checksCents,
      moneyOrdersCents,
      bagNumber: bag,
      submittedAt: Date.now(),
      cashBlocked: true,
      firstCountedCents: first,
      denomCountedCents: turn.countedCents,
      ...blankSlipPrintState(),
    };
    return { ok: true, kind: "pending_review", rec: next };
  }

  const official = officialCountedCents({
    denoms: null,
    countedTotalCents: input.countedTotalCents,
    denominationRequired: false,
  });
  if (!official.ok) return official;
  const turn = applyTurnIn({
    countMode: rec.countMode,
    enteredCents: official.countedCents,
    nextShiftBankCents: rec.nextShiftBankCents,
    bankRemoved,
  });
  if (!turn.ok) return turn;
  if (countsMatch(turn.countedCents, expected, tolerance)) {
    const closed = finishMatched(official.countedCents, null, turn.countedCents, null);
    if (closed.ok && closed.kind === "matched") {
      closed.rec.overShortCents = 0;
    }
    return closed;
  }
  const next: TillCloseRecord = {
    ...rec,
    status: "denom_required",
    firstCountedCents: turn.countedCents,
    firstSubmittedAt: Date.now(),
    checksCents,
    moneyOrdersCents,
    bagNumber: bag,
    cashBlocked: true,
    countedCents: null,
    turnInCents: null,
    bankLeftCents: null,
    overShortCents: null,
    denoms: null,
    submittedAt: null,
  };
  return { ok: true, kind: "need_denoms", rec: next, message: DENOM_MISMATCH_MESSAGE };
}

/** @deprecated use applyCountAttempt — kept for a single-shot close when the first total matches. */
export function applyCountSubmit(
  rec: TillCloseRecord,
  input: CountSubmitInput,
  _cfg: { overShortWarnCents: number; overShortRequireNoteCents: number },
  till: TillCloseConfig,
): { ok: true; rec: TillCloseRecord } | { ok: false; error: string } {
  const out = applyCountAttempt(rec, input, till);
  if (!out.ok) return out;
  if (out.kind === "need_denoms") {
    return { ok: false, error: out.message };
  }
  return { ok: true, rec: out.rec };
}

export function applyRecount(rec: TillCloseRecord, actorId: string): TillCloseRecord {
  return {
    ...rec,
    status: "recounting",
    denoms: null,
    countedCents: null,
    turnInCents: null,
    bankLeftCents: null,
    overShortCents: null,
    checksCents: 0,
    moneyOrdersCents: 0,
    bagNumber: null,
    comment: null,
    submittedAt: null,
    acceptedAt: null,
    acceptedById: null,
    acceptedByName: null,
    droppedAt: null,
    droppedById: null,
    voidedAt: null,
    voidedById: null,
    recountOfId: rec.id,
    recountCount: rec.recountCount + 1,
    cashBlocked: true,
    firstCountedCents: null,
    firstSubmittedAt: null,
    denomCountedCents: null,
    managerAckAt: null,
    managerAckById: null,
    notifySentAt: null,
    ...blankSlipPrintState(),
  };
}

export function applyManagerAck(
  rec: TillCloseRecord,
  actor: { id: string },
  action: "accept" | "recount",
): TillCloseRecord {
  const acked = {
    ...rec,
    managerAckAt: Date.now(),
    managerAckById: actor.id,
  };
  if (action === "recount") return applyRecount(acked, actor.id);
  return applyAccept(acked, { id: actor.id, name: "" });
}

export function applyAccept(rec: TillCloseRecord, actor: { id: string; name: string }): TillCloseRecord {
  return {
    ...rec,
    status: rec.droppedAt ? "dropped" : "accepted",
    acceptedAt: Date.now(),
    acceptedById: actor.id,
    acceptedByName: actor.name,
  };
}

export function applyOpeningBankCorrection(
  rec: TillCloseRecord,
  nextOpeningCents: number,
): TillCloseRecord {
  if (!rec.expected) return rec;
  const expected = snapshotExpected({
    ...rec.expected,
    openingBankCents: Math.max(0, Math.round(nextOpeningCents)),
  });
  const over =
    rec.countedCents != null ? overShortCents(rec.countedCents, expected.expectedCents) : null;
  return {
    ...rec,
    expected,
    overShortCents: over,
    openingBankCorrectedCents: expected.openingBankCents,
  };
}

export function applyCounterfeitPull(
  rec: TillCloseRecord,
  pullCents: number,
): TillCloseRecord {
  const pull = Math.max(0, Math.round(pullCents));
  if (!pull) return rec;
  const counted = rec.countedCents != null ? Math.max(0, rec.countedCents - pull) : null;
  const over =
    counted != null && rec.expected ? overShortCents(counted, rec.expected.expectedCents) : rec.overShortCents;
  const turn =
    counted != null ? counted - (rec.bankLeftCents ?? rec.nextShiftBankCents) : rec.turnInCents;
  return {
    ...rec,
    countedCents: counted,
    turnInCents: turn,
    overShortCents: over,
    counterfeitPulledCents: rec.counterfeitPulledCents + pull,
  };
}

export function canStartTillClose(opts: {
  emp: Pick<Employee, "id" | "role">;
  drawerAssignedIds: string[];
  drawerId: string;
  sinkType: "drawer" | "bank";
  bankEmployeeId?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (isManagerTillRole(opts.emp.role)) return { ok: true };
  if (opts.sinkType === "bank") {
    if (opts.bankEmployeeId && opts.bankEmployeeId !== opts.emp.id) {
      return { ok: false, error: "You can only close your own bank." };
    }
    return { ok: true };
  }
  const assigned = opts.drawerAssignedIds;
  if (assigned.length && !assigned.includes(opts.emp.id)) {
    return { ok: false, error: "This drawer is assigned to someone else." };
  }
  return { ok: true };
}

export function canViewTillRecord(opts: {
  emp: Pick<Employee, "id" | "role">;
  rec: Pick<TillCloseRecord, "employeeId" | "status">;
}): boolean {
  if (isManagerTillRole(opts.emp.role) || opts.emp.role === "accountant") return true;
  if (opts.rec.employeeId !== opts.emp.id) return false;
  return true;
}

export function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function parseMoneyToCents(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number.parseFloat(s.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export const TILL_DRAFT_KEY = "summex-till-draft";

export type TillCountDraft = {
  closeoutId: string;
  denoms: DenomCounts;
  countedStr: string;
  bankRemoved: boolean;
  checksStr: string;
  moneyOrdersStr: string;
  bagNumber: string;
  updatedAt: number;
};

export function draftStorageKey(closeoutId: string): string {
  return `${TILL_DRAFT_KEY}:${closeoutId}`;
}

export function emptyDenoms(): DenomCounts {
  return {};
}

export function tillCloseReportCsv(rows: TillCloseRecord[]): string {
  const header = [
    "employee",
    "till",
    "started_at",
    "submitted_at",
    "status",
    "opening_bank",
    "cash_sales",
    "refunds",
    "paid_outs",
    "drops",
    "paid_ins",
    "transfers_in",
    "transfers_out",
    "counted",
    "expected",
    "over_short",
    "turn_in",
    "bank_left",
    "bag_number",
    "checks",
    "money_orders",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const exp = r.expected;
    const cells = [
      csv(r.employeeName),
      csv(r.drawerName),
      csv(new Date(r.startedAt).toISOString()),
      csv(r.submittedAt ? new Date(r.submittedAt).toISOString() : ""),
      csv(r.status),
      money(exp?.openingBankCents),
      money(exp?.cashSalesCents),
      money(exp?.cashRefundsCents),
      money(exp?.paidOutsCents),
      money(exp?.dropsCents),
      money(exp?.paidInsCents),
      money(exp?.transfersInCents),
      money(exp?.transfersOutCents),
      money(r.countedCents),
      money(exp?.expectedCents),
      money(r.overShortCents),
      money(r.turnInCents),
      money(r.bankLeftCents),
      csv(r.bagNumber ?? ""),
      money(r.checksCents),
      money(r.moneyOrdersCents),
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function csv(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
  return v;
}

function money(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}
