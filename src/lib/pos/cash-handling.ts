import type { DeviceRole } from "./device-roles";
import { deviceRoleFromSessionMode } from "./device-roles";
import type { SessionModeId } from "@/lib/lifecycle/types";
import type { Employee, EmployeeRole, Order } from "./types";
import { cloneTipPooling, DEFAULT_TIP_POOLING, parseTipPooling, type TipPoolingConfig } from "./tip-pooling";
export type { TipPoolingConfig } from "./tip-pooling";

export const TIP_OUT_CATEGORIES = ["food", "drink", "total", "covers"] as const;
export type TipOutCategory = (typeof TIP_OUT_CATEGORIES)[number];
export const TIP_OUT_BASES = ["category_sales", "tips_by_mix"] as const;
export type TipOutBasis = (typeof TIP_OUT_BASES)[number];
export const TIP_OUT_ROLES = ["kitchen", "bar", "host", "busser", "expo", "other"] as const;
export type TipOutRole = (typeof TIP_OUT_ROLES)[number];

export type TipOutPool = {
  id: string;
  label: string;
  role: TipOutRole;
  category: TipOutCategory;
  percent: number;
  /** Operator entity, or null for the house department. */
  entityId: string | null;
};

export const TIP_OUT_ROLE_LABEL: Record<TipOutRole, string> = {
  kitchen: "Kitchen",
  bar: "Bar",
  host: "Host",
  busser: "Busser",
  expo: "Expo",
  other: "Other",
};

export const DEFAULT_TIP_OUT_POOLS: TipOutPool[] = [
  { id: "pool_kitchen", label: "Kitchen", role: "kitchen", category: "food", percent: 3, entityId: null },
  { id: "pool_bar", label: "Bar", role: "bar", category: "drink", percent: 5, entityId: null },
  { id: "pool_host", label: "Host", role: "host", category: "total", percent: 1, entityId: null },
  { id: "pool_busser", label: "Busser", role: "busser", category: "food", percent: 2, entityId: null },
];

export function parseTipOutPools(raw: unknown): TipOutPool[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_TIP_OUT_POOLS.map((p) => ({ ...p }));
  const out: TipOutPool[] = [];
  for (const row of raw.slice(0, 12)) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = String(o.id ?? "").trim() || `pool_${out.length + 1}`;
    const label = String(o.label ?? "").trim().slice(0, 40) || "Pool";
    const role = (TIP_OUT_ROLES as readonly string[]).includes(String(o.role))
      ? (o.role as TipOutRole)
      : "other";
    const category = (TIP_OUT_CATEGORIES as readonly string[]).includes(String(o.category))
      ? (o.category as TipOutCategory)
      : "total";
    const percent = Math.min(100, Math.max(0, Number(o.percent) || 0));
    const entityRaw = String(o.entityId ?? "").trim();
    const entityId = !entityRaw || entityRaw === "host" ? null : entityRaw.slice(0, 40);
    out.push({ id: id.slice(0, 40), label, role, category, percent, entityId });
  }
  return out.length ? out : DEFAULT_TIP_OUT_POOLS.map((p) => ({ ...p }));
}

export const CASH_MODELS = [
  "single_user_drawer",
  "shared_drawer",
  "server_bank",
  "well_plus_server_bank",
  "cashier_only",
  "cash_disabled",
] as const;
export type CashModel = (typeof CASH_MODELS)[number];

export const CASH_MODEL_LABEL: Record<CashModel, string> = {
  single_user_drawer: "One-person drawer",
  shared_drawer: "Shared drawer",
  server_bank: "Server bank",
  well_plus_server_bank: "Well drawers + server banks",
  cashier_only: "Cashier / host only",
  cash_disabled: "Cash disabled",
};

export const CASH_MODEL_BLURB: Record<CashModel, string> = {
  single_user_drawer: "One assigned user on that drawer.",
  shared_drawer: "Multiple assigned users, one till. One end-of-night count; still report cash by user.",
  server_bank: "Server carries a starting bank. No house kick on their cash.",
  well_plus_server_bank: "Bar wells have drawers; floor servers have banks.",
  cashier_only: "Servers cannot tender cash. Send the guest to cashier or host.",
  cash_disabled: "Card and gift only on this station or the whole location.",
};

export const DRAWER_KINDS = ["front", "host", "well", "service"] as const;
export type DrawerKind = (typeof DRAWER_KINDS)[number];

export const DRAWER_KIND_LABEL: Record<DrawerKind, string> = {
  front: "Front",
  host: "Host",
  well: "Bar well",
  service: "Service bar",
};

