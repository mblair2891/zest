import type { Order, OrderLine, RestaurantSettings } from "./types";

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

export function lineTotal(line: OrderLine): number {
  if (line.voided || line.comped) return 0;
  return lineUnitTotal(line) * line.quantity - line.discountCents;
}

export function computeTotals(
  order: Order,
  settings: RestaurantSettings,
): OrderTotals {
  const activeLines = order.lines.filter((l) => !l.voided);
  const itemCount = activeLines.reduce((s, l) => s + l.quantity, 0);

  let subtotalCents = 0;
  let taxableCents = 0;
  for (const line of activeLines) {
    if (line.comped) continue;
    const t = lineTotal(line);
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
  const totalCents = afterDiscount + taxCents + serviceChargeCents;
  const balanceCents = Math.max(0, totalCents + tipCents - paidCents);
  // balance for remaining on check (without tip yet)
  const remainingOnCheck = Math.max(0, totalCents - order.payments.reduce((s, p) => s + p.amountCents, 0));

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
