/**
 * Guest card rate is Summex’s charge (cash-discount %).
 * Finix 0.25% + $0.10 is internal cost — never the guest rate.
 * Residual after Finix is split 90 platform / 10 location.
 */

export const DEFAULT_GUEST_CARD_RATE_PERCENT = 5;

/** Internal processor cost. Do not show or store as the guest rate. */
export const INTERNAL_FINIX_PERCENT = 0.25;
export const INTERNAL_FINIX_FLAT_CENTS = 10;

/** Platform share of (collected − Finix cost). Location gets the rest. */
export const CARD_RESIDUAL_PLATFORM_SHARE = 0.9;

export function parseGuestCardRatePercent(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_GUEST_CARD_RATE_PERCENT;
  return Math.round(Math.min(30, n) * 100) / 100;
}

export function formatGuestCardRate(percent: number): string {
  return parseGuestCardRatePercent(percent).toFixed(2);
}

/** Spread collected on a card tender at this location’s guest rate. */
export function guestCardCollectedCents(cardAmountCents: number, ratePercent: number): number {
  const amt = Math.max(0, Math.round(cardAmountCents));
  const rate = parseGuestCardRatePercent(ratePercent);
  if (amt <= 0 || rate <= 0) return 0;
  return Math.round(amt * (rate / 100));
}

/** Internal Finix cost: 0.25% + $0.10 per captured card. */
export function finixCostCents(cardAmountCents: number): number {
  const amt = Math.max(0, Math.round(cardAmountCents));
  if (amt <= 0) return 0;
  return Math.round(amt * (INTERNAL_FINIX_PERCENT / 100)) + INTERNAL_FINIX_FLAT_CENTS;
}

export function cardResidualCents(collectedCents: number, costCents: number): number {
  return Math.max(0, Math.round(collectedCents) - Math.round(costCents));
}

export function splitCardResidual(residualCents: number): {
  platformCents: number;
  locationCents: number;
} {
  const r = Math.max(0, Math.round(residualCents));
  const platformCents = Math.round(r * CARD_RESIDUAL_PLATFORM_SHARE);
  return { platformCents, locationCents: r - platformCents };
}

export function cardServiceRollup(opts: {
  cardVolumeCents: number;
  cardCount: number;
  guestRatePercent: number;
}): {
  guestRatePercent: number;
  cardVolumeCents: number;
  cardCount: number;
  collectedCents: number;
  finixCostCents: number;
  residualCents: number;
  platformShareCents: number;
  locationShareCents: number;
} {
  const guestRatePercent = parseGuestCardRatePercent(opts.guestRatePercent);
  const cardVolumeCents = Math.max(0, Math.round(opts.cardVolumeCents));
  const cardCount = Math.max(0, Math.round(opts.cardCount));
  const collectedCents = guestCardCollectedCents(cardVolumeCents, guestRatePercent);
  const cost =
    cardCount > 0
      ? finixCostCents(cardVolumeCents) -
        INTERNAL_FINIX_FLAT_CENTS +
        INTERNAL_FINIX_FLAT_CENTS * cardCount
      : 0;
  const residual = cardResidualCents(collectedCents, cost);
  const split = splitCardResidual(residual);
  return {
    guestRatePercent,
    cardVolumeCents,
    cardCount,
    collectedCents,
    finixCostCents: cost,
    residualCents: residual,
    platformShareCents: split.platformCents,
    locationShareCents: split.locationCents,
  };
}

export function processingNoteForRate(percent: number): string {
  const p = formatGuestCardRate(percent);
  return `Guest card rate ${p}% (each location can override). Quantum Payments processes the card. Finix’s 0.25%+$0.10 is internal cost — not the guest rate. Software is billed separately.`;
}
