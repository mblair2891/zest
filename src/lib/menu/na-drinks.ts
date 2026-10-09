/**
 * Non-alcoholic drinks sold on their own or added as a cocktail modifier.
 * The recipe is the drink. There is no alcohol line.
 */

export const NA_DRINKS = [
  "Cola",
  "Diet cola",
  "Lemon-lime",
  "Orange soda",
  "Root beer",
  "Orange juice",
  "Cranberry",
  "Pineapple",
  "Lemonade",
  "Iced tea",
  "Coffee",
  "Soda water",
  "Still water",
] as const;

export type NaDrinkName = (typeof NA_DRINKS)[number];

export const NA_CATEGORY = "Non-alcoholic";
export const NA_MODIFIER_GROUP = "Non-alcoholic";

const SPIRIT = /\b(rum|gin|vodka|whiskey|whisky|tequila|bourbon|brandy|mezcal|alcohol)\b/i;

export type NaPourLine = { name: string; qty: number; unit: "each" };

export function canonicalNaDrink(raw: string): NaDrinkName | null {
  const key = raw.trim().toLowerCase();
  return NA_DRINKS.find((name) => name.toLowerCase() === key) ?? null;
}

/** One line: the drink itself. */
export function naDrinkRecipe(name: string): NaPourLine[] {
  const drink = canonicalNaDrink(name) ?? name.trim();
  return [{ name: drink, qty: 1, unit: "each" }];
}

export function recipeHasAlcohol(lines: readonly { name: string }[]): boolean {
  return lines.some((line) => SPIRIT.test(line.name));
}

export type NaCatalogCategory = {
  id: string;
  name: string;
  sort: number;
  color?: string;
  station?: string;
  destinationName?: string;
  vendorId?: string;
};

export type NaCatalogItem = {
  id: string;
  name: string;
  categoryId: string;
  priceCents: number;
  vendorId?: string;
  description?: string;
  station?: string;
  course?: string;
  available?: boolean;
  modifierGroupIds?: string[];
  online?: boolean;
};

export type NaModOption = { id: string; name: string; priceCents: number };
export type NaModGroup = {
  id: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  options: NaModOption[];
};

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function sellNaDrink<TItem extends NaCatalogItem, TCat extends NaCatalogCategory>(input: {
  entityId: string;
  drink: string;
  priceCents?: number;
  categories: readonly TCat[];
  items: readonly TItem[];
}): {
  categories: TCat[];
  items: TItem[];
  itemId: string;
  recipe: { menuItemId: string; name: string; entityId: string; lines: NaPourLine[] };
} | null {
  const drink = canonicalNaDrink(input.drink);
  if (!drink) return null;
  const entityId = input.entityId;
  const priceCents = Math.max(0, Math.round(Number(input.priceCents) || 0));
  let categories = input.categories.slice();
  let cat = categories.find((row) => row.name.trim().toLowerCase() === NA_CATEGORY.toLowerCase());
  if (!cat) {
    cat = {
      id: `na-cat-${entityId || "house"}`,
      name: NA_CATEGORY,
      sort: categories.length,
      color: "#3D6B4F",
      station: "bar",
      destinationName: "Bar",
      vendorId: entityId || undefined,
    } as unknown as TCat;
    categories = [...categories, cat];
  }
  const existing = input.items.find(
    (item) =>
      (item.vendorId || "") === (entityId || "") && item.name.trim().toLowerCase() === drink.toLowerCase(),
  );
  const itemId = existing?.id ?? `na-item-${entityId || "house"}-${slug(drink)}`;
  const items = existing
    ? input.items.slice()
    : [
        ...input.items,
        {
          id: itemId,
          name: drink,
          categoryId: cat.id,
          priceCents,
          vendorId: entityId || undefined,
          description: drink,
          station: "bar",
          course: "drink",
          available: true,
          modifierGroupIds: [],
          online: true,
        } as unknown as TItem,
      ];
  return {
    categories,
    items,
    itemId,
    recipe: {
      menuItemId: itemId,
      name: drink,
      entityId,
      lines: naDrinkRecipe(drink),
    },
  };
}

/** Add the drink as a modifier option. The option is the drink, with no spirit. */
export function addNaModifier<G extends NaModGroup>(input: {
  drink: string;
  groups: readonly G[];
}): { groups: G[]; optionName: string } | null {
  const drink = canonicalNaDrink(input.drink);
  if (!drink) return null;
  const groups = input.groups.slice();
  const index = groups.findIndex((group) => group.name.trim().toLowerCase() === NA_MODIFIER_GROUP.toLowerCase());
  const option: NaModOption = { id: `na-opt-${slug(drink)}`, name: drink, priceCents: 0 };
  if (index < 0) {
    const group = {
      id: "na-mod-non-alcoholic",
      name: NA_MODIFIER_GROUP,
      required: false,
      min: 0,
      max: 1,
      options: [option],
    } as unknown as G;
    return { groups: [...groups, group], optionName: drink };
  }
  const current = groups[index]!;
  if (current.options.some((row) => row.name.trim().toLowerCase() === drink.toLowerCase())) {
    return { groups, optionName: drink };
  }
  const options = [...current.options, option];
  const next = {
    ...current,
    options,
    max: Math.max(current.max, options.length),
  } as unknown as G;
  const copy = groups.slice();
  copy[index] = next;
  return { groups: copy, optionName: drink };
}
