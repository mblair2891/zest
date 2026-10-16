/** Cash is the entered till price. Card is marked up, then rounded. */
import { DEFAULT_GUEST_CARD_RATE_PERCENT } from "./card-service.ts";

/** Selectable per selling entity. $0.99 is the nearest price that ends in .99. */
export const CASH_ROUND_INCREMENTS = [0.25, 0.5, 0.99, 1] as const;
export type CashRoundIncrement = (typeof CASH_ROUND_INCREMENTS)[number];
/** Legacy location setting may still round up. Entity rules use nearest. */
export type CashRoundMode = "up" | "nearest";

export type CashDiscountPolicy = {
  enabled: true;
  percent: number;
  incrementCents: number;
  mode: CashRoundMode;
};

export type EntityCashPricing = {
  percent: number;
  increment: CashRoundIncrement;
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
  entityCashPricing?: Record<string, EntityCashPricing>;
};

export function incrementToCents(increment: number): number {
  return Math.round(increment * 100);
}

export function normalizeEntityIncrement(value: number): CashRoundIncrement {
  if (value === 0.5) return 0.5;
  if (value === 1) return 1;
  if (value === 0.99) return 0.99;
  return 0.25;
}

export function parseEntityCashPricing(
  raw: unknown,
): Record<string, EntityCashPricing> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, EntityCashPricing> = {};
  for (const [id, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || !row || typeof row !== "object") continue;
    const rec = row as { percent?: unknown; increment?: unknown };
    const percent = Number(rec.percent);
    if (!Number.isFinite(percent)) continue;
    out[id.slice(0, 80)] = {
      percent: Math.round(Math.min(30, Math.max(0, percent)) * 100) / 100,
      increment: normalizeEntityIncrement(Number(rec.increment)),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

export function cashRoundLabel(increment: number): string {
  if (increment === 0.99) return "nearest $0.99";
  if (increment === 0.5) return "nearest $0.50";
  if (increment === 1) return "nearest $1.00";
  if (increment === 0.75) return "round up $0.75";
  return "nearest $0.25";
}

/** Location-wide fallback for an entity that has not set its own rule. */
export function cashPolicyFromSettings(
  settings: CashDiscountSettings | null | undefined,
): CashDiscountPolicy | null {
  if (!settings?.cashDiscountEnabled) return null;
  const percent = Number(settings.cashDiscountPercent);
  if (!Number.isFinite(percent) || percent <= 0) return null;
  const inc = Number(settings.cashRoundIncrement ?? 0.25);
  const incrementCents = incrementToCents(inc);
  if (incrementCents <= 0) return null;
  const mode: CashRoundMode =
    settings.cashRoundMode === "nearest" || inc === 0.99 ? "nearest" : "up";
  return { enabled: true, percent, incrementCents, mode };
}

/** This selling entity’s percent and rounding. Percent 0 means cash and card match. */
export function cashPolicyFromEntity(
  entity: { percent?: number; increment?: number } | null | undefined,
): CashDiscountPolicy | null {
  if (!entity) return null;
  const percent = Number(entity.percent);
  if (!Number.isFinite(percent) || percent <= 0) return null;
  const increment = normalizeEntityIncrement(Number(entity.increment ?? 0.25));
  return {
    enabled: true,
    percent,
    incrementCents: incrementToCents(increment),
    mode: "nearest",
  };
}

/**
 * Entity rule wins. A location rate applies only when this entity has no row.
 */
export function cashPolicyForEntityId(
  settings: CashDiscountSettings | null | undefined,
  entityId?: string | null,
): CashDiscountPolicy | null {
  const id = String(entityId ?? "").trim();
  const row = id ? settings?.entityCashPricing?.[id] : undefined;
  if (row && Number.isFinite(Number(row.percent))) return cashPolicyFromEntity(row);
  return cashPolicyFromSettings(settings);
}

/** Pre-round card amount: cash × (1 + percent/100), nearest cent. Never card-minus-percent. */
export function cardRawCents(cashCents: number, percent: number): number {
  if (cashCents <= 0) return 0;
  return Math.round(cashCents * (1 + percent / 100));
}

/**
 * Round UP to the next multiple of increment. Exact multiples stay.
 * Used for a location that still has the older round-up rule.
 */
export function roundUpToIncrementCents(cents: number, incrementCents: number): number {
  if (cents <= 0) return 0;
  if (incrementCents <= 0) return cents;
  const rem = cents % incrementCents;
  if (rem === 0) return cents;
  return cents + (incrementCents - rem);
}

/** Nearest increment. $0.99 (99 cents) means the nearest price that ends in .99. */
export function roundNearestToIncrementCents(cents: number, incrementCents: number): number {
  if (cents <= 0) return 0;
  if (incrementCents === 99) {
    const k = Math.max(1, Math.round((cents + 1) / 100));
    return k * 100 - 1;
  }
  if (incrementCents <= 0) return cents;
  return Math.round(cents / incrementCents) * incrementCents;
}

function nextIncrementAtOrAbove(cents: number, incrementCents: number): number {
  if (cents <= 0) return 0;
  if (incrementCents === 99) {
    const k = Math.max(1, Math.ceil((cents + 1) / 100));
    const price = k * 100 - 1;
    return price >= cents ? price : price + 100;
  }
  if (incrementCents <= 0) return cents;
  const rem = cents % incrementCents;
  if (rem === 0) return cents;
  return cents + (incrementCents - rem);
}

/** Cash (entered) cents → card cents. Nearest, and never below the cash price. */
export function cardPriceCents(
  cashCents: number,
  policy: Pick<CashDiscountPolicy, "percent" | "incrementCents" | "mode">,
): number {
  const raw = cardRawCents(cashCents, policy.percent);
  if (policy.mode === "up") {
    if (policy.incrementCents === 99) return nextIncrementAtOrAbove(raw, 99);
    return roundUpToIncrementCents(raw, policy.incrementCents);
  }
  const nearest = roundNearestToIncrementCents(raw, policy.incrementCents);
  if (nearest < cashCents) {
    return nextIncrementAtOrAbove(Math.max(cashCents, raw), policy.incrementCents);
  }
  return nearest;
}

/** If someone quoted a card amount, invert the markup only (not the rounding). */
export function cashFromCardCents(cardCents: number, percent: number): number {
  if (cardCents <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return cardCents;
  return Math.round(cardCents / (1 + percent / 100));
}

export function isCashRoundIncrement(v: number): v is CashRoundIncrement {
  return (CASH_ROUND_INCREMENTS as readonly number[]).includes(v) || v === 0.75;
}

export const CASH_DISCOUNT_CONFIRM =
  "Card prices will recompute from each item’s cash price using this entity’s rate and rounding. Publish so stations pick this up.";