export type CashSinkKind = "none" | "server_bank" | `drawer:${string}`;

export type OpenOnCashSale = "always" | "never" | "manager_pin";
export type NoSaleOpen = "off" | "manager" | "assigned_user";
export type IssueBankWhen = "clock_in" | "first_cash_sale" | "manager_issue";
export type CashFollowsTransfer = "original_server" | "accepting_server";
export type HandheldWellCash = "well_drawer" | "server_bank";

export const CC_TIP_PAYOUTS = ["cash_at_close", "paycheck", "cash_tips_only_at_close"] as const;
export type CcTipPayout = (typeof CC_TIP_PAYOUTS)[number];
export type CcTipPayoutSetting = CcTipPayout | "inherit";

export const CC_TIP_PAYOUT_LABEL: Record<CcTipPayout, string> = {
  cash_at_close: "Cash out card tips at closeout",
  paycheck: "Card tips on paycheck (hours export)",
  cash_tips_only_at_close: "Only declared cash tips at closeout",
};

export const CC_TIP_PAYOUT_BLURB: Record<CcTipPayout, string> = {
  cash_at_close:
    "Closeout cash due to the server includes card tips, paid out from the drawer or safe. The payroll export does not add those card tips again.",
  paycheck:
    "Closeout shows card tips as informational. Cash due from card tips is $0. Card tips are included on the hours-export file (ADP / Intuit / CSV). Summex does not run payroll.",
  cash_tips_only_at_close:
    "Only declared cash tips are settled in person. Card tips always export to payroll.",
};

export function parseCcTipPayout(raw: unknown, fallback: CcTipPayout = "cash_at_close"): CcTipPayout {
  const s = String(raw ?? "");
  return (CC_TIP_PAYOUTS as readonly string[]).includes(s) ? (s as CcTipPayout) : fallback;
}

export function parseCcTipPayoutSetting(raw: unknown): CcTipPayoutSetting {
  if (raw === "inherit" || raw == null || raw === "") return "inherit";
  return parseCcTipPayout(raw);
}

/** First non-inherit override wins; otherwise the location default. */
export function resolveCcTipPayout(
  location: CcTipPayout,
  ...overrides: Array<CcTipPayoutSetting | null | undefined>
): CcTipPayout {
  for (const o of overrides) {
    if (o && o !== "inherit") return o;
  }
  return location;
}

export function cardTipsCashDueCents(payout: CcTipPayout, cardTipsCents: number): number {
  return payout === "cash_at_close" ? Math.max(0, cardTipsCents) : 0;
}

export function declaredCashDueCents(payout: CcTipPayout, declaredCents: number): number {
  return payout === "cash_tips_only_at_close" ? Math.max(0, declaredCents) : 0;
}

export function cashDueToServerCents(
  payout: CcTipPayout,
  cardTipsCents: number,
  declaredCents: number,
): number {
  return cardTipsCashDueCents(payout, cardTipsCents) + declaredCashDueCents(payout, declaredCents);
}

export function payrollIncludesCardTips(payout: CcTipPayout): boolean {
  return payout !== "cash_at_close";
}

/** Cash leaving the till for CC tips when cash_at_close is on. */
export function tipPaidOutCents(payout: CcTipPayout, cashDueCents: number): number {
  return payout === "cash_at_close" ? Math.max(0, cashDueCents) : 0;
}

/** Fold pending tip paid-out into blind expected before the event is recorded. */
export function expectedAfterTipPayout(opts: {
  baseExpected: number;
  payoutCents: number;
  sinkType: "drawer" | "bank" | "blocked";
}): number {
  const due = Math.max(0, opts.payoutCents);
  if (!due || opts.sinkType === "blocked") return opts.baseExpected;
  if (opts.sinkType === "drawer") return opts.baseExpected - due;
  return opts.baseExpected + due;
}

export type CashDrawerDef = {
  id: string;
  name: string;
  kind: DrawerKind;
  kickPrinterId: string | null;
  startingBankCents: number;
  assignedEmployeeIds: string[];
};

