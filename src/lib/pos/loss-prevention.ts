import type { DeviceRole } from "./device-roles";
import type {
  Employee,
  EmployeeRole,
  KitchenTicket,
  Order,
  OrderLine,
  PaymentMethod,
} from "./types";

/** Location-configurable loss-prevention gates. Controls and audit only. */
export type GateMode = "off" | "manager";

export type DiscountCap = {
  maxPercent: number;
  maxCents: number;
};

export const APPROVAL_GATES = [
  "void",
  "comp",
  "discount",
  "no_sale",
  "gift_adjust",
  "reopen",
  "tender_swap",
] as const;
export type ApprovalGateKind = (typeof APPROVAL_GATES)[number];

/** Gates a shift lead may be granted. Gift / paid-check reopen / tender-swap stay manager-only unless listed. */
export const DEFAULT_SHIFT_LEAD_GATES: ApprovalGateKind[] = ["void", "comp", "discount", "no_sale"];
export const MANAGER_ONLY_GATES: ApprovalGateKind[] = ["gift_adjust", "reopen", "tender_swap"];

export type ShiftLeadGrant = {
  role: EmployeeRole;
  gates: ApprovalGateKind[];
  maxCents: number;
};

export type PendingRejectPolicy = "leave" | "auto_void";

export type OnCallContact = {
  employeeId: string;
  phone: string;
};

export type ApprovalPath = "threshold" | "manager" | "shift_lead" | "pending" | "break_glass";

export type PendingApprovalStatus = "pending" | "approved" | "denied";

export type PendingApprovalPayload = {
  lineId?: string;
  percent?: number;
  cents?: number;
  promoCode?: string;
  paymentId?: string;
  method?: string;
  giftCode?: string;
  giftStatus?: string;
  deltaCents?: number;
  drawerId?: string;
};

export type PendingApproval = {
  id: string;
  at: number;
  kind: ApprovalGateKind;
  status: PendingApprovalStatus;
  requesterId: string;
  requesterName: string;
  orderId?: string;
  orderNumber?: number;
  lineId?: string;
  ticketId?: string;
  amountCents: number;
  reason: string;
  lineWasSent?: boolean;
  ticketFired?: boolean;
  payload: PendingApprovalPayload;
  approverId?: string;
  approverName?: string;
  resolvedAt?: number;
  channel?: "floor" | "remote" | "break_glass";
  notify?: string[];
};

export type LossPreventionConfig = {
  pinLockoutAttempts: number;
  managerSessionMinutes: number;
  voidAfterSend: GateMode;
  voidAfterBump: GateMode;
  compAlwaysManager: boolean;
  discountAfterSend: GateMode;
  discountCaps: Partial<Record<EmployeeRole, DiscountCap>>;
  paidCheckReopen: GateMode;
  giftAdjustManager: boolean;
  giftLoadRequiresTender: boolean;
  outlierMultiplier: number;
  minSalesCentsForOutlier: number;
  /** Roles that may approve void/comp/discount/no-sale (and other gates if granted) with a $ cap. */
  shiftLeadGrants: ShiftLeadGrant[];
  pendingApproval: boolean;
  pendingRejectPolicy: PendingRejectPolicy;
  remoteApprove: boolean;
  onCallList: OnCallContact[];
  breakGlass: boolean;
  /** Void/comp before send under this amount skips the gate. */
  voidCompBeforeSendCents: number;
};

export const VOID_REASONS = [
  "Entered in error",
  "Guest changed mind",
  "86 / unavailable",
  "Wrong item / modifier",
  "Quality / remake",
  "Walkout",
  "Manager approved",
] as const;

export const COMP_REASONS = [
  "Guest recovery",
  "Quality",
  "Birthday / house",
  "Staff meal",
  "Manager approved",
] as const;

export const DISCOUNT_REASONS = [
  "Promo",
  "Manager approved",
  "Guest recovery",
  "Industry",
  "Open / other (logged)",
] as const;

export const NO_SALE_REASONS = [
  "Change",
  "Stuck drawer",
  "Manager count",
  "Other (logged)",
] as const;

