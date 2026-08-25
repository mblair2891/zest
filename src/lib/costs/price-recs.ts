import type { MenuItem } from "@/lib/pos/types";
import { recipeCostCents } from "./theoretical";
import type {
  CostCategory,
  CostSettings,
  CostSku,
  ItemRecipe,
  PriceRecAction,
  PriceRecommendation,
} from "./types";

export function buildPriceRecommendations(opts: {
  menuItems: MenuItem[];
  recipes: ItemRecipe[];
  skus: CostSku[];
  sales: Record<string, number>;
  settings: CostSettings;
  now: number;
}): PriceRecommendation[] {
  const recs: PriceRecommendation[] = [];
  const byMenu = new Map(opts.recipes.map((r) => [r.menuItemId, r]));
  for (const item of opts.menuItems) {
    if (!item.available) continue;
    const recipe = byMenu.get(item.id);
    if (!recipe || !recipe.lines.length) continue;
    const cost = recipeCostCents(recipe, opts.skus);
    if (cost <= 0 || item.priceCents <= 0) continue;
    const pct = (cost / item.priceCents) * 100;
    const sku = opts.skus.find((s) => recipe.lines.some((l) => l.skuId === s.id));
    const cat = (sku?.category ?? "food") as CostCategory;
    const target =
      opts.settings.itemTargetCostPct[item.id] ??
      opts.settings.targetCostPct[cat] ??
      28;
    const salesQty = opts.sales[item.id] ?? 0;
    const entityId = item.vendorId || recipe.entityId;
    const evidence = `Recipe cost $${(cost / 100).toFixed(2)} on a $${(item.priceCents / 100).toFixed(2)} plate (${pct.toFixed(1)}% vs ${target}% target). ${salesQty} sold in window. Competitor price left blank.`;

    let action: PriceRecAction | null = null;
    let suggested: number | undefined;
    if (pct > target + 6) {
      action = "raise";
      suggested = Math.ceil(cost / (target / 100) / 25) * 25;
      if (suggested <= item.priceCents) suggested = item.priceCents + 100;
    } else if (pct < target - 8 && salesQty > 0) {
      action = "lower";
      suggested = Math.max(cost + 50, Math.floor(cost / (target / 100) / 25) * 25);
    } else if (pct > target + 2 && cat === "liquor") {
      action = "adjust_pour";
    } else if (pct > target + 10 && salesQty < 3) {
      action = "eighty_six";
    }
    if (!action) continue;
    recs.push({
      id: `pr_${item.id}_${opts.now}`,
      at: opts.now,
      menuItemId: item.id,
      menuItemName: item.name,
      entityId,
      action,
      currentPriceCents: item.priceCents,
      suggestedPriceCents: suggested,
      recipeCostCents: cost,
      currentCostPct: Math.round(pct * 10) / 10,
      targetCostPct: target,
      salesQty,
      evidence,
      status: "open",
    });
  }
  return recs.slice(0, 20);
}
