import type {
  Chargeback,
  ChargebackAllocation,
  Order,
  Payment,
  SettlementConfig,
  SettlementPeriod,
  Vendor,
  VendorPeriodRow,
} from "./types";
import { lineTotal, computeTotals, policyForTender } from "./calculations";
import { SETTINGS } from "./seed";
import { CHARGEBACK_FEE_CENTS } from "@/lib/platform/brand";
import type { RestaurantSettings } from "./types";
import type { CashDiscountPolicy } from "./cash-discount";

export { CHARGEBACK_FEE_CENTS };

/** Pre-tax sales for a vendor on one order (active, non-comp lines). */
export function vendorSubtotalOnOrder(
  order: Order,
  vendorId: string,
  policy: CashDiscountPolicy | null = null,
): number {
  return order.lines
    .filter((l) => !l.voided && !l.comped && l.vendorId === vendorId)
    .reduce((s, l) => s + lineTotal(l, policy), 0);
}

export function orderVendorSubtotals(
  order: Order,
  vendorIds: string[],
  policy: CashDiscountPolicy | null = null,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const id of vendorIds) map.set(id, 0);
  for (const line of order.lines) {
    if (line.voided || line.comped) continue;
    const vid = line.vendorId ?? "unknown";
    map.set(vid, (map.get(vid) ?? 0) + lineTotal(line, policy));
  }
  return map;
}

export function orderMerchandiseSubtotal(
  order: Order,
  policy: CashDiscountPolicy | null = null,
): number {
  return order.lines
    .filter((l) => !l.voided && !l.comped)
    .reduce((s, l) => s + lineTotal(l, policy), 0);
}

/**
 * Attribute tender to vendors by product share only (tax/service stay with host).
 * `payment.amountCents` is the tender applied to the check (not tip).
 */
export function allocatePaymentToVendors(
  order: Order,
  payment: Pick<Payment, "method" | "amountCents">,
  vendorIds: string[],
  settings: RestaurantSettings = SETTINGS,
): { vendorId: string; amountCents: number; method: "card" | "cash" | "other" }[] {
  const method: "card" | "cash" | "other" =
    payment.method === "card" || payment.method === "room_charge"
      ? "card"
      : payment.method === "cash"
        ? "cash"
        : "other";

  const policy = policyForTender(settings, payment.method);
  const merch = orderMerchandiseSubtotal(order, policy);
  if (merch <= 0 || payment.amountCents <= 0) return [];

  // Only the merchandise share of this tender is vendor-attributable
  const totals = computeTotals(order, settings, { tender: payment.method });
  const checkTotal = Math.max(1, totals.totalCents);
  const merchShareOfTender = Math.round(
    payment.amountCents * (merch / checkTotal),
  );

  const subs = orderVendorSubtotals(order, vendorIds, policy);
  const result: {
    vendorId: string;
    amountCents: number;
    method: "card" | "cash" | "other";
  }[] = [];
  let allocated = 0;
  const entries = [...subs.entries()].filter(([, v]) => v > 0);

  entries.forEach(([vendorId, sub], i) => {
    const isLast = i === entries.length - 1;
    const share = isLast
      ? merchShareOfTender - allocated
      : Math.round((merchShareOfTender * sub) / merch);
    allocated += share;
    result.push({ vendorId, amountCents: Math.max(0, share), method });
  });
  return result;
}

export interface VendorLedgerAgg {
  vendorId: string;
  grossSalesCents: number;
  cardSalesCents: number;
  cashSalesCents: number;
  otherSalesCents: number;
  orderCount: number;
}