export const REOPEN_REASONS = [
  "Wrong tender",
  "Missed item after pay",
  "Tip adjustment (processor)",
  "Split correction",
  "Manager approved",
] as const;

export const TENDER_SWAP_REASONS = [
  "Wrong tender",
  "Guest changed method",
  "Declined then cash",
  "Manager approved",
] as const;

export const GIFT_ADJUST_REASONS = [
  "Issuance correction",
  "Imported balance fix",
  "Guest recovery",
  "Deactivate lost / stolen",
  "Manager approved",
] as const;

export const BREAK_GLASS_REASONS = [
  "Manager unreachable",
  "Guest waiting",
  "Quality / safety",
  "Other (logged)",
] as const;

export const GATED_AUDIT_ACTIONS = [
  "void",
  "comp",
  "discount",
  "no_sale",
  "reopen",
  "tender_change",
  "gift_adjust",
  "gift_deactivate",
  "paid_in",
  "paid_out",
  "drop",
  "manager_override",
  "pin_lockout",
  "over_short",
  "approval_pending",
  "break_glass",
] as const;

export type GatedAuditAction = (typeof GATED_AUDIT_ACTIONS)[number];

export const AUDIT_MAX_ENTRIES = 5000;

export const DEFAULT_DISCOUNT_CAPS: Record<EmployeeRole, DiscountCap> = {
  owner: { maxPercent: 100, maxCents: 0 },
  manager: { maxPercent: 50, maxCents: 0 },
  server: { maxPercent: 10, maxCents: 1000 },
  bartender: { maxPercent: 10, maxCents: 1000 },
  host: { maxPercent: 5, maxCents: 500 },
  cashier: { maxPercent: 10, maxCents: 1000 },
  kitchen: { maxPercent: 0, maxCents: 0 },
  busser: { maxPercent: 0, maxCents: 0 },
  vendor_operator: { maxPercent: 10, maxCents: 1000 },
  accountant: { maxPercent: 0, maxCents: 0 },
  kiosk: { maxPercent: 0, maxCents: 0 },
};

export const SHIFT_LEAD_ROLES: EmployeeRole[] = [
  "bartender",
  "host",
  "cashier",
  "server",
  "vendor_operator",
];

export const DEFAULT_SHIFT_LEAD_GRANTS: ShiftLeadGrant[] = [
  { role: "bartender", gates: [...DEFAULT_SHIFT_LEAD_GATES], maxCents: 2500 },
  { role: "host", gates: [...DEFAULT_SHIFT_LEAD_GATES], maxCents: 1500 },
];

export const DEFAULT_LOSS_PREVENTION: LossPreventionConfig = {
  pinLockoutAttempts: 5,
  managerSessionMinutes: 5,
  voidAfterSend: "manager",
  voidAfterBump: "manager",
  compAlwaysManager: true,
  discountAfterSend: "manager",
  discountCaps: { ...DEFAULT_DISCOUNT_CAPS },
  paidCheckReopen: "manager",
  giftAdjustManager: true,
  giftLoadRequiresTender: true,
  outlierMultiplier: 3,
  minSalesCentsForOutlier: 10000,
  shiftLeadGrants: DEFAULT_SHIFT_LEAD_GRANTS.map((g) => ({ ...g, gates: [...g.gates] })),
  pendingApproval: true,
  pendingRejectPolicy: "leave",
  remoteApprove: true,
  onCallList: [],
  breakGlass: false,
  voidCompBeforeSendCents: 500,
};

function asGate(raw: unknown, fallback: GateMode): GateMode {
  return raw === "off" || raw === "manager" ? raw : fallback;
}

function asCap(raw: unknown, fallback: DiscountCap): DiscountCap {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  return {
    maxPercent: Math.min(100, Math.max(0, Number(o.maxPercent) || 0)),
    maxCents: Math.max(0, Math.round(Number(o.maxCents) || 0)),
  };
}

function asGateKind(raw: unknown): ApprovalGateKind | null {
  const s = String(raw ?? "");
  return (APPROVAL_GATES as readonly string[]).includes(s) ? (s as ApprovalGateKind) : null;
}

