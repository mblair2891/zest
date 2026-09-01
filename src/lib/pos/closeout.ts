import { linePrintedCents, lineUnitTotal } from "./calculations";
import type { Employee, Order, OrderLine } from "./types";
import type {
  CashHandlingConfig,
  CashSink,
  CcTipPayout,
  TipOutBasis,
  TipOutCategory,
  TipOutPool,
  TipOutRole,
} from "./cash-handling";
export type { TipOutBasis, TipOutCategory, TipOutPool, TipOutRole, CcTipPayout };

export type CloseoutStatus = "closed" | "pending" | "over_short";

export type TipOutLine = {
  poolId: string;
  label: string;
  role: TipOutRole;
  category: TipOutCategory;
  percent: number;
  recommendedCents: number;
  actualCents: number;
  entityId?: string | null;
  note?: string;
};

export type CloseoutSales = {
  guests: number;
  itemQty: number;
  compsCents: number;
  voidsCents: number;
  foodSalesCents: number;
  drinkSalesCents: number;
  totalSalesCents: number;
  cardCents: number;
  cashCents: number;
  giftCents: number;
  cardTipsCents: number;
  cashTipsOnTendersCents: number;
  autoGratCents?: number;
  serviceChargeCents?: number;
};

export type ServerCloseout = {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  at: number;
  status: CloseoutStatus;
  sales: CloseoutSales;
  cardTipsCents: number;
  cardTipsAdjusted: boolean;
  cashTipsDeclaredCents: number;
  countedCents: number | null;
  expectedCents: number | null;
  overShortCents: number | null;
  overShortNote?: string;
  countedBlind: boolean;
  skippedDrawerCount: boolean;
  tipOuts: TipOutLine[];
  tipOutBasis: TipOutBasis;
  ccTipPayout: CcTipPayout;
  cardTipsCashDueCents: number;
  cardTipsToPayrollCents: number;
  declaredCashDueCents: number;
  ownTipsCents?: number;
  poolInCents?: number;
  poolOutCents?: number;
  poolHeldCents?: number;
  netTipsCents?: number;
  netDueNowCents?: number;
  netToPayrollCents?: number;
  poolLines?: { key: string; label: string; inCents: number; outCents: number }[];
  dropsCents: number;
  paidInCents: number;
  paidOutCents: number;
  openCheckCount: number;
  pendingReason?: string;
  pinConfirmed: boolean;
};

export function isDrinkLine(line: Pick<OrderLine, "station" | "course">): boolean {
  return line.station === "bar" || line.course === "drink";
}

export function ordersForServer(orders: Order[], employeeId: string): Order[] {
  return orders.filter((o) => o.serverId === employeeId);
}

export function summarizeServerSales(orders: Order[], employeeId: string): CloseoutSales {
  const mine = ordersForServer(orders, employeeId);
  let guests = 0;
  let itemQty = 0;
  let compsCents = 0;
  let voidsCents = 0;
  let foodSalesCents = 0;
  let drinkSalesCents = 0;
  let cardCents = 0;
  let cashCents = 0;
  let giftCents = 0;
  let cardTipsCents = 0;
  let cashTipsOnTendersCents = 0;
  let autoGratCents = 0;
  let serviceChargeCents = 0;
  for (const o of mine) {
    if (o.status === "voided" || o.status === "cancelled") continue;
    guests += Math.max(0, o.guestCount || 0);
    for (const line of o.lines) {
      const printed = linePrintedCents(line);
      const raw = lineUnitTotal(line) * line.quantity;
      if (line.voided) {
        voidsCents += raw;
        continue;
      }
      itemQty += line.quantity;
      if (line.comped) {
        compsCents += raw;
        continue;
      }
      if (isDrinkLine(line)) drinkSalesCents += printed;
      else foodSalesCents += printed;
    }
    for (const p of o.payments) {
      if (p.method === "card" || p.method === "room_charge") {
        cardCents += p.amountCents;
        cardTipsCents += p.tipCents || 0;
      } else if (p.method === "cash") {
        cashCents += p.amountCents;
        cashTipsOnTendersCents += p.tipCents || 0;
      } else if (p.method === "gift_card") {
        giftCents += p.amountCents;
      }
    }
    const sc = Math.max(0, o.serviceChargeCents || 0);
    if (o.autoGratApplied) autoGratCents += sc;
    else serviceChargeCents += sc;
  }
  return {
    guests,
    itemQty,
    compsCents,
    voidsCents,
    foodSalesCents,
    drinkSalesCents,
    totalSalesCents: foodSalesCents + drinkSalesCents,
    cardCents,
    cashCents,
    giftCents,
    cardTipsCents,
    cashTipsOnTendersCents,
    autoGratCents,
    serviceChargeCents,
  };
}