export function aggregateVendorSales(
  orders: Order[],
  vendors: Vendor[],
  periodStart: number,
  periodEnd: number,
  settings: RestaurantSettings = SETTINGS,
): VendorLedgerAgg[] {
  const byId = new Map<string, VendorLedgerAgg>();
  for (const v of vendors) {
    byId.set(v.id, {
      vendorId: v.id,
      grossSalesCents: 0,
      cardSalesCents: 0,
      cashSalesCents: 0,
      otherSalesCents: 0,
      orderCount: 0,
    });
  }

  for (const order of orders) {
    if (order.status !== "closed") continue;
    const closedAt = order.closedAt ?? order.createdAt;
    if (closedAt < periodStart || closedAt > periodEnd) continue;

    const cashPol = policyForTender(settings, "cash");
    const printedPol = null;
    const paidCash = order.payments.some((p) => p.method === "cash");
    const merchPolicy = paidCash && !order.payments.some((p) => p.method === "card" || p.method === "room_charge")
      ? cashPol
      : printedPol;
    const merchandise = orderMerchandiseSubtotal(order, merchPolicy);
    if (merchandise <= 0) continue;

    const vendorIds = vendors.map((v) => v.id);
    const subs = orderVendorSubtotals(order, vendorIds, merchPolicy);
    const vendorsOnOrder = [...subs.entries()].filter(([, s]) => s > 0);
    for (const [vid] of vendorsOnOrder) {
      const row = byId.get(vid);
      if (row) row.orderCount += 1;
    }

    for (const [vid, sub] of subs) {
      const row = byId.get(vid);
      if (row) row.grossSalesCents += sub;
    }

    for (const pay of order.payments) {
      if (pay.method === "comp") continue;
      const parts = allocatePaymentToVendors(order, pay, vendorIds, settings);
      for (const p of parts) {
        const row = byId.get(p.vendorId);
        if (!row) continue;
        if (p.method === "card") row.cardSalesCents += p.amountCents;
        else if (p.method === "cash") row.cashSalesCents += p.amountCents;
        else row.otherSalesCents += p.amountCents;
      }
    }
  }

  return [...byId.values()];
}

/**
 * $35 Quantum Payments dispute fee, split by merchandise share on that check.
 * Single-operator check → full $35. No fee unless a dispute is filed.
 * Fee applies whether the dispute is later won or lost.
 */
export function allocateChargebackFee(
  order: Order,
  vendors: Vendor[],
  feeCents = CHARGEBACK_FEE_CENTS,
): ChargebackAllocation[] {
  const vendorIds = vendors.map((v) => v.id);
  const subs = orderVendorSubtotals(order, vendorIds);
  const entries = [...subs.entries()].filter(([, merch]) => merch > 0);
  const total = entries.reduce((s, [, m]) => s + m, 0);
  if (entries.length === 0 || total <= 0 || feeCents <= 0) return [];
  if (entries.length === 1) {
    const [vendorId, merchCents] = entries[0]!;
    const vendor = vendors.find((v) => v.id === vendorId);
    return [
      {
        vendorId,
        vendorName: vendor?.name ?? vendorId,
        merchCents,
        shareBps: 10000,
        feeCents,
      },
    ];
  }
  let allocated = 0;
  return entries.map(([vendorId, merchCents], i) => {
    const isLast = i === entries.length - 1;
    const fee = isLast
      ? feeCents - allocated
      : Math.round((feeCents * merchCents) / total);
    allocated += fee;
    const vendor = vendors.find((v) => v.id === vendorId);
    return {
      vendorId,
      vendorName: vendor?.name ?? vendorId,
      merchCents,
      shareBps: Math.round((merchCents / total) * 10000),
      feeCents: Math.max(0, fee),
    };
  });
}

