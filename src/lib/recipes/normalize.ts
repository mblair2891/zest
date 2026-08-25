import type { ItemRecipe, RecipeLine } from "@/lib/costs/types";

export function recipeMenuIds(r: Pick<ItemRecipe, "menuItemId" | "menuItemIds">): string[] {
  const ids = [
    ...(r.menuItemIds ?? []),
    ...(r.menuItemId ? [r.menuItemId] : []),
  ];
  return [...new Set(ids.filter(Boolean))];
}

export function recipeForMenuItem(
  recipes: ItemRecipe[],
  menuItemId: string,
): ItemRecipe | undefined {
  return recipes.find((r) => recipeMenuIds(r).includes(menuItemId));
}

export function lineName(l: RecipeLine): string {
  return (l.name || l.skuId || "Ingredient").trim();
}

export function normalizeRecipe(r: ItemRecipe): ItemRecipe {
  const menuItemIds = recipeMenuIds(r);
  return {
    ...r,
    menuItemId: r.menuItemId || menuItemIds[0] || "",
    menuItemIds: menuItemIds.length ? menuItemIds : r.menuItemId ? [r.menuItemId] : [],
    yieldQty: r.yieldQty > 0 ? r.yieldQty : 1,
    yieldUnit: r.yieldUnit || "portion",
    allergens: r.allergens ?? [],
    dietary: r.dietary ?? [],
    steps: r.steps ?? [],
    lines: (r.lines ?? []).map((l) => ({
      name: lineName(l),
      skuId: l.skuId || undefined,
      qty: Number(l.qty) || 0,
      unit: l.unit || "each",
    })),
  };
}