export function recommendTipOuts(opts: {
  sales: CloseoutSales;
  pools: TipOutPool[];
  basis: TipOutBasis;
  tipPoolCents?: number;
}): TipOutLine[] {
  const food = Math.max(0, opts.sales.foodSalesCents);
  const drink = Math.max(0, opts.sales.drinkSalesCents);
  const total = Math.max(0, opts.sales.totalSalesCents);
  const covers = Math.max(0, opts.sales.guests);
  const mixTotal = food + drink;
  const foodShare = mixTotal > 0 ? food / mixTotal : 0;
  const drinkShare = mixTotal > 0 ? drink / mixTotal : 0;
  const tips =
    opts.tipPoolCents ??
    opts.sales.cardTipsCents + opts.sales.cashTipsOnTendersCents;

  return opts.pools.map((pool) => {
    const pct = Math.max(0, Number(pool.percent) || 0);
    let base = 0;
    if (opts.basis === "tips_by_mix") {
      const share =
        pool.category === "food"
          ? foodShare
          : pool.category === "drink"
            ? drinkShare
            : 1;
      base = Math.round(tips * share);
    } else if (pool.category === "food") base = food;
    else if (pool.category === "drink") base = drink;
    else if (pool.category === "covers") base = covers * 100;
    else base = total;
    const recommendedCents = Math.round((base * pct) / 100);
    return {
      poolId: pool.id,
      label: pool.label,
      role: pool.role,
      category: pool.category,
      percent: pct,
      recommendedCents,
      actualCents: recommendedCents,
      entityId: pool.entityId ?? null,
    };
  });
}

export function shouldCountCashOnCloseout(opts: {
  sink: CashSink;
  emp: Pick<Employee, "id" | "role">;
  cfg: CashHandlingConfig;
}): boolean {
  const { sink, emp, cfg } = opts;
  if (sink.type === "blocked") return false;
  if (sink.type === "bank") return true;
  if (sink.type === "drawer") {
    const d = sink.drawer;
    const assigned = d.assignedEmployeeIds.includes(emp.id);
    const single = d.assignedEmployeeIds.length <= 1 || cfg.defaultModel === "single_user_drawer";
    if (d.kind === "well" && !single) return false;
    if (d.kind === "well" && cfg.defaultModel === "shared_drawer") return false;
    if (d.kind === "well" && cfg.defaultModel === "well_plus_server_bank") return false;
    return assigned || single;
  }
  return false;
}

export function blindCountEnabled(cfg: CashHandlingConfig, counting: boolean): boolean {
  return counting && cfg.blindCount;
}

function csvEsc(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function dollars(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

/** Payroll-ready closeout CSV (hours file can ingest this later). Not a payroll run. */
export function closeoutPayrollCsv(records: ServerCloseout[]): string {
  const header = [
    "employee_id",
    "employee_name",
    "role",
    "closed_at",
    "status",
    "guests",
    "items",
    "food_sales",
    "drink_sales",
    "total_sales",
    "card",
    "cash",
    "gift",
    "cc_tip_payout",
    "card_tips",
    "card_tips_cash_due",
    "card_tips_to_payroll",
    "declared_cash_tips",
    "declared_cash_due",
    "own_tips",
    "pool_in",
    "pool_out",
    "pool_held",
    "net_tips",
    "net_due_now",
    "net_to_payroll",
    "counted",
    "expected",
    "over_short",
    "blind",
    "skipped_drawer",
    "drops",
    "paid_in",
    "paid_out",
    "pool",
    "pool_role",
    "pool_category",
    "pool_percent",
    "tipout_recommended",
    "tipout_actual",
    "pool_note",
  ];
  const rows: string[] = [];
  for (const r of records) {
    const at = new Date(r.at).toISOString();
    const pools = r.tipOuts.length ? r.tipOuts : [null];
    for (const p of pools) {
      rows.push(
        [
          csvEsc(r.employeeId),
          csvEsc(r.employeeName),
          csvEsc(r.role),
          csvEsc(at),
          csvEsc(r.status),
          r.sales.guests,
          r.sales.itemQty,
          dollars(r.sales.foodSalesCents),
          dollars(r.sales.drinkSalesCents),
          dollars(r.sales.totalSalesCents),
          dollars(r.sales.cardCents),
          dollars(r.sales.cashCents),
          dollars(r.sales.giftCents),
          csvEsc(r.ccTipPayout ?? ""),
          dollars(r.cardTipsCents),
          dollars(r.cardTipsCashDueCents),
          dollars(r.cardTipsToPayrollCents),
          dollars(r.cashTipsDeclaredCents),
          dollars(r.declaredCashDueCents),
          dollars(r.ownTipsCents),
          dollars(r.poolInCents),
          dollars(r.poolOutCents),
          dollars(r.poolHeldCents),
          dollars(r.netTipsCents),
          dollars(r.netDueNowCents),
          dollars(r.netToPayrollCents),
          dollars(r.countedCents),
          dollars(r.expectedCents),
          dollars(r.overShortCents),
          r.countedBlind ? "Y" : "N",
          r.skippedDrawerCount ? "Y" : "N",
          dollars(r.dropsCents),
          dollars(r.paidInCents),
          dollars(r.paidOutCents),
          csvEsc(p?.label ?? ""),
          csvEsc(p?.role ?? ""),
          csvEsc(p?.category ?? ""),
          p ? String(p.percent) : "",
          p ? dollars(p.recommendedCents) : "",
          p ? dollars(p.actualCents) : "",
          csvEsc(p?.note ?? ""),
        ].join(","),
      );
    }
  }
  return [header.join(","), ...rows].join("\n");
}