function parseShiftLeadGrants(raw: unknown): ShiftLeadGrant[] {
  if (!Array.isArray(raw)) {
    return DEFAULT_SHIFT_LEAD_GRANTS.map((g) => ({ ...g, gates: [...g.gates] }));
  }
  const out: ShiftLeadGrant[] = [];
  for (const row of raw.slice(0, 12)) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const role = String(o.role ?? "") as EmployeeRole;
    if (!SHIFT_LEAD_ROLES.includes(role)) continue;
    const gates = Array.isArray(o.gates)
      ? o.gates.map(asGateKind).filter((g): g is ApprovalGateKind => !!g)
      : [...DEFAULT_SHIFT_LEAD_GATES];
    out.push({
      role,
      gates: gates.length ? gates : [...DEFAULT_SHIFT_LEAD_GATES],
      maxCents: Math.max(0, Math.round(Number(o.maxCents) || 0)),
    });
  }
  return out;
}

function parseOnCall(raw: unknown): OnCallContact[] {
  if (!Array.isArray(raw)) return [];
  const out: OnCallContact[] = [];
  for (const row of raw.slice(0, 12)) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const employeeId = String(o.employeeId ?? "").trim();
    const phone = String(o.phone ?? "").replace(/[^\d+]/g, "").slice(0, 20);
    if (!employeeId) continue;
    out.push({ employeeId: employeeId.slice(0, 40), phone });
  }
  return out;
}

export function parseLossPrevention(raw: unknown): LossPreventionConfig {
  const base = DEFAULT_LOSS_PREVENTION;
  if (!raw || typeof raw !== "object") {
    return {
      ...base,
      discountCaps: { ...DEFAULT_DISCOUNT_CAPS },
      shiftLeadGrants: DEFAULT_SHIFT_LEAD_GRANTS.map((g) => ({ ...g, gates: [...g.gates] })),
      onCallList: [],
    };
  }
  const o = raw as Record<string, unknown>;
  const caps: Partial<Record<EmployeeRole, DiscountCap>> = { ...DEFAULT_DISCOUNT_CAPS };
  if (o.discountCaps && typeof o.discountCaps === "object") {
    for (const [k, v] of Object.entries(o.discountCaps as Record<string, unknown>)) {
      if (k in DEFAULT_DISCOUNT_CAPS) {
        caps[k as EmployeeRole] = asCap(v, DEFAULT_DISCOUNT_CAPS[k as EmployeeRole]);
      }
    }
  }
  return {
    pinLockoutAttempts: Math.min(20, Math.max(3, Math.round(Number(o.pinLockoutAttempts) || base.pinLockoutAttempts))),
    managerSessionMinutes: Math.min(60, Math.max(1, Math.round(Number(o.managerSessionMinutes) || base.managerSessionMinutes))),
    voidAfterSend: asGate(o.voidAfterSend, base.voidAfterSend),
    voidAfterBump: asGate(o.voidAfterBump, base.voidAfterBump),
    compAlwaysManager: o.compAlwaysManager !== false,
    discountAfterSend: asGate(o.discountAfterSend, base.discountAfterSend),
    discountCaps: caps,
    paidCheckReopen: asGate(o.paidCheckReopen, base.paidCheckReopen),
    giftAdjustManager: o.giftAdjustManager !== false,
    giftLoadRequiresTender: o.giftLoadRequiresTender !== false,
    outlierMultiplier: Math.min(10, Math.max(1.5, Number(o.outlierMultiplier) || base.outlierMultiplier)),
    minSalesCentsForOutlier: Math.max(0, Math.round(Number(o.minSalesCentsForOutlier) || base.minSalesCentsForOutlier)),
    shiftLeadGrants: parseShiftLeadGrants(o.shiftLeadGrants),
    pendingApproval: o.pendingApproval !== false,
    pendingRejectPolicy: o.pendingRejectPolicy === "auto_void" ? "auto_void" : "leave",
    remoteApprove: o.remoteApprove !== false,
    onCallList: parseOnCall(o.onCallList),
    breakGlass: Boolean(o.breakGlass),
    voidCompBeforeSendCents: Math.max(0, Math.round(Number(o.voidCompBeforeSendCents) || 0)),
  };
}

