import type { CostSku, PurchaseOrderLine, VarianceException } from "./types";

function reorderFloor(s: CostSku): number {
  if (s.parMin > 0) return s.parMin;
  return Math.max(0, s.par * 0.5);
}

export function suggestPoLines(opts: {
  skus: CostSku[];
  supplierId: string;
  entityId: string | null;
  exceptions: VarianceException[];
  overrideOpenException?: boolean;
}): { lines: PurchaseOrderLine[]; blocked: string[] } {
  const openFlagged = new Set(
    opts.exceptions
      .filter(
        (e) =>
          e.status === "open" &&
          (e.severity === "urgent" || e.kind === "purchase_vs_sales"),
      )
      .map((e) => e.skuId),
  );
  const blocked: string[] = [];
  const lines: PurchaseOrderLine[] = [];
  for (const s of opts.skus) {
    if (s.supplierId !== opts.supplierId) continue;
    if (opts.entityId && s.entityId !== opts.entityId) continue;
    const target = s.parMax > 0 ? s.parMax : s.par;
    const floor = reorderFloor(s);
    if (s.onHand >= Math.max(floor, s.par)) continue;
    if (openFlagged.has(s.id) && !opts.overrideOpenException) {
      blocked.push(s.name);
      continue;
    }
    const qty = Math.max(1, Math.ceil(target - s.onHand));
    lines.push({
      skuId: s.id,
      name: s.name,
      qty,
      unitCostCents: s.costCents,
      receivedQty: 0,
      supplierSku: s.supplierSku,
    });
  }
  return { lines, blocked };
}
