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

export function parseLossPrevention(raw: unknown): LossPreventionConfig {
  const base = DEFAULT_LOSS_PREVENTION;
  if (!raw || typeof raw !== "object") return { ...base, discountCaps: { ...DEFAULT_DISCOUNT_CAPS } };
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
): boolean {
  if (!line) return true;
  if (lineIsOnBumpedTicket(line.id, tickets)) return cfg.voidAfterBump === "manager";
  if (line.sent) return cfg.voidAfterSend === "manager";
  return false;
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