export type CashHandlingConfig = {
  defaultModel: CashModel;
  roleOverride: Partial<Record<DeviceRole, CashModel>>;
  deviceAssignment: Record<string, CashSinkKind>;
  drawers: CashDrawerDef[];
  serverBankStartingCents: number;
  issueBank: IssueBankWhen;
  openOnCashSale: OpenOnCashSale;
  noSaleOpen: NoSaleOpen;
  skimOverCents: number;
  paidInOutReasons: string[];
  paidInOutRequireManagerPin: boolean;
  blindCount: boolean;
  overShortWarnCents: number;
  overShortRequireNoteCents: number;
  cashFollowsOnTransfer: CashFollowsTransfer;
  requireCountToClockOut: boolean;
  handheldWellCash: HandheldWellCash;
  blockOpenChecks: boolean;
  requireCloseoutBeforeClockOut: boolean;
  pendingCloseoutNeedsManager: boolean;
  printCheckoutSlip: boolean;
  tipOutEnabled: boolean;
  tipOutBasis: TipOutBasis;
  tipOutPools: TipOutPool[];
  ccTipPayout: CcTipPayout;
  tipPooling: TipPoolingConfig;
};

export const DEFAULT_PAID_REASONS = [
  "Tip out",
  "CC tips",
  "Vendor",
  "Petty cash",
  "Lottery",
  "Deposit",
  "Change order",
  "Other",
];

export function defaultDrawers(): CashDrawerDef[] {
  return [
    { id: "drw_front", name: "Front", kind: "front", kickPrinterId: null, startingBankCents: 20000, assignedEmployeeIds: [] },
    { id: "drw_host", name: "Host", kind: "host", kickPrinterId: null, startingBankCents: 10000, assignedEmployeeIds: [] },
    { id: "drw_well_1", name: "Bar-Well-1", kind: "well", kickPrinterId: null, startingBankCents: 30000, assignedEmployeeIds: [] },
    { id: "drw_well_2", name: "Bar-Well-2", kind: "well", kickPrinterId: null, startingBankCents: 30000, assignedEmployeeIds: [] },
    { id: "drw_service", name: "Service-Bar", kind: "service", kickPrinterId: null, startingBankCents: 15000, assignedEmployeeIds: [] },
  ];
}

export const DEFAULT_CASH_HANDLING: CashHandlingConfig = {
  defaultModel: "single_user_drawer",
  roleOverride: {},
  deviceAssignment: {},
  drawers: defaultDrawers(),
  serverBankStartingCents: 5000,
  issueBank: "first_cash_sale",
  openOnCashSale: "always",
  noSaleOpen: "assigned_user",
  skimOverCents: 50000,
  paidInOutReasons: [...DEFAULT_PAID_REASONS],
  paidInOutRequireManagerPin: true,
  blindCount: true,
  overShortWarnCents: 500,
  overShortRequireNoteCents: 2000,
  cashFollowsOnTransfer: "original_server",
  requireCountToClockOut: false,
  handheldWellCash: "well_drawer",
  blockOpenChecks: true,
  requireCloseoutBeforeClockOut: true,
  pendingCloseoutNeedsManager: true,
  printCheckoutSlip: false,
  tipOutEnabled: true,
  tipOutBasis: "category_sales",
  tipOutPools: DEFAULT_TIP_OUT_POOLS.map((p) => ({ ...p })),
  ccTipPayout: "cash_at_close",
  tipPooling: cloneTipPooling(DEFAULT_TIP_POOLING),
};

function asModel(raw: unknown): CashModel | null {
  const s = String(raw ?? "");
  return (CASH_MODELS as readonly string[]).includes(s) ? (s as CashModel) : null;
}

function asDrawerKind(raw: unknown): DrawerKind {
  const s = String(raw ?? "");
  return (DRAWER_KINDS as readonly string[]).includes(s) ? (s as DrawerKind) : "front";
}

function asSink(raw: unknown): CashSinkKind | null {
  const s = String(raw ?? "").trim();
  if (s === "none" || s === "server_bank") return s;
  if (s.startsWith("drawer:") && s.length > 7) return s as CashSinkKind;
  return null;
}

