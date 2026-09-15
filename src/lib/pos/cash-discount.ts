/** Cash is the entered till price. Card is marked up, then rounded up. */
import { DEFAULT_GUEST_CARD_RATE_PERCENT } from "./card-service";

export const CASH_ROUND_INCREMENTS = [0.25, 0.5, 0.75, 1] as const;
export type CashRoundIncrement = (typeof CASH_ROUND_INCREMENTS)[number];
export type CashRoundMode = "up";

export type CashDiscountPolicy = {
  enabled: true;
  percent: number;
  incrementCents: number;
  mode: CashRoundMode;
};

export const DEFAULT_CASH_DISCOUNT = {
  cashDiscountEnabled: false,
  cashDiscountPercent: DEFAULT_GUEST_CARD_RATE_PERCENT,
  cashRoundIncrement: 0.25 as CashRoundIncrement,
  cashRoundMode: "up" as CashRoundMode,
};

export type CashDiscountSettings = {
  cashDiscountEnabled?: boolean;
  cashDiscountPercent?: number;
  cashRoundIncrement?: number;
  cashRoundMode?: string;
};

export function incrementToCents(increment: number): number {
  return Math.round(increment * 100);
}

export function cashPolicyFromSettings(
  settings: CashDiscountSettings | null | undefined,
): CashDiscountPolicy | null {
  if (!settings?.cashDiscountEnabled) return null;
  const percent = Number(settings.cashDiscountPercent);
  if (!Number.isFinite(percent) || percent <= 0) return null;
  const inc = Number(settings.cashRoundIncrement ?? 0.25);
  const incrementCents = incrementToCents(inc);
  if (incrementCents <= 0) return null;
  return {
    enabled: true,
    percent,
    incrementCents,
    mode: "up",
  };
}

/** Pre-round card amount: cash × (1 + percent/100), nearest cent. Never card-minus-percent. */
export function cardRawCents(cashCents: number, percent: number): number {
  if (cashCents <= 0) return 0;
  return Math.round(cashCents * (1 + percent / 100));
}

/**
 * Round UP to the next multiple of increment. Exact multiples stay.
 * Always up — never nearest — so staff are not counting pennies.
 */
export function roundUpToIncrementCents(
  cents: number,
  incrementCents: number,
): number {
  if (cents <= 0) return 0;
  if (incrementCents <= 0) return cents;
  const rem = cents % incrementCents;
  if (rem === 0) return cents;
  return cents + (incrementCents - rem);
}

/** Cash (entered) cents → card cents (markup then round up). */
export function cardPriceCents(
  cashCents: number,
  policy: Pick<CashDiscountPolicy, "percent" | "incrementCents" | "mode">,
): number {
  const raw = cardRawCents(cashCents, policy.percent);
  return roundUpToIncrementCents(raw, policy.incrementCents);
}

/** If someone quoted a card amount, invert the markup only (not the round-up). */
export function cashFromCardCents(cardCents: number, percent: number): number {
  if (cardCents <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return cardCents;
  return Math.round(cardCents / (1 + percent / 100));
}

export function isCashRoundIncrement(v: number): v is CashRoundIncrement {
  return (CASH_ROUND_INCREMENTS as readonly number[]).includes(v);
}

export const CASH_DISCOUNT_CONFIRM =
  "Card prices will recompute from each item’s cash price using this rate and round-up. Publish so stations pick this up.";