export function isGatedAuditAction(action: string): action is GatedAuditAction {
  return (GATED_AUDIT_ACTIONS as readonly string[]).includes(action);
}

export function lineIsOnBumpedTicket(lineId: string, tickets: KitchenTicket[]): boolean {
  return tickets.some(
    (t) =>
      t.status === "bumped" &&
      t.items.some((i) => i.lineId === lineId),
  );
}

export function voidNeedsManager(
  line: OrderLine | undefined,
  tickets: KitchenTicket[],
  cfg: LossPreventionConfig,
  amountCents = 0,
): boolean {
  if (!line) return true;
  if (lineIsOnBumpedTicket(line.id, tickets)) return cfg.voidAfterBump === "manager";
  if (line.sent) return cfg.voidAfterSend === "manager";
  return amountCents > cfg.voidCompBeforeSendCents;
}

export function isManagerRole(role: EmployeeRole | string | null | undefined): boolean {
  return role === "owner" || role === "manager" || role === "manager_pin";
}

export function grantForRole(role: EmployeeRole | undefined, cfg: LossPreventionConfig): ShiftLeadGrant | null {
  if (!role) return null;
  return cfg.shiftLeadGrants.find((g) => g.role === role) ?? null;
}

export function canRoleApproveGate(
  role: EmployeeRole | string | null | undefined,
  kind: ApprovalGateKind,
  amountCents: number,
  cfg: LossPreventionConfig,
): boolean {
  if (isManagerRole(role)) return true;
  const grant = grantForRole(role as EmployeeRole, cfg);
  if (!grant) return false;
  if (!grant.gates.includes(kind)) return false;
  if (grant.maxCents > 0 && amountCents > grant.maxCents) return false;
  return true;
}

export function underVoidCompThreshold(
  sent: boolean,
  amountCents: number,
  cfg: LossPreventionConfig,
): boolean {
  return !sent && amountCents <= cfg.voidCompBeforeSendCents;
}

export function reasonsForGate(kind: ApprovalGateKind): readonly string[] {
  switch (kind) {
    case "void":
      return VOID_REASONS;
    case "comp":
      return COMP_REASONS;
    case "discount":
      return DISCOUNT_REASONS;
    case "no_sale":
      return NO_SALE_REASONS;
    case "reopen":
      return REOPEN_REASONS;
    case "tender_swap":
      return TENDER_SWAP_REASONS;
    case "gift_adjust":
      return GIFT_ADJUST_REASONS;
    default:
      return VOID_REASONS;
  }
}

export function discountNeedsManager(order: Order, cfg: LossPreventionConfig): boolean {
  if (cfg.discountAfterSend === "off") return false;
  return order.lines.some((l) => l.sent && !l.voided);
}

export function capForRole(role: EmployeeRole | undefined, cfg: LossPreventionConfig): DiscountCap {
  if (!role) return { maxPercent: 0, maxCents: 0 };
  return cfg.discountCaps[role] ?? DEFAULT_DISCOUNT_CAPS[role] ?? { maxPercent: 0, maxCents: 0 };
}

export function lineGrossCents(line: Pick<OrderLine, "unitPriceCents" | "quantity" | "modifiers" | "voided" | "comped">): number {
  if (line.voided || line.comped) return 0;
  const mods = line.modifiers.reduce((s, m) => s + m.priceCents, 0);
  return (line.unitPriceCents + mods) * line.quantity;
}

export function orderMerchandiseCents(order: Order): number {
  return order.lines.reduce((s, l) => s + lineGrossCents(l), 0);
}