export function buildPeriodSettlement(
  config: SettlementConfig,
  vendors: Vendor[],
  orders: Order[],
  periodStart: number,
  periodEnd: number,
  closedBy: string,
  chargebacks: Chargeback[] = [],
  settings: RestaurantSettings = SETTINGS,
): SettlementPeriod {
  const aggs = aggregateVendorSales(orders, vendors, periodStart, periodEnd, settings);
  let guestCardPaidCents = 0;
  for (const order of orders) {
    if (order.status !== "closed") continue;
    const closedAt = order.closedAt ?? order.createdAt;
    if (closedAt < periodStart || closedAt > periodEnd) continue;
    for (const p of order.payments) {
      if (p.method === "card" || p.method === "room_charge") guestCardPaidCents += p.amountCents + (p.tipCents || 0);
    }
  }
  const feePct = config.cardFeePercent / 100;
  const hostPct = config.hostCutEnabled ? config.hostCutPercent / 100 : 0;
  const cbByVendor = new Map<string, number>();
  for (const cb of chargebacks) {
    if (cb.filedAt < periodStart || cb.filedAt > periodEnd) continue;
    for (const a of cb.allocations) {
      cbByVendor.set(a.vendorId, (cbByVendor.get(a.vendorId) ?? 0) + a.feeCents);
    }
  }

  const rows: VendorPeriodRow[] = aggs.map((a) => {
    const vendor = vendors.find((v) => v.id === a.vendorId)!;
    // Fees only on card-tendered product sales
    const cardFeesCents = Math.round(a.cardSalesCents * feePct);
    let hostCutCents = 0;
    if (config.hostCutEnabled) {
      if (config.hostCutType === "percent_of_gross") {
        hostCutCents = Math.round(a.grossSalesCents * hostPct);
      } else if (config.hostCutType === "fixed_per_vendor") {
        hostCutCents =
          a.grossSalesCents > 0 || a.orderCount > 0
            ? config.hostCutFixedCents
            : 0;
      }
    }
    const tenderBase = a.cardSalesCents + a.cashSalesCents + a.otherSalesCents;
    const hostFromCard =
      tenderBase > 0
        ? Math.round(hostCutCents * (a.cardSalesCents / tenderBase))
        : hostCutCents;
    const hostFromCash = Math.max(0, hostCutCents - hostFromCard);

    const chargebackFeeCents = cbByVendor.get(a.vendorId) ?? 0;
    const cardPayoutCents = Math.max(
      0,
      a.cardSalesCents - cardFeesCents - hostFromCard - chargebackFeeCents,
    );
    const cashDueCents = Math.max(0, a.cashSalesCents - hostFromCash);

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      grossSalesCents: a.grossSalesCents,
      cardSalesCents: a.cardSalesCents,
      cashSalesCents: a.cashSalesCents,
      otherSalesCents: a.otherSalesCents,
      cardFeesCents,
      hostCutCents,
      hostCutFromCardCents: hostFromCard,
      hostCutFromCashCents: hostFromCash,
      cardPayoutCents,
      cashDueCents,
      netElectronicPayoutCents: cardPayoutCents,
      totalVendorDueCents: cardPayoutCents + cashDueCents,
      orderCount: a.orderCount,
      bankLast4: vendor.bankLast4,
      payoutAccountLabel: vendor.bankLabel,
      chargebackFeeCents,
    };
  });

  const hostTotal = rows.reduce((s, r) => s + r.hostCutCents, 0);
  const feesTotal = rows.reduce((s, r) => s + r.cardFeesCents, 0);
  const cbTotal = rows.reduce((s, r) => s + r.chargebackFeeCents, 0);

  return {
    id: `sp_${periodStart}_${periodEnd}`,
    locationId: config.locationId,
    locationName: config.locationName,
    periodStart,
    periodEnd,
    closedAt: Date.now(),
    closedBy,
    cardFeePercent: config.cardFeePercent,
    hostCutEnabled: config.hostCutEnabled,
    hostName: config.hostName,
    hostCutTotalCents: hostTotal,
    cardFeesTotalCents: feesTotal,
    chargebackFeesTotalCents: cbTotal,
    guestCardPaidCents,
    rows,
    status: "closed",
  };
}

export function nextPeriodEnd(config: SettlementConfig, from: number): number {
  const d = new Date(from);
  switch (config.periodType) {
    case "daily": {
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      if (end.getTime() <= from) end.setDate(end.getDate() + 1);
      return end.getTime();
    }
    case "weekly": {
      const end = new Date(d);
      const day = end.getDay();
      const add = (7 - day) % 7 || 7;
      end.setDate(end.getDate() + add);
      end.setHours(23, 59, 59, 999);
      return end.getTime();
    }
    case "biweekly": {
      const end = new Date(d);
      end.setDate(end.getDate() + 14);
      end.setHours(23, 59, 59, 999);
      return end.getTime();
    }
    case "monthly": {
      const end = new Date(
        d.getFullYear(),
        d.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      if (end.getTime() <= from) {
        return new Date(
          d.getFullYear(),
          d.getMonth() + 2,
          0,
          23,
          59,
          59,
          999,
        ).getTime();
      }
      return end.getTime();
    }
    case "custom_days": {
      const days = Math.max(1, config.customPeriodDays || 7);
      return from + days * 24 * 60 * 60 * 1000;
    }
    default:
      return from + 7 * 24 * 60 * 60 * 1000;
  }
}

export function periodStartOfDay(ts = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
