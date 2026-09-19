import type { Order, OrderLine, PaymentMethod, RestaurantSettings } from "./types";
import {
  cashPolicyFromSettings,
  cardPriceCents,
  type CashDiscountPolicy,
} from "./cash-discount";
import {
  computeTaxLines,
  lineTaxCategory,
  mergeTaxLines,
  ratesForEntity,
  type ComputedTaxLine,
} from "./tax-rates";
import { venueClockParts } from "./venue-time";

export interface OrderTotals {
  subtotalCents: number;
  discountCents: number;
  taxableCents: number;
  taxCents: number;
  taxLines: ComputedTaxLine[];
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

/** Cash / till merchandise for a line (entered price). No extra round. */
export function lineCashCents(
  line: OrderLine,
  _policy?: CashDiscountPolicy | null,
): number {
  if (line.voided || line.comped) return 0;
  return Math.max(0, lineUnitTotal(line) * line.quantity - line.discountCents);
}

/** Card merchandise: markup then round up per line when the policy is on. */
export function lineCardCents(
  line: OrderLine,
  policy: CashDiscountPolicy | null,
): number {
  if (line.voided || line.comped) return 0;
  if (!policy) return lineCashCents(line);
  const unitCard = cardPriceCents(lineUnitTotal(line), policy);
  return Math.max(0, unitCard * line.quantity - line.discountCents);
}

/** Card merch when policy is passed; otherwise the stored cash amount. */
export function linePrintedCents(
  line: OrderLine,
  policy: CashDiscountPolicy | null = null,
): number {
  return policy ? lineCardCents(line, policy) : lineCashCents(line);
}

export function lineTotal(
  line: OrderLine,
  policy: CashDiscountPolicy | null = null,
): number {
  return policy ? lineCardCents(line, policy) : lineCashCents(line);
}

export type TenderLens = PaymentMethod | "card" | "cash";

export function policyForTender(
  settings: RestaurantSettings,
  tender?: TenderLens,
): CashDiscountPolicy | null {
  const policy = cashPolicyFromSettings(settings);
  if (!policy) return null;
  if (tender === "cash") return null;
  return policy;
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
  const scale =
    subtotalCents > 0 ? afterDiscount / subtotalCents : 0;
  const taxableAfter =
    subtotalCents > 0 ? Math.round(taxableCents * scale) : 0;

  let serviceChargeCents = order.serviceChargeCents;
  if (
    order.autoGratApplied ||
    (order.guestCount >= settings.autoGratPartySize && order.type === "dine_in")
  ) {
    serviceChargeCents = Math.round(afterDiscount * settings.autoGratPercent);
  }

  const byEntity = new Map<string, typeof activeLines>();
  for (const line of activeLines) {
    if (line.comped) continue;
    const id = String(line.vendorId ?? line.entityId ?? "") || "_venue";
    const list = byEntity.get(id) ?? [];
    list.push(line);
    byEntity.set(id, list);
  }
  const taxGroups: ComputedTaxLine[][] = [];
  let addOnTax = 0;
  for (const [entityId, elines] of byEntity) {
    const rates = ratesForEntity(settings, entityId === "_venue" ? null : entityId);
    const bases: Parameters<typeof computeTaxLines>[0] = {};
    for (const line of elines) {
      if (line.taxExempt) continue;
      const merch = Math.round(lineTotal(line, policy) * scale);
      const cat = lineTaxCategory(line);
      bases[cat] = (bases[cat] ?? 0) + merch;
    }
    if (serviceChargeCents > 0 && entityId === [...byEntity.keys()][0]) {
      bases.service = (bases.service ?? 0) + serviceChargeCents;
    }
    const computed = computeTaxLines(bases, rates);
    taxGroups.push(computed.lines);
    addOnTax += computed.addOnCents;
  }
  const taxLines = mergeTaxLines(taxGroups);
  const taxCents = taxLines.reduce((s, l) => s + l.cents, 0);

  const tipCents = order.payments.reduce((s, p) => s + p.tipCents, 0);
  const paidCents = order.payments.reduce(
    (s, p) => s + p.amountCents + p.tipCents,
    0,
  );
  const computedTotal = afterDiscount + addOnTax + serviceChargeCents;
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
    taxLines,
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
  const clock = venueClockParts(now, settings.timezone);
  if (!settings.happyHourDays.includes(clock.weekday)) return false;
  const hour = clock.hour + clock.minute / 60;
  return hour >= settings.happyHourStart && hour < settings.happyHourEnd;
}

export function tipSuggestions(balanceCents: number): number[] {
  return [0.15, 0.18, 0.2, 0.25].map((r) => Math.round(balanceCents * r));
}

export function printedItemPriceCents(
  cashCents: number,
  settings: RestaurantSettings,
): { card: number; cash: number; enabled: boolean; showBoth: boolean } {
  const policy = cashPolicyFromSettings(settings);
  const cash = cashCents;
  const card = policy ? cardPriceCents(cash, policy) : cash;
  return {
    card,
    cash,
    enabled: Boolean(policy),
    showBoth: Boolean(policy) && card !== cash,
  };
}
