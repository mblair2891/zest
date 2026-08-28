import type { Order, OrderLine, PaymentMethod, RestaurantSettings } from "./types";
import {
  cashPolicyFromSettings,
  cashPriceCents,
  type CashDiscountPolicy,
} from "./cash-discount";

export interface OrderTotals {
  subtotalCents: number;
  discountCents: number;
  taxableCents: number;
  taxCents: number;
  serviceChargeCents: number;
  tipCents: number;
  paidCents: number;
  totalCents: number;
  balanceCents: number;
  itemCount: number;
}

export function lineUnitTotal(line: OrderLine): number {
  const mods = line.modifiers.reduce((s, m) => s + m.priceCents, 0);
  return line.unitPriceCents + mods;
}

/** Printed / card merchandise for a line (source of truth). */
export function linePrintedCents(line: OrderLine): number {
  if (line.voided || line.comped) return 0;
  return lineUnitTotal(line) * line.quantity - line.discountCents;
}

/** Cash merchandise after discount + round-up; printed if policy off. */
export function lineCashCents(
  line: OrderLine,
  policy: CashDiscountPolicy | null,
): number {
  if (line.voided || line.comped) return 0;
  if (!policy) return linePrintedCents(line);
  const unitCash = cashPriceCents(lineUnitTotal(line), policy);
  return Math.max(0, unitCash * line.quantity - line.discountCents);
}

export function lineTotal(
  line: OrderLine,
  policy: CashDiscountPolicy | null = null,
): number {
  return policy ? lineCashCents(line, policy) : linePrintedCents(line);
}

export type TenderLens = PaymentMethod | "card" | "cash";

export function policyForTender(
  settings: RestaurantSettings,
  tender?: TenderLens,
): CashDiscountPolicy | null {
  if (tender !== "cash") return null;
  return cashPolicyFromSettings(settings);
}

export function computeTotals(
  order: Order,
  settings: RestaurantSettings,
  opts?: { tender?: TenderLens },
): OrderTotals {
  const policy = policyForTender(settings, opts?.tender);
  const activeLines = order.lines.filter((l) => !l.voided);
  const itemCount = activeLines.reduce((s, l) => s + l.quantity, 0);

  let subtotalCents = 0;
  let taxableCents = 0;
  for (const line of activeLines) {
    if (line.comped) continue;
    const t = lineTotal(line, policy);
    subtotalCents += t;
    if (!line.taxExempt) taxableCents += t;
  }

  const percentDiscount = Math.round(
    subtotalCents * (order.discountPercent / 100),
  );
  const discountCents = Math.min(
    subtotalCents,
    percentDiscount + order.discountCents,
  );
  const afterDiscount = subtotalCents - discountCents;
  const taxableAfter =
    subtotalCents > 0
      ? Math.round(taxableCents * (afterDiscount / subtotalCents))
      : 0;

  const taxCents = Math.round(taxableAfter * settings.taxRate);

  let serviceChargeCents = order.serviceChargeCents;
  if (
    order.autoGratApplied ||
    (order.guestCount >= settings.autoGratPartySize && order.type === "dine_in")
  ) {
    serviceChargeCents = Math.round(afterDiscount * settings.autoGratPercent);
  }

  const tipCents = order.payments.reduce((s, p) => s + p.tipCents, 0);
  const paidCents = order.payments.reduce(
    (s, p) => s + p.amountCents + p.tipCents,
    0,
  );
  const computedTotal = afterDiscount + taxCents + serviceChargeCents;
  const totalCents =
    typeof order.dueOverrideCents === "number"
      ? Math.max(0, order.dueOverrideCents)
      : computedTotal;
  const remainingOnCheck = Math.max(
    0,
    totalCents - order.payments.reduce((s, p) => s + p.amountCents, 0),
  );

  return {
    subtotalCents,
    discountCents,
    taxableCents: taxableAfter,
    taxCents,
    serviceChargeCents,
    tipCents,
    paidCents,
    totalCents,
    balanceCents: remainingOnCheck,
    itemCount,
  };
}

export function computeDualTotals(
  order: Order,
  settings: RestaurantSettings,
): { card: OrderTotals; cash: OrderTotals; enabled: boolean } {
  const enabled = Boolean(cashPolicyFromSettings(settings));
  return {
    card: computeTotals(order, settings, { tender: "card" }),
    cash: computeTotals(order, settings, { tender: "cash" }),
    enabled,
  };
}

export function isHappyHour(settings: RestaurantSettings, now = new Date()): boolean {
  if (!settings.happyHourEnabled) return false;
  const day = now.getDay();
  if (!settings.happyHourDays.includes(day)) return false;
  const hour = now.getHours() + now.getMinutes() / 60;
  return hour >= settings.happyHourStart && hour < settings.happyHourEnd;
}

export function tipSuggestions(balanceCents: number): number[] {
  return [0.15, 0.18, 0.2, 0.25].map((r) => Math.round(balanceCents * r));
}

export function printedItemPriceCents(
  printedCents: number,
  settings: RestaurantSettings,
): { card: number; cash: number; enabled: boolean } {
  const policy = cashPolicyFromSettings(settings);
  return {
    card: printedCents,
    cash: policy ? cashPriceCents(printedCents, policy) : printedCents,
    enabled: Boolean(policy),
  };
}
