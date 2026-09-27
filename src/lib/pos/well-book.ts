/** Optional well catalog for a drink entity. Food entities never receive these rows. */

export const WELL_GROUP = "Wells";

export const DEFAULT_SPIRITS = ["Vodka", "Gin", "Rum", "Tequila", "Whiskey", "Bourbon"] as const;

export const DEFAULT_MIXERS = ["Coke", "Diet Coke", "Sprite", "Ginger ale", "Soda", "Tonic"] as const;

export const WELL_STYLES = ["highball", "rocks", "shot", "tall"] as const;
export type WellStyle = (typeof WELL_STYLES)[number];

export type WellSpirit = { id: string; name: string };
export type WellMixer = { id: string; name: string; hidden?: boolean };

export type WellBookConfig = {
  enabled: boolean;
  spirits: WellSpirit[];
  mixers: WellMixer[];
  wellCents: number;
  callUpchargeCents: number;
  premiumUpchargeCents: number;
};

export const POUR_OZ: Record<WellStyle, { spiritOz: number; mixerOz: number }> = {
  highball: { spiritOz: 1.5, mixerOz: 4 },
  rocks: { spiritOz: 2, mixerOz: 0 },
  shot: { spiritOz: 1.5, mixerOz: 0 },
  tall: { spiritOz: 1.5, mixerOz: 6 },
};

export function readWellBook(raw: unknown): WellBookConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Partial<WellBookConfig>;
  const spirits: WellSpirit[] = [];
  if (Array.isArray(row.spirits)) {
    row.spirits.forEach((spirit, index) => {
      if (!spirit || typeof spirit !== "object") return;
      const name = String((spirit as WellSpirit).name ?? "").trim();
      if (!name) return;
      spirits.push({ id: String((spirit as WellSpirit).id ?? `spirit-${index + 1}`), name });
    });
  }
  const mixers: WellMixer[] = [];
  if (Array.isArray(row.mixers)) {
    row.mixers.forEach((mixer, index) => {
      if (!mixer || typeof mixer !== "object") return;
      const name = String((mixer as WellMixer).name ?? "").trim();
      if (!name) return;
      mixers.push({
        id: String((mixer as WellMixer).id ?? `mixer-${index + 1}`),
        name,
        hidden: Boolean((mixer as WellMixer).hidden),
      });
    });
  }
  if (!spirits.length || !mixers.length) return undefined;
  return {
    enabled: Boolean(row.enabled),
    spirits,
    mixers,
    wellCents: Math.max(0, Math.round(Number(row.wellCents) || 0)),
    callUpchargeCents: Math.max(0, Math.round(Number(row.callUpchargeCents) || 0)),
    premiumUpchargeCents: Math.max(0, Math.round(Number(row.premiumUpchargeCents) || 0)),
  };
}

export function isDrinkEntity(entity: {
  stationType?: string | null;
  drinks?: boolean | null;
}): boolean {
  if (entity.drinks) return true;
  return entity.stationType === "bar" || entity.stationType === "both";
}

export function defaultWellBook(): WellBookConfig {
  return {
    enabled: false,
    spirits: DEFAULT_SPIRITS.map((name, index) => ({ id: `spirit-${index + 1}`, name })),
    mixers: DEFAULT_MIXERS.map((name, index) => ({ id: `mixer-${index + 1}`, name })),
    wellCents: 800,
    callUpchargeCents: 200,
    premiumUpchargeCents: 400,
  };
}

export type WellDraft = {
  key: string;
  name: string;
  style: WellStyle;
  description: string;
  priceCents: number;
  hidden: boolean;
  recipe: { name: string; qty: number; unit: "oz" }[];
};

export function wellBuildName(spirit: string, mixer: string | null, style: WellStyle): string {
  if (style === "highball" && mixer) return `${spirit} and ${mixer}`;
  if (style === "tall" && mixer) return `${spirit} and ${mixer} tall`;
  if (style === "rocks") return `${spirit} rocks`;
  return `${spirit} shot`;
}

/** One item per spirit, mixer, and pour. Rocks and shots have no mixer. */
export function buildWellDraft(config: WellBookConfig): WellDraft[] {
  if (!config.enabled) return [];
  const out: WellDraft[] = [];
  for (const spirit of config.spirits) {
    const spiritName = spirit.name.trim();
    if (!spiritName) continue;
    for (const style of WELL_STYLES) {
      const pour = POUR_OZ[style];
      if (pour.mixerOz > 0) {
        for (const mixer of config.mixers) {
          const mixerName = mixer.name.trim();
          if (!mixerName) continue;
          out.push({
            key: `${spirit.id}|${mixer.id}|${style}`,
            name: wellBuildName(spiritName, mixerName, style),
            style,
            description: `Well ${style}`,
            priceCents: Math.max(0, Math.round(config.wellCents)),
            hidden: Boolean(mixer.hidden),
            recipe: [
              { name: spiritName, qty: pour.spiritOz, unit: "oz" },
              { name: mixerName, qty: pour.mixerOz, unit: "oz" },
            ],
          });
        }
      } else {
        out.push({
          key: `${spirit.id}|-|${style}`,
          name: wellBuildName(spiritName, null, style),
          style,
          description: `Well ${style}`,
          priceCents: Math.max(0, Math.round(config.wellCents)),
          hidden: false,
          recipe: [{ name: spiritName, qty: pour.spiritOz, unit: "oz" }],
        });
      }
    }
  }
  return out;
}

export type WellCatalogItem = {
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
  wellKey?: string;
  wellHidden?: boolean;
};