/** Rejects (does not silently cap) a discount that exceeds the role's total cap. */
export function discountAllowed(opts: {
  order: Order;
  percent?: number;
  cents?: number;
  role: EmployeeRole | undefined;
  cfg: LossPreventionConfig;
  managerOverride: boolean;
}): { ok: true } | { ok: false; error: string } {
  const merch = orderMerchandiseCents(opts.order);
  const nextPct = opts.percent ?? opts.order.discountPercent ?? 0;
  const nextCents = opts.cents ?? opts.order.discountCents ?? 0;
  const fromPct = Math.round((merch * Math.max(0, nextPct)) / 100);
  const totalDisc = fromPct + Math.max(0, nextCents);
  const roleCap = capForRole(opts.role, opts.cfg);
  const mgrCap = capForRole("manager", opts.cfg);
  const cap = opts.managerOverride ? mgrCap : roleCap;
  const capCents =
    cap.maxCents > 0 ? Math.min(merch, Math.round((merch * cap.maxPercent) / 100) + cap.maxCents) : Math.round((merch * cap.maxPercent) / 100);
  if (cap.maxPercent <= 0 && cap.maxCents <= 0 && totalDisc > 0 && !opts.managerOverride) {
    return { ok: false, error: "This role cannot discount. Ask a manager." };
  }
  if (totalDisc > capCents + 1) {
    return {
      ok: false,
      error: opts.managerOverride
        ? "Discount exceeds the manager cap for this location."
        : "Discount exceeds this role's cap. Ask a manager — stacking is not applied silently.",
    };
  }
  return { ok: true };
}

export function odsBlocksTender(deviceRole: DeviceRole | null | undefined, method: PaymentMethod): boolean {
  if (deviceRole !== "ods") return false;
  return method === "cash" || method === "gift_card";
}

export function realTenderOnOrder(order: Order): boolean {
  return order.payments.some((p) => p.method === "cash" || p.method === "card" || p.method === "room_charge");
}

export function snapshotPayments(order: Order): string {
  return JSON.stringify(
    order.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amountCents: p.amountCents,
      tipCents: p.tipCents,
    })),
  );
}

export type ExceptionMetric =
  | "voids"
  | "comps"
  | "discounts"
  | "no_sales"
  | "over_short"
  | "gift_adjusts"
  | "reopens"
  | "tip_declare"
  | "inventory";

export type ExceptionRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  metric: ExceptionMetric;
  period: "day" | "week";
  employeeAmountCents: number;
  employeeCount: number;
  employeePct: number | null;
  housePct: number | null;
  weekdayPct: number | null;
  ratioToHouse: number | null;
  flagged: boolean;
  salesCents: number;
  label: string;
};

export type AuditLike = {
  at: number;
  employeeId: string;
  employeeName: string;
  action: string;
  amountCents?: number;
};

export type CloseoutLike = {
  employeeId: string;
  employeeName: string;
  at: number;
  overShortCents?: number | null;
  cashTipsDeclaredCents?: number;
  cardTipsCents?: number;
  sales?: { totalSalesCents?: number };
};

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function inRange(at: number, from: number, to: number): boolean {
  return at >= from && at < to;
}

function weekdayIndex(ts: number): number {
  return new Date(ts).getDay();
}

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return part / whole;
}

function ratio(emp: number | null, house: number | null): number | null {
  if (emp == null || house == null || house <= 0) return null;
  return emp / house;
}

