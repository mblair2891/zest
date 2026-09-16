/** First-party gift limits. Defaults match underwriting ($500). */

export type GiftLimits = {
  maxLoadCents: number;
  maxBalanceCents: number;
  maxSellPerTxnCents: number;
  cashOutRemainder: boolean;
  highValueManagerPin: boolean;
  highValueCents: number;
};

export const DEFAULT_GIFT_LIMITS: GiftLimits = {
  maxLoadCents: 50_000,
  maxBalanceCents: 50_000,
  maxSellPerTxnCents: 50_000,
  cashOutRemainder: false,
  highValueManagerPin: true,
  highValueCents: 20_000,
};

function asCents(v: unknown, fallback: number): number {
  const n = Math.round(Number(v) || 0);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(2_000_000, n);
}

export function parseGiftLimits(settings: {
  giftMaxLoadCents?: number;
  giftMaxBalanceCents?: number;
  giftMaxSellPerTxnCents?: number;
  giftCashOutRemainder?: boolean;
  giftHighValueManagerPin?: boolean;
  giftHighValueCents?: number;
} | null | undefined): GiftLimits {
  const d = DEFAULT_GIFT_LIMITS;
  if (!settings) return { ...d };
  return {
    maxLoadCents: asCents(settings.giftMaxLoadCents, d.maxLoadCents),
    maxBalanceCents: asCents(settings.giftMaxBalanceCents, d.maxBalanceCents),
    maxSellPerTxnCents: asCents(settings.giftMaxSellPerTxnCents, d.maxSellPerTxnCents),
    cashOutRemainder: settings.giftCashOutRemainder === true,
    highValueManagerPin: settings.giftHighValueManagerPin !== false,
    highValueCents: asCents(settings.giftHighValueCents, d.highValueCents),
  };
}

export function giftSellBlockedReason(
  amountCents: number,
  currentBalanceCents: number,
  limits: GiftLimits,
): string | null {
  if (amountCents <= 0) return "Amount required";
  if (amountCents > limits.maxSellPerTxnCents) {
    return `Max sell per transaction is $${(limits.maxSellPerTxnCents / 100).toFixed(2)}.`;
  }
  if (amountCents > limits.maxLoadCents) {
    return `Max load per card is $${(limits.maxLoadCents / 100).toFixed(2)}.`;
  }
  if (currentBalanceCents + amountCents > limits.maxBalanceCents) {
    return `Max balance per card is $${(limits.maxBalanceCents / 100).toFixed(2)}.`;
  }
  return null;
}

export function giftNeedsManagerPin(amountCents: number, limits: GiftLimits): boolean {
  return limits.highValueManagerPin && amountCents >= limits.highValueCents;
}
