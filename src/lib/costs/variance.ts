/**
 * Receipt vs recipe-usage gaps. Leaf (no @/ runtime imports).
 * Flags a gap — never an accusation.
 */

export type ReceiptEvent = {
  at: number;
  qty: number;
  skuId: string;
  entityId: string;
};

export type ReceiptWindow = {
  skuId: string;
  entityId: string;
  from: number;
  to: number;
  receiptsQty: number;
};

/** Consecutive receipts for one SKU at one entity. Qty on the opening receipt vs usage until the next. */
export function receiptWindows(
  receipts: ReceiptEvent[],
  skuId: string,
  entityId: string,
  now: number,
): ReceiptWindow[] {
  const sorted = receipts
    .filter((r) => r.skuId === skuId && r.entityId === entityId && r.qty > 0)
    .sort((a, b) => a.at - b.at);
  const out: ReceiptWindow[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i]!.at;
    const to = i + 1 < sorted.length ? sorted[i + 1]!.at : now;
    if (to <= from) continue;
    out.push({
      skuId,
      entityId,
      from,
      to,
      receiptsQty: sorted[i]!.qty,
    });
  }
  return out;
}

/**
 * Flag when received qty far exceeds recipe × tickets in that window.
 * Example: 10 bottles in, 3 bottles of recipe use → flag. Do not auto-accuse.
 */
export function purchaseGapShouldFlag(
  receiptsQty: number,
  theoretical: number,
  alertPct: number,
): boolean {
  if (!(receiptsQty > 0)) return false;
  const used = Math.max(0, theoretical);
  const unused = receiptsQty - used;
  if (unused < 0.25) return false;
  const pct = (unused / receiptsQty) * 100;
  return pct >= Math.max(1, alertPct);
}

/** Owned-lines: a ticket line counts for this entity only when tagged to it. */
export function lineOwnedByEntity(
  lineVendorId: string | undefined | null,
  entityId: string | null | undefined,
): boolean {
  if (!entityId) return true;
  return lineVendorId === entityId;
}

export function varianceSummary(opts: {
  skuName: string;
  receiptsQty: number;
  theoretical: number;
  windowDays: number;
}): string {
  const rec = round2(opts.receiptsQty);
  const use = round2(opts.theoretical);
  return `${opts.skuName}: received ${rec} vs recipe use ${use} over ${opts.windowDays}d. Record why (event, take-home, breakage, mis-ring, or a theft review) — this is not an accusation.`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function windowDays(from: number, to: number): number {
  return Math.max(1, Math.round((to - from) / 86400000));
}
