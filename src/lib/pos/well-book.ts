/** Optional well catalog for a drink entity. Food entities never receive these rows. */

export const WELL_GROUP = "Wells";

export const DEFAULT_SPIRITS = ["Vodka", "Gin", "Rum", "Tequila", "Whiskey", "Bourbon"] as const;

export const DEFAULT_MIXERS = ["cola", "soda", "tonic", "juice", "ginger ale"] as const;

export const WELL_STYLES = ["highball", "double", "rocks", "shot", "tall"] as const;
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
  /** Standard mixed pour, in ounces of spirit. Cola and the other mixers are not measured in ounces. */
  pourOz?: number;
  /** Double mixed pour, in ounces of spirit. */
  doublePourOz?: number;
};

export const STANDARD_POUR_OZ = 1.5;
export const DOUBLE_POUR_OZ = 3;

export const POUR_OZ: Record<WellStyle, { spiritOz: number; mixerOz: number }> = {
  highball: { spiritOz: STANDARD_POUR_OZ, mixerOz: 1 },
  double: { spiritOz: DOUBLE_POUR_OZ, mixerOz: 1 },
  rocks: { spiritOz: 2, mixerOz: 0 },
  shot: { spiritOz: STANDARD_POUR_OZ, mixerOz: 0 },
  tall: { spiritOz: STANDARD_POUR_OZ, mixerOz: 1 },
};

function pourAmount(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 12) return fallback;
  return Math.round(n * 100) / 100;
}

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
    pourOz: pourAmount(row.pourOz, STANDARD_POUR_OZ),
    doublePourOz: pourAmount(row.doublePourOz, DOUBLE_POUR_OZ),
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
    pourOz: STANDARD_POUR_OZ,
    doublePourOz: DOUBLE_POUR_OZ,
  };
}

/** Recipe name for a mixer. Coke on the menu is cola in the recipe. */
export function wellMixerIngredient(mixer: string): string {
  const name = mixer.trim().toLowerCase().replace(/\s+/g, " ");
  if (name === "coke" || name === "coca-cola" || name === "coca cola" || name === "cola") return "cola";
  if (name === "gingerale") return "ginger ale";
  if (name === "diet coke") return "diet cola";
  return name;
}

/** Printed mixer. Cola is named Coke on a Rum and Coke. */
export function wellMixerLabel(mixer: string): string {
  return wellMixerIngredient(mixer) === "cola" ? "Coke" : mixer.trim();
}

export function spiritPourOz(style: WellStyle, config: Pick<WellBookConfig, "pourOz" | "doublePourOz">): number {
  const standard = pourAmount(config.pourOz, STANDARD_POUR_OZ);
  const doubled = pourAmount(config.doublePourOz, DOUBLE_POUR_OZ);
  if (style === "double") return doubled;
  if (style === "rocks") return POUR_OZ.rocks.spiritOz;
  if (style === "shot") return POUR_OZ.shot.spiritOz;
  return standard;
}

export type WellPourLine = { name: string; qty: number; unit: "oz" | "each" };

export function wellPourLines(spirit: string, mixer: string | null, spiritOz: number): WellPourLine[] {
  const spiritLine: WellPourLine = { name: spirit.trim().toLowerCase(), qty: spiritOz, unit: "oz" };
  if (!mixer) return [spiritLine];
  return [spiritLine, { name: wellMixerIngredient(mixer), qty: 1, unit: "each" }];
}

/** "1.5 oz rum and cola" or "3 oz rum and cola". */
export function formatWellPour(lines: readonly { name: string; qty: number; unit: string }[]): string {
  const spirit = lines.find((line) => line.unit === "oz");
  const mixer = lines.find((line) => line.unit !== "oz");
  const qty = spirit ? String(spirit.qty) : "";
  if (spirit && mixer) return `${qty} oz ${spirit.name} and ${mixer.name}`;
  if (spirit) return `${qty} oz ${spirit.name}`;
  return lines.map((line) => line.name).filter(Boolean).join(", ");
}

const WELL_SPIRIT_WORDS = ["bourbon", "tequila", "whiskey", "whisky", "vodka", "gin", "rum"] as const;

/** A named highball or double. Rocks and shots stay on the well book, not this fill. */
export function knownWellPour(name: string): { lines: WellPourLine[]; phrase: string } | null {
  const raw = name.trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
  if (!raw || /\b(rocks|shot|neat|tall)\b/.test(raw)) return null;
  const doubled = /\b(double|dbl)\b/.test(raw);
  const spirit = WELL_SPIRIT_WORDS.find((word) => new RegExp(`\\b${word}\\b`).test(raw));
  if (!spirit) return null;
  let mixer = "";
  if (/\bginger\s*ale\b/.test(raw)) mixer = "ginger ale";
  else if (/\b(coca\s*cola|coke|cola)\b/.test(raw)) mixer = "cola";
  else if (/\btonic\b/.test(raw)) mixer = "tonic";
  else if (/\bjuice\b/.test(raw)) mixer = "juice";
  else if (/\bsoda\b/.test(raw)) mixer = "soda";
  if (!mixer) return null;
  const lines = wellPourLines(spirit === "whisky" ? "whiskey" : spirit, mixer, doubled ? DOUBLE_POUR_OZ : STANDARD_POUR_OZ);
  return { lines, phrase: formatWellPour(lines) };
}

export type WellDraft = {
  key: string;
  name: string;
  style: WellStyle;
  description: string;
  priceCents: number;
  hidden: boolean;
  recipe: WellPourLine[];
};