export function buildExceptionRows(opts: {
  now?: number;
  period: "day" | "week";
  cfg: LossPreventionConfig;
  employees: Employee[];
  orders: Order[];
  auditLog: AuditLike[];
  closeouts: CloseoutLike[];
}): ExceptionRow[] {
  const now = opts.now ?? Date.now();
  const periodMs = opts.period === "day" ? 86_400_000 : 7 * 86_400_000;
  const from = opts.period === "day" ? startOfDay(now) : now - periodMs;
  const to = now + 1;
  const weekday = weekdayIndex(now);
  const lookbackFrom = from - 8 * 7 * 86_400_000;

  const ordersIn = opts.orders.filter((o) => inRange(o.closedAt ?? o.createdAt, from, to));
  const houseSales = ordersIn.reduce((s, o) => s + orderMerchandiseCents(o), 0);
  const houseVoids = ordersIn.reduce(
    (s, o) => s + o.lines.filter((l) => l.voided).reduce((a, l) => a + lineGrossCents({ ...l, voided: false, comped: false }), 0),
    0,
  );
  const houseComps = ordersIn.reduce(
    (s, o) => s + o.lines.filter((l) => l.comped && !l.voided).reduce((a, l) => a + lineGrossCents({ ...l, voided: false, comped: false }), 0),
    0,
  );
  const houseDisc = ordersIn.reduce((s, o) => {
    const merch = orderMerchandiseCents(o);
    return s + Math.round((merch * (o.discountPercent || 0)) / 100) + (o.discountCents || 0);
  }, 0);

  const weekdayOrders = opts.orders.filter((o) => {
    const t = o.closedAt ?? o.createdAt;
    return t >= lookbackFrom && t < from && weekdayIndex(t) === weekday;
  });
  const weekdaySales = weekdayOrders.reduce((s, o) => s + orderMerchandiseCents(o), 0);
  const weekdayVoids = weekdayOrders.reduce(
    (s, o) => s + o.lines.filter((l) => l.voided).reduce((a, l) => a + lineGrossCents({ ...l, voided: false, comped: false }), 0),
    0,
  );
  const weekdayComps = weekdayOrders.reduce(
    (s, o) => s + o.lines.filter((l) => l.comped && !l.voided).reduce((a, l) => a + lineGrossCents({ ...l, voided: false, comped: false }), 0),
    0,
  );
  const weekdayDisc = weekdayOrders.reduce((s, o) => {
    const merch = orderMerchandiseCents(o);
    return s + Math.round((merch * (o.discountPercent || 0)) / 100) + (o.discountCents || 0);
  }, 0);

  const houseVoidPct = pct(houseVoids, houseSales);
  const houseCompPct = pct(houseComps, houseSales);
  const houseDiscPct = pct(houseDisc, houseSales);
  const wdVoidPct = pct(weekdayVoids, weekdaySales);
  const wdCompPct = pct(weekdayComps, weekdaySales);
  const wdDiscPct = pct(weekdayDisc, weekdaySales);

  const auditIn = opts.auditLog.filter((a) => inRange(a.at, from, to));
  const noSalesHouse = auditIn.filter((a) => a.action === "no_sale").length;
  const reopenHouse = auditIn.filter((a) => a.action === "reopen").length;
  const giftAdjHouse = auditIn.filter((a) => a.action === "gift_adjust" || a.action === "gift_deactivate").length;

  const staff = opts.employees.filter((e) => e.active && e.role !== "kiosk");
  const rows: ExceptionRow[] = [];
  const min = opts.cfg.minSalesCentsForOutlier;
  const mult = opts.cfg.outlierMultiplier;

  const flagPct = (empPct: number | null, housePct: number | null, sales: number) => {
    if (sales < min) return false;
    const r = ratio(empPct, housePct);
    return r != null && r >= mult && (empPct ?? 0) > 0;
  };

  for (const emp of staff) {
    const mine = ordersIn.filter((o) => o.serverId === emp.id);
    const sales = mine.reduce((s, o) => s + orderMerchandiseCents(o), 0);
    const voids = mine.reduce(
      (s, o) => s + o.lines.filter((l) => l.voided).reduce((a, l) => a + lineGrossCents({ ...l, voided: false, comped: false }), 0),
      0,
    );
    const comps = mine.reduce(
      (s, o) => s + o.lines.filter((l) => l.comped && !l.voided).reduce((a, l) => a + lineGrossCents({ ...l, voided: false, comped: false }), 0),
      0,
    );
    const discs = mine.reduce((s, o) => {
      const merch = orderMerchandiseCents(o);
      return s + Math.round((merch * (o.discountPercent || 0)) / 100) + (o.discountCents || 0);
    }, 0);
    const myAudit = auditIn.filter((a) => a.employeeId === emp.id);
    const noSales = myAudit.filter((a) => a.action === "no_sale").length;
    const reopens = myAudit.filter((a) => a.action === "reopen").length;
    const giftAdj = myAudit.filter((a) => a.action === "gift_adjust" || a.action === "gift_deactivate").length;
    const overShort = opts.closeouts
      .filter((c) => c.employeeId === emp.id && inRange(c.at, from, to))
      .reduce((s, c) => s + Math.abs(c.overShortCents ?? 0), 0);
    const declared = opts.closeouts
      .filter((c) => c.employeeId === emp.id && inRange(c.at, from, to))
      .reduce((s, c) => s + (c.cashTipsDeclaredCents ?? 0), 0);
    const cardTips = mine.reduce(
      (s, o) => s + o.payments.filter((p) => p.method === "card").reduce((a, p) => a + (p.tipCents || 0), 0),
      0,
    );

    const voidPct = pct(voids, sales);
    const compPct = pct(comps, sales);
    const discPct = pct(discs, sales);

    const push = (
      metric: ExceptionMetric,
      amount: number,
      count: number,
      empPct: number | null,
      houseP: number | null,
      wdP: number | null,
      flagged: boolean,
      label: string,
    ) => {
      if (amount === 0 && count === 0 && !flagged) return;
      const r = ratio(empPct, houseP);
      rows.push({
        id: `${opts.period}:${emp.id}:${metric}:${from}`,
        employeeId: emp.id,
        employeeName: emp.name,
        metric,
        period: opts.period,
        employeeAmountCents: amount,
        employeeCount: count,
        employeePct: empPct,
        housePct: houseP,
        weekdayPct: wdP,
        ratioToHouse: r,
        flagged,
        salesCents: sales,
        label,
      });
    };

    push(
      "voids",
      voids,
      mine.reduce((n, o) => n + o.lines.filter((l) => l.voided).length, 0),
      voidPct,
      houseVoidPct,
      wdVoidPct,
      flagPct(voidPct, houseVoidPct, sales),
      "Voids vs house",
    );
    push(
      "comps",
      comps,
      mine.reduce((n, o) => n + o.lines.filter((l) => l.comped && !l.voided).length, 0),
      compPct,
      houseCompPct,
      wdCompPct,
      flagPct(compPct, houseCompPct, sales),
      "Comps vs house",
    );
    push(
      "discounts",
      discs,
      mine.filter((o) => (o.discountPercent || 0) > 0 || (o.discountCents || 0) > 0).length,
      discPct,
      houseDiscPct,
      wdDiscPct,
      flagPct(discPct, houseDiscPct, sales),
      "Discounts vs house",
    );

    const noSaleFlag = noSalesHouse > 0 && noSales >= Math.max(3, noSalesHouse * (mult / staff.length) * staff.length);
    push(
      "no_sales",
      0,
      noSales,
      noSalesHouse > 0 ? noSales / Math.max(1, noSalesHouse) : null,
      noSalesHouse > 0 ? 1 / Math.max(1, staff.length) : null,
      null,
      noSales >= 3 && noSalesHouse > 0 && noSales >= noSalesHouse * 0.4,
      "No-sales",
    );
    void noSaleFlag;
    push(
      "reopens",
      0,
      reopens,
      reopenHouse > 0 ? reopens / Math.max(1, reopenHouse) : null,
      reopenHouse > 0 ? 1 / Math.max(1, staff.length) : null,
      null,
      reopens >= 2 && reopenHouse > 0 && reopens >= Math.max(2, Math.ceil(reopenHouse * 0.4)),
      "Paid-check reopens",
    );
    push(
      "gift_adjusts",
      myAudit.filter((a) => a.action === "gift_adjust").reduce((s, a) => s + Math.abs(a.amountCents ?? 0), 0),
      giftAdj,
      giftAdjHouse > 0 ? giftAdj / Math.max(1, giftAdjHouse) : null,
      null,
      null,
      giftAdj >= 2,
      "Gift adjustments",
    );
    push(
      "over_short",
      overShort,
      opts.closeouts.filter((c) => c.employeeId === emp.id && inRange(c.at, from, to) && Math.abs(c.overShortCents ?? 0) > 0).length,
      null,
      null,
      null,
      overShort > 0,
      "Over/short",
    );
    const tipMixFlag =
      sales >= min &&
      declared > 0 &&
      cardTips >= 0 &&
      declared > cardTips * mult &&
      declared > sales * 0.15;
    push(
      "tip_declare",
      declared,
      0,
      pct(declared, sales),
      pct(cardTips, sales),
      null,
      tipMixFlag,
      "Declared cash tips vs card tips / sales",
    );
  }

  return rows.sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.employeeAmountCents - a.employeeAmountCents);
}

export function formatPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