export type WellCatalogCategory = {
  id: string;
  name: string;
  sort: number;
  color?: string;
  station?: string;
  destinationName?: string;
  vendorId?: string;
  wellBook?: boolean;
};

export type WellModifierOption = { id: string; name: string; priceCents: number; default?: boolean };

export type WellModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  options: WellModifierOption[];
};

export type WellRecipeDraft = {
  menuItemId: string;
  name: string;
  entityId: string;
  lines: { name: string; qty: number; unit: string }[];
};

function wellCategoryId(entityId: string): string {
  return `well-cat-${entityId}`;
}

function wellItemId(entityId: string, key: string): string {
  return `well-item-${entityId}-${key.replace(/\|/g, "__")}`;
}

function wellModifierId(entityId: string): string {
  return `well-mod-${entityId}`;
}

function tierGroup(entityId: string, config: WellBookConfig): WellModifierGroup {
  const call = Math.max(0, Math.round(config.callUpchargeCents));
  const premium = Math.max(0, Math.round(config.premiumUpchargeCents));
  return {
    id: wellModifierId(entityId),
    name: "Well tier",
    required: false,
    min: 0,
    max: 1,
    options: [
      { id: `${wellModifierId(entityId)}-well`, name: "Well", priceCents: 0, default: true },
      { id: `${wellModifierId(entityId)}-call`, name: "Call", priceCents: call },
      { id: `${wellModifierId(entityId)}-premium`, name: "Premium", priceCents: premium },
    ],
  };
}

export function syncWellCatalog<TItem extends WellCatalogItem, TCat extends WellCatalogCategory>(input: {
  entityId: string;
  config: WellBookConfig;
  items: readonly TItem[];
  categories: readonly TCat[];
  modifiers?: readonly WellModifierGroup[];
}): {
  items: TItem[];
  categories: TCat[];
  modifiers: WellModifierGroup[];
  recipes: WellRecipeDraft[];
} {
  const entityId = input.entityId;
  const ownWell = (item: TItem) => item.vendorId === entityId && Boolean(item.wellKey);
  const keptItems = input.items.filter((item) => !ownWell(item));
  const catId = wellCategoryId(entityId);
  const keptCats = input.categories.filter((cat) => cat.id !== catId);
  const modifiers = (input.modifiers ?? []).filter((group) => group.id !== wellModifierId(entityId));
  if (!input.config.enabled) {
    return { items: keptItems.slice(), categories: keptCats.slice(), modifiers, recipes: [] };
  }
  const category = {
    id: catId,
    name: WELL_GROUP,
    sort: -1,
    color: "#1F7A4C",
    station: "bar",
    destinationName: "Bar",
    vendorId: entityId,
    wellBook: true,
  } as TCat;
  const group = tierGroup(entityId, input.config);
  const existing = new Map(
    input.items.filter(ownWell).map((item) => [item.wellKey, item]),
  );
  const drafts = buildWellDraft(input.config);
  const wellItems: TItem[] = drafts.map((draft) => {
    const id = existing.get(draft.key)?.id ?? wellItemId(entityId, draft.key);
    const prev = existing.get(draft.key);
    return {
      ...(prev ?? {}),
      id,
      name: draft.name,
      categoryId: catId,
      priceCents: draft.priceCents,
      vendorId: entityId,
      description: draft.description,
      station: "bar",
      course: prev?.course ?? "entree",
      available: !draft.hidden,
      modifierGroupIds: [group.id],
      wellKey: draft.key,
      wellHidden: draft.hidden,
    } as TItem;
  });
  const recipes: WellRecipeDraft[] = drafts
    .filter((draft) => !draft.hidden)
    .map((draft) => ({
      menuItemId: existing.get(draft.key)?.id ?? wellItemId(entityId, draft.key),
      name: draft.name,
      entityId,
      lines: draft.recipe,
    }));
  return {
    items: [...keptItems, ...wellItems],
    categories: [...keptCats, category],
    modifiers: [...modifiers, group],
    recipes,
  };
}

/** Specialty upload keeps well rows unless the entity chooses to replace them. */
export function specialtyBesideWell<TItem extends { vendorId?: string; wellKey?: string; name: string }>(
  items: readonly TItem[],
  entityId: string,
  incomingName: string,
  replaceWell: boolean,
): "add" | "skip" {
  if (replaceWell) return "add";
  const name = incomingName.trim().toLowerCase();
  if (!name) return "skip";
  const clash = items.some(
    (item) =>
      item.vendorId === entityId &&
      Boolean(item.wellKey) &&
      item.name.trim().toLowerCase() === name,
  );
  return clash ? "skip" : "add";
}

export function dropWellItems<TItem extends { vendorId?: string; wellKey?: string }>(
  items: readonly TItem[],
  entityId: string,
): TItem[] {
  return items.filter((item) => !(item.vendorId === entityId && item.wellKey));
}

export function orderPadCategories<T extends { id: string; name: string; sort: number; wellBook?: boolean }>(
  categories: readonly T[],
  items: readonly { categoryId: string; vendorId?: string; wellHidden?: boolean; archived?: boolean }[],
  vendorId: string | null,
): T[] {
  const visible = new Set<string>();
  for (const item of items) {
    if (item.wellHidden || item.archived) continue;
    if (vendorId && item.vendorId !== vendorId) continue;
    visible.add(item.categoryId);
  }
  return categories
    .filter((cat) => visible.has(cat.id))
    .slice()
    .sort((a, b) => {
      const aw = a.wellBook || a.name === WELL_GROUP ? 0 : 1;
      const bw = b.wellBook || b.name === WELL_GROUP ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return a.sort - b.sort || a.name.localeCompare(b.name);
    });
}
