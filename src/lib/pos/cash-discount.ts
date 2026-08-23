/** Cash discount with pretty printed prices and round-up increments. */

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
  cashDiscountPercent: 5,
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

/** Pre-round cash amount: printed × (1 − percent/100), nearest cent. */
export function cashRawCents(printedCents: number, percent: number): number {
  if (printedCents <= 0) return 0;
  return Math.round(printedCents * (1 - percent / 100));
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

/** Printed menu/card cents → cash cents (discount then round up). */
export function cashPriceCents(
  printedCents: number,
  policy: Pick<CashDiscountPolicy, "percent" | "incrementCents" | "mode">,
): number {
  const raw = cashRawCents(printedCents, policy.percent);
  return roundUpToIncrementCents(raw, policy.incrementCents);
}

export function isCashRoundIncrement(v: number): v is CashRoundIncrement {
  return (CASH_ROUND_INCREMENTS as readonly number[]).includes(v);
}
