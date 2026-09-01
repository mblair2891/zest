import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { computeTotals, linePrintedCents } from "@/lib/pos/calculations";
import type { Order, RestaurantSettings } from "@/lib/pos/types";

export type EntityCaptureShare = {
  entityId: string;
  kind: "host" | "operator";
  displayName: string;
  merchandiseCents: number;
  taxCents: number;
  serviceCents: number;
  tipCents: number;
  totalCents: number;
};

export function entityIdForLine(line: { vendorId?: string | null }): string {
  const v = String(line.vendorId ?? "").trim();
  if (!v || v === HOST_SCOPE || v === "host" || v === "unknown") return HOST_SCOPE;
  return v;
}

function allocateByShare(total: number, weights: number[]): number[] {
  if (total <= 0 || !weights.length) return weights.map(() => 0);
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  const out = weights.map((w) => Math.round((total * w) / sum));
  const drift = out.reduce((s, n) => s + n, 0) - total;
  out[out.length - 1] = (out[out.length - 1] ?? 0) - drift;
  if ((out[out.length - 1] ?? 0) < 0) {
    out[out.length - 1] = 0;
    const fix = out.reduce((s, n) => s + n, 0) - total;
    for (let i = 0; i < out.length - 1 && fix !== 0; i++) {
      const next = (out[i] ?? 0) - fix;
      if (next >= 0) {
        out[i] = next;
        break;
      }
    }
  }
  return out;
}

export function splitTenderByEntity(opts: {
  order: Order;
  settings: RestaurantSettings;
  amountCents: number;
  tipCents?: number;
  hostName: string;
  operatorName?: (id: string) => string;
}): EntityCaptureShare[] {
  const nameOf = opts.operatorName ?? ((id: string) => id);
  const merchBy = new Map<string, number>();
  for (const line of opts.order.lines) {
    if (line.voided || line.comped) continue;
    const id = entityIdForLine(line);
    merchBy.set(id, (merchBy.get(id) ?? 0) + linePrintedCents(line));
  }
  const ids = [...merchBy.entries()].filter(([, v]) => v > 0).map(([id]) => id);
  if (!ids.length) {
    const total = Math.max(0, opts.amountCents) + Math.max(0, opts.tipCents ?? 0);
    if (total <= 0) return [];
    return [
      {
        entityId: HOST_SCOPE,
        kind: "host",
        displayName: opts.hostName || "Host",
        merchandiseCents: Math.max(0, opts.amountCents),
        taxCents: 0,
        serviceCents: 0,
        tipCents: Math.max(0, opts.tipCents ?? 0),
        totalCents: total,
      },
    ];
  }

  const totals = computeTotals(opts.order, opts.settings, { tender: "card" });
  const checkTotal = Math.max(1, totals.totalCents);
  const pay = Math.max(0, opts.amountCents);
  const tip = Math.max(0, opts.tipCents ?? 0);
  const merchWeights = ids.map((id) => merchBy.get(id) ?? 0);
  const merchSum = merchWeights.reduce((s, n) => s + n, 0) || 1;

  const taxPortion = Math.round(pay * (totals.taxCents / checkTotal));
  const servicePortion = Math.round(pay * (totals.serviceChargeCents / checkTotal));
  const merchPortion = Math.max(0, pay - taxPortion - servicePortion);

  const merchParts = allocateByShare(merchPortion, merchWeights);
  const taxParts = allocateByShare(taxPortion, merchWeights);
  const serviceParts = allocateByShare(servicePortion, merchWeights);
  const tipParts = allocateByShare(tip, merchWeights);

  return ids.map((id, i) => {
    const merchandiseCents = merchParts[i] ?? 0;
    const taxCents = taxParts[i] ?? 0;
    const serviceCents = serviceParts[i] ?? 0;
    const tipCents = tipParts[i] ?? 0;
    const kind: "host" | "operator" = id === HOST_SCOPE ? "host" : "operator";
    return {
      entityId: id,
      kind,
      displayName: kind === "host" ? opts.hostName || "Host" : nameOf(id),
      merchandiseCents,
      taxCents,
      serviceCents,
      tipCents,
      totalCents: merchandiseCents + taxCents + serviceCents + tipCents,
    };
  });
}

export function entityIdsOnOrder(order: Pick<Order, "lines">): string[] {
  const ids = new Set<string>();
  for (const line of order.lines) {
    if (line.voided || line.comped) continue;
    ids.add(entityIdForLine(line));
  }
  return [...ids];
}

export function groupLinesByEntity<T extends { vendorId?: string | null; vendorName?: string | null }>(
  lines: T[],
  hostName: string,
): { entityId: string; displayName: string; lines: T[] }[] {
  const order: string[] = [];
  const buckets = new Map<string, { entityId: string; displayName: string; lines: T[] }>();
  for (const line of lines) {
    const entityId = entityIdForLine(line);
    let bucket = buckets.get(entityId);
    if (!bucket) {
      bucket = {
        entityId,
        displayName:
          entityId === HOST_SCOPE
            ? hostName || "Host"
            : String(line.vendorName || entityId),
        lines: [],
      };
      buckets.set(entityId, bucket);
      order.push(entityId);
    }
    bucket.lines.push(line);
  }
  return order.map((id) => buckets.get(id)!);
}
