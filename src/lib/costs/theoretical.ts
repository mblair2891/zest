import type { Order } from "@/lib/pos/types";
import type { CostSku, ItemRecipe } from "./types";
import { recipeMenuIds } from "@/lib/recipes/normalize";
import { suggestSku } from "@/lib/recipes/match-sku";

export type TheoreticalSalesRules = {
  /** Default false — voided lines do not consume. */
  includeVoids?: boolean;
  /** Default true — comps still used product unless the house turns this off. */
  includeComps?: boolean;
};

export function salesQtyByMenuItem(
  orders: Order[],
  from: number,
  to: number,
  entityId?: string | null,
  rules?: TheoreticalSalesRules,
): Record<string, number> {
  const includeVoids = rules?.includeVoids === true;
  const includeComps = rules?.includeComps !== false;
  const out: Record<string, number> = {};
  for (const o of orders) {
    const t = o.closedAt ?? o.createdAt;
    if (t < from || t > to) continue;
    for (const line of o.lines) {
      if (!line.sent) continue;
      if (line.voided && !includeVoids) continue;
      if (line.comped && !includeComps) continue;
      if (entityId && line.vendorId && line.vendorId !== entityId) continue;
      out[line.menuItemId] = (out[line.menuItemId] ?? 0) + line.quantity;
    }
  }
  return out;
}

/** Convert recipe qty into SKU pack units (e.g. ml pour → bottles). */
export function toPackUnits(sku: CostSku, qty: number, unit: string): number {
  const u = unit.toLowerCase();
  const pack = sku.packLabel.toLowerCase();
  if ((u === "ml" || u === "oz") && (pack === "ml" || sku.unit === "bottle")) {
    const ml = u === "oz" ? qty * 29.5735 : qty;
    return sku.packSize > 0 ? ml / sku.packSize : qty;
  }
  if (u === sku.unit || u === pack) return qty;
  return qty;
}

export function theoreticalUse(opts: {
  recipes: ItemRecipe[];
  skus: CostSku[];
  sales: Record<string, number>;
  entityId?: string | null;
}): Record<string, number> {
  const use: Record<string, number> = {};
  const skuById = new Map(opts.skus.map((s) => [s.id, s]));
  for (const r of opts.recipes) {
    if (opts.entityId && r.entityId && r.entityId !== opts.entityId) continue;
    const sold = recipeMenuIds(r).reduce((n, id) => n + (opts.sales[id] ?? 0), 0);
    if (!sold) continue;
    const factor = 1 + Math.max(0, r.wasteFactor);
    const yieldQty = r.yieldQty > 0 ? r.yieldQty : 1;
    for (const line of r.lines) {
      const sku =
        (line.skuId ? skuById.get(line.skuId) : undefined) ??
        suggestSku(line.name || "", opts.skus);
      if (!sku) continue;
      const packs = toPackUnits(sku, line.qty, line.unit) * (sold / yieldQty) * factor;
      use[sku.id] = (use[sku.id] ?? 0) + packs;
    }
  }
  return use;
}

export function recipeCostCents(
  recipe: ItemRecipe | undefined,
  skus: CostSku[],
): number {
  if (!recipe) return 0;
  const skuById = new Map(skus.map((s) => [s.id, s]));
  let cents = 0;
  const factor = 1 + Math.max(0, recipe.wasteFactor);
  const yieldQty = recipe.yieldQty > 0 ? recipe.yieldQty : 1;
  for (const line of recipe.lines) {
    const sku =
      (line.skuId ? skuById.get(line.skuId) : undefined) ??
      suggestSku(line.name || "", skus);
    if (!sku || !sku.costCents) continue;
    const packs = toPackUnits(sku, line.qty, line.unit) / yieldQty;
    cents += packs * sku.costCents * factor;
  }
  return Math.round(cents);
}