export function parseCashHandling(raw: unknown): CashHandlingConfig {
  const base = { ...DEFAULT_CASH_HANDLING, drawers: defaultDrawers() };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const defaultModel = asModel(o.defaultModel) ?? base.defaultModel;
  const roleOverride: Partial<Record<DeviceRole, CashModel>> = {};
  if (o.roleOverride && typeof o.roleOverride === "object") {
    for (const [k, v] of Object.entries(o.roleOverride as Record<string, unknown>)) {
      const m = asModel(v);
      if ((k === "order" || k === "host" || k === "ods") && m) roleOverride[k] = m;
    }
  }
  const deviceAssignment: Record<string, CashSinkKind> = {};
  if (o.deviceAssignment && typeof o.deviceAssignment === "object") {
    for (const [k, v] of Object.entries(o.deviceAssignment as Record<string, unknown>)) {
      const s = asSink(v);
      if (k && s) deviceAssignment[k] = s;
    }
  }
  const drawers: CashDrawerDef[] = Array.isArray(o.drawers)
    ? o.drawers
        .map((d, i) => {
          if (!d || typeof d !== "object") return null;
          const r = d as Record<string, unknown>;
          const id = String(r.id ?? "").trim() || `drw_${i + 1}`;
          const name = String(r.name ?? "").trim().slice(0, 40) || `Drawer ${i + 1}`;
          const assigned = Array.isArray(r.assignedEmployeeIds)
            ? r.assignedEmployeeIds.map((x) => String(x)).filter(Boolean).slice(0, 40)
            : [];
          return {
            id: id.slice(0, 40),
            name,
            kind: asDrawerKind(r.kind),
            kickPrinterId: r.kickPrinterId ? String(r.kickPrinterId).slice(0, 80) : null,
            startingBankCents: Math.max(0, Math.round(Number(r.startingBankCents) || 0)),
            assignedEmployeeIds: assigned,
          } satisfies CashDrawerDef;
        })
        .filter((d): d is CashDrawerDef => !!d)
        .slice(0, 24)
    : base.drawers;
  const reasons = Array.isArray(o.paidInOutReasons)
    ? o.paidInOutReasons.map((x) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 20)
    : base.paidInOutReasons;
  const openOnCashSale =
    o.openOnCashSale === "never" || o.openOnCashSale === "manager_pin" ? o.openOnCashSale : "always";
  const noSaleOpen =
    o.noSaleOpen === "off" || o.noSaleOpen === "manager" || o.noSaleOpen === "assigned_user"
      ? o.noSaleOpen
      : "assigned_user";
  const issueBank =
    o.issueBank === "clock_in" || o.issueBank === "first_cash_sale" || o.issueBank === "manager_issue"
      ? o.issueBank
      : "first_cash_sale";
  return {
    defaultModel,
    roleOverride,
    deviceAssignment,
    drawers: drawers.length ? drawers : base.drawers,
    serverBankStartingCents: Math.max(0, Math.round(Number(o.serverBankStartingCents) || 0)),
    issueBank,
    openOnCashSale,
    noSaleOpen,
    skimOverCents: Math.max(0, Math.round(Number(o.skimOverCents) || 0)),
    paidInOutReasons: reasons.length ? reasons : [...DEFAULT_PAID_REASONS],
    paidInOutRequireManagerPin: o.paidInOutRequireManagerPin !== false,
    overShortWarnCents: Math.max(0, Math.round(Number(o.overShortWarnCents) || 0)),
    overShortRequireNoteCents: Math.max(0, Math.round(Number(o.overShortRequireNoteCents) || 0)),
    cashFollowsOnTransfer:
      o.cashFollowsOnTransfer === "accepting_server" ? "accepting_server" : "original_server",
    requireCountToClockOut: Boolean(o.requireCountToClockOut),
    handheldWellCash: o.handheldWellCash === "server_bank" ? "server_bank" : "well_drawer",
    blockOpenChecks: o.blockOpenChecks !== false,
    requireCloseoutBeforeClockOut: o.requireCloseoutBeforeClockOut !== false,
    pendingCloseoutNeedsManager: o.pendingCloseoutNeedsManager !== false,
    printCheckoutSlip: Boolean(o.printCheckoutSlip),
    tipOutEnabled: o.tipOutEnabled !== false,
    tipOutBasis: o.tipOutBasis === "tips_by_mix" ? "tips_by_mix" : "category_sales",
    tipOutPools: parseTipOutPools(o.tipOutPools),
    ccTipPayout: parseCcTipPayout(o.ccTipPayout),
    tipPooling: o.tipPooling
      ? parseTipPooling(o.tipPooling)
      : parseTipPooling({
          ...DEFAULT_TIP_POOLING,
          mode: o.tipOutEnabled === false ? "individual" : "individual_plus_tipout",
        }),
    blindCount:
      o.blindCount === undefined
        ? defaultModel === "server_bank" || defaultModel === "single_user_drawer"
        : Boolean(o.blindCount),
  };
}

export function drawerById(cfg: CashHandlingConfig, id: string | null | undefined): CashDrawerDef | undefined {
  if (!id) return undefined;
  return cfg.drawers.find((d) => d.id === id);
}

export function parseDrawerSink(sink: CashSinkKind): string | null {
  if (sink.startsWith("drawer:")) return sink.slice(7);
  return null;
}

export function modelForStation(cfg: CashHandlingConfig, role: DeviceRole | null): CashModel {
  if (role && cfg.roleOverride[role]) return cfg.roleOverride[role]!;
  return cfg.defaultModel;
}

