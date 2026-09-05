/**
 * Labor and cost % use the sales this entity is paid on — not the whole guest check
 * unless the owner picks that basis.
 */
import type { MenuItem, Order, OrderLine } from "@/lib/pos/types";

export const REVENUE_BASES = ["owned_lines", "all_check", "custom_categories"] as const;
export type RevenueBasis = (typeof REVENUE_BASES)[number];

export const REVENUE_BASIS_LABEL: Record<RevenueBasis, string> = {
  owned_lines: "Owned lines (what this entity is paid)",
  all_check: "All-check sales",
  custom_categories: "Selected categories",
};

export function parseRevenueBasis(raw: unknown): RevenueBasis {
  return raw === "owned_lines" || raw === "custom_categories" ? raw : "all_check";
}

export function defaultRevenueBasis(operatingModel?: string | null): RevenueBasis {
  return operatingModel === "peer_venue" || operatingModel === "host_operators"
    ? "owned_lines"
    : "all_check";
}

export function parseCategoryIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 80);
}

export function parseAllocationPct(raw: unknown): number | null {
  if (raw == null || raw === "" || raw === false) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
}

export function laborBasisLabel(entityName: string, basis: RevenueBasis): string {
  const name = entityName.trim() || "This entity";
  if (basis === "all_check") return `${name} labor vs all-check sales $`;
  if (basis === "custom_categories") return `${name} labor vs selected category sales $`;
  return `${name} labor vs owned sales $`;
}

export function lineSalesCents(line: OrderLine): number {
  if (line.voided) return 0;
  const extras = (line.modifiers ?? []).reduce((s, m) => s + (m.priceCents || 0), 0);
  return line.quantity * (line.unitPriceCents + extras);
}

export function lineMatchesBasis(
  line: OrderLine,
  entityId: string,
  basis: RevenueBasis,
  categoryIds: string[],
  menuItems?: MenuItem[],
): boolean {
  if (line.voided) return false;
  if (basis === "all_check") return true;
  if (basis === "custom_categories") {
    const item = menuItems?.find((m) => m.id === line.menuItemId);
    const cat = item?.categoryId || "";
    return Boolean(cat && categoryIds.includes(cat));
  }
  return Boolean(line.vendorId && line.vendorId === entityId);
}

export function salesForLaborBasis(opts: {
  orders: Order[];
  entityId: string;
  basis: RevenueBasis;
  categoryIds?: string[];
  menuItems?: MenuItem[];
  from?: number;
  to?: number;
  includeTips?: boolean;
}): number {
  const cats = opts.categoryIds ?? [];
  let n = 0;
  for (const o of opts.orders) {
    if (o.status === "voided" || o.status === "cancelled") continue;
    const at = o.closedAt ?? o.createdAt;
    if (opts.from != null && at < opts.from) continue;
    if (opts.to != null && at >= opts.to) continue;
    for (const line of o.lines ?? []) {
      if (lineMatchesBasis(line, opts.entityId, opts.basis, cats, opts.menuItems)) {
        n += lineSalesCents(line);
      }
    }
    if (opts.includeTips) {
      const tips = (o.payments ?? []).reduce((s, p) => s + (p.tipCents || 0), 0);
      if (opts.basis === "all_check") n += tips;
    }
  }
  return n;
}

export function allocatedSharedCostCents(
  sharedVenueCostsCents: number,
  allocationPct: number | null,
): number {
  if (allocationPct == null || allocationPct <= 0 || sharedVenueCostsCents <= 0) return 0;
  return Math.round((sharedVenueCostsCents * allocationPct) / 100);
}