export function wellBuildName(spirit: string, mixer: string | null, style: WellStyle): string {
  const shown = mixer ? wellMixerLabel(mixer) : null;
  if (style === "double" && shown) return `Double ${spirit} and ${shown}`;
  if (style === "highball" && shown) return `${spirit} and ${shown}`;
  if (style === "tall" && shown) return `${spirit} and ${shown} tall`;
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
      const spiritOz = spiritPourOz(style, config);
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
            recipe: wellPourLines(spiritName, mixerName, spiritOz),
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
          recipe: wellPourLines(spiritName, null, spiritOz),
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

export function wellCategoryId(entityId: string): string {
  return `well-cat-${entityId}`;
}

export function isWellSpiritKey(key: string | null | undefined): boolean {
  return String(key ?? "").startsWith("pick|");
}

/** A generated well build (spirit + mixer, rocks, or shot). Not a listed menu row. */
export function isWellBuildKey(key: string | null | undefined): boolean {
  const value = String(key ?? "");
  return value.length > 0 && !value.startsWith("pick|");
}

export type WellPour = "single" | "double";

export function wellBuildKey(spiritId: string, mixerId: string, pour: WellPour): string {
  return `${spiritId}|${mixerId}|${pour === "double" ? "double" : "highball"}`;
}

/** Vodka and Coke style names, and generated builds, stay off menus. Named cocktails stay. */
export function omitWellBuildFromList(item: { wellKey?: string | null; name?: string }): boolean {
  if (isWellBuildKey(item.wellKey) || isWellSpiritKey(item.wellKey)) return true;
  if (item.name && knownWellPour(item.name)) return true;
  return false;
}

export function visibleWellMixers(config: WellBookConfig): WellMixer[] {
  return config.mixers.filter((mixer) => mixer.name.trim() && !mixer.hidden);
}

export type WellSpiritTile = {
  kind: "spirit";
  id: string;
  spiritId: string;
  entityId: string;
  name: string;
  priceCents: number;
  categoryId: string;
};

export type WellPadTile<T> = { kind: "item"; item: T } | WellSpiritTile;

/**
 * Order pad rows. An enabled well book contributes spirit names only.
 * The built drink is added later from single or double plus a mixer.
 */
export function orderPadTiles<
  T extends {
    id: string;
    name: string;
    categoryId: string;
    vendorId?: string;
    wellKey?: string;
    wellHidden?: boolean;
    archived?: boolean;
    priceCents: number;
  },
>(opts: {
  items: readonly T[];
  vendors: readonly { id: string; wellBook?: WellBookConfig }[];
  vendorFilter: string | null;
  categoryId: string | null;
  search: string;
}): WellPadTile<T>[] {
  const q = opts.search.trim().toLowerCase();
  const out: WellPadTile<T>[] = [];
  for (const item of opts.items) {
    if (item.archived || item.wellHidden) continue;
    if (omitWellBuildFromList(item)) continue;
    if (opts.vendorFilter && item.vendorId !== opts.vendorFilter) continue;
    if (opts.categoryId && item.categoryId !== opts.categoryId) continue;
    if (q && !item.name.toLowerCase().includes(q)) continue;
    out.push({ kind: "item", item });
  }
  for (const vendor of opts.vendors) {
    const config = vendor.wellBook;
    if (!config?.enabled) continue;
    if (opts.vendorFilter && vendor.id !== opts.vendorFilter) continue;
    if (!visibleWellMixers(config).length) continue;
    const categoryId = wellCategoryId(vendor.id);
    if (opts.categoryId && opts.categoryId !== categoryId) continue;
    for (const spirit of config.spirits) {
      const name = spirit.name.trim();
      if (!name) continue;
      if (q && !name.toLowerCase().includes(q)) continue;
      out.push({
        kind: "spirit",
        id: `well-spirit-${vendor.id}-${spirit.id}`,
        spiritId: spirit.id,
        entityId: vendor.id,
        name,
        priceCents: Math.max(0, Math.round(config.wellCents)),
        categoryId,
      });
    }
  }
  out.sort((a, b) => {
    const an = a.kind === "item" ? a.item.name : a.name;
    const bn = b.kind === "item" ? b.item.name : b.name;
    return an.localeCompare(bn);
  });
  return out;
}

export function findWellDrink<T extends { wellKey?: string; vendorId?: string; available?: boolean }>(
  items: readonly T[],
  opts: { entityId: string; spiritId: string; mixerId: string; pour: WellPour },
): T | undefined {
  const key = wellBuildKey(opts.spiritId, opts.mixerId, opts.pour);
  return items.find(
    (item) => item.vendorId === opts.entityId && item.wellKey === key && item.available !== false,
  );
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
      wellHidden: true,
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

export function orderPadCategories<T extends { id: string; name: string; sort: number; wellBook?: boolean; vendorId?: string }>(
  categories: readonly T[],
  items: readonly { categoryId: string; vendorId?: string; wellHidden?: boolean; archived?: boolean; wellKey?: string }[],
  vendorId: string | null,
): T[] {
  const visible = new Set<string>();
  for (const item of items) {
    if (item.wellHidden || item.archived || isWellBuildKey(item.wellKey)) continue;
    if (vendorId && item.vendorId !== vendorId) continue;
    visible.add(item.categoryId);
  }
  for (const cat of categories) {
    if (!cat.wellBook) continue;
    if (vendorId && cat.vendorId !== vendorId) continue;
    visible.add(cat.id);
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