export type CashSink =
  | { type: "drawer"; drawer: CashDrawerDef }
  | { type: "bank"; employeeId: string }
  | { type: "blocked"; reason: string };

function firstDrawer(cfg: CashHandlingConfig, kind?: DrawerKind): CashDrawerDef | undefined {
  if (kind) return cfg.drawers.find((d) => d.kind === kind);
  return cfg.drawers[0];
}

export function resolveCashSink(opts: {
  cfg: CashHandlingConfig;
  emp: Pick<Employee, "id" | "role"> | null;
  deviceRole: DeviceRole | null;
  deviceId?: string | null;
  floaterWellId?: string | null;
  order?: Pick<Order, "type"> | null;
}): CashSink {
  const { cfg, emp } = opts;
  if (!emp) return { type: "blocked", reason: "Sign in to take cash." };

  const deviceSink = opts.deviceId ? cfg.deviceAssignment[opts.deviceId] : undefined;
  if (deviceSink === "none") {
    return { type: "blocked", reason: "This station is not assigned a drawer or bank." };
  }
  if (deviceSink === "server_bank") return { type: "bank", employeeId: emp.id };
  if (deviceSink?.startsWith("drawer:")) {
    const d = drawerById(cfg, parseDrawerSink(deviceSink));
    if (d) return { type: "drawer", drawer: d };
  }

  const model = modelForStation(cfg, opts.deviceRole);
  if (model === "cash_disabled") {
    return { type: "blocked", reason: "Cash is disabled on this station. Use card or gift." };
  }
  if (model === "cashier_only") {
    const may =
      emp.role === "cashier" ||
      emp.role === "host" ||
      emp.role === "manager" ||
      emp.role === "owner" ||
      opts.deviceRole === "host";
    if (!may) {
      return { type: "blocked", reason: "Send the guest to cashier or host for cash." };
    }
  }

  if (opts.order?.type === "bar_tab" && cfg.handheldWellCash === "well_drawer") {
    const well =
      drawerById(cfg, opts.floaterWellId) ||
      firstDrawer(cfg, "well");
    if (well) return { type: "drawer", drawer: well };
  }
  if (opts.order?.type === "bar_tab" && cfg.handheldWellCash === "server_bank") {
    return { type: "bank", employeeId: emp.id };
  }

  if (model === "server_bank") return { type: "bank", employeeId: emp.id };

  if (model === "well_plus_server_bank") {
    if (opts.deviceRole === "host") {
      const host = firstDrawer(cfg, "host") || firstDrawer(cfg);
      if (host) return { type: "drawer", drawer: host };
    }
    if (emp.role === "bartender" || emp.role === "vendor_operator") {
      const well = drawerById(cfg, opts.floaterWellId) || firstDrawer(cfg, "well");
      if (well) return { type: "drawer", drawer: well };
    }
    if (emp.role === "server") return { type: "bank", employeeId: emp.id };
    const front = firstDrawer(cfg, "front") || firstDrawer(cfg);
    if (front) return { type: "drawer", drawer: front };
    return { type: "bank", employeeId: emp.id };
  }

  if (opts.deviceRole === "host") {
    const host = firstDrawer(cfg, "host") || firstDrawer(cfg);
    if (host) return { type: "drawer", drawer: host };
  }

  const assigned = cfg.drawers.find((d) => d.assignedEmployeeIds.includes(emp.id));
  if (assigned) return { type: "drawer", drawer: assigned };

  const front = firstDrawer(cfg, "front") || firstDrawer(cfg);
  if (front) return { type: "drawer", drawer: front };
  return { type: "blocked", reason: "No drawer is configured." };
}

export function expectedCashCents(opts: {
  startCents: number;
  cashSalesCents: number;
  cashRefundsCents: number;
  dropsCents: number;
  paidInCents: number;
  paidOutCents: number;
}): number {
  return (
    opts.startCents +
    opts.cashSalesCents -
    opts.cashRefundsCents -
    opts.dropsCents +
    opts.paidInCents -
    opts.paidOutCents
  );
}

export function cashRoleFromSession(kind: SessionModeId | null | undefined): DeviceRole | null {
  if (!kind) return null;
  return deviceRoleFromSessionMode(kind);
}

export function canTenderCash(emp: Pick<Employee, "role"> | null, sink: CashSink): boolean {
  if (!emp) return false;
  return sink.type !== "blocked";
}

export function isManagerCash(role: EmployeeRole | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

export function newDrawerId(): string {
  return `drw_${Math.random().toString(36).slice(2, 8)}`;
}
