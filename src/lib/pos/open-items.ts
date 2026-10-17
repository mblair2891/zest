/**
 * Permanent price-entry rows on every entity's order-taking menu.
 * Open Food belongs to the food entity and fires to the food order printer.
 * Open Liquor belongs to the bar entity and fires to the bar order printer.
 * The server types the amount when the item is added. The catalog price stays unset.
 */

export const OPEN_FOOD_ID = "open-food";
export const OPEN_LIQUOR_ID = "open-liquor";
export const OPEN_FOOD_CATEGORY_ID = "cat-open-food";
export const OPEN_LIQUOR_CATEGORY_ID = "cat-open-liquor";
export const OPEN_FOOD_NAME = "Open Food";
export const OPEN_LIQUOR_NAME = "Open Liquor";

export type OpenKind = "food" | "liquor";

export type OpenVendor = {
  id: string;
  active?: boolean;
  stationType?: "bar" | "kitchen" | "both" | string | null;
  drinks?: boolean;
};

const OPEN_AMOUNT_MAX_CENTS = 9_999_999;

export function isOpenMenuId(id: string | null | undefined): boolean {
  return id === OPEN_FOOD_ID || id === OPEN_LIQUOR_ID;
}

/**
 * Open Food, Open Liquor, and any line flagged open price.
 * The typed amount is the cash price and the card price.
 */
export function lineSkipsCashDiscount(line: {
  menuItemId?: string | null;
  openPrice?: boolean | null;
}): boolean {
  return line.openPrice === true || isOpenMenuId(line.menuItemId);
}

export function openKindOf(item: { id?: string; openKind?: string | null }): OpenKind | null {
  if (item.openKind === "food" || item.openKind === "liquor") return item.openKind;
  if (item.id === OPEN_FOOD_ID) return "food";
  if (item.id === OPEN_LIQUOR_ID) return "liquor";
  return null;
}

export function isOpenMenuItem(item: { id?: string; openKind?: string | null }): boolean {
  return openKindOf(item) != null;
}

/** Open Food, Open Liquor, or any menu item flagged open price. The server types the amount. */
export function needsOpenAmount(item: {
  id?: string;
  openKind?: string | null;
  openPrice?: boolean | null;
}): boolean {
  return isOpenMenuItem(item) || item.openPrice === true;
}

const OPEN_AMOUNT_KEYS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "00", "back", "clear"]);

/** On-screen money keypad. Two decimal places. "1" "." "0" "2" is 1.02. */
export function appendOpenAmountKey(buffer: string, key: string): string {
  if (!OPEN_AMOUNT_KEYS.has(key)) return buffer;
  if (key === "clear") return "";
  if (key === "back") return buffer.slice(0, -1);
  if (key === "00") {
    return appendOpenAmountKey(appendOpenAmountKey(buffer, "0"), "0");
  }
  if (key === ".") {
    if (buffer.includes(".")) return buffer;
    return buffer === "" ? "0." : `${buffer}.`;
  }
  const next = buffer === "0" ? key : `${buffer}${key}`;
  const [whole, frac] = next.split(".");
  const digits = whole.replace(/^0+/, "");
  if (digits.length > 5) return buffer;
  if (frac != null && frac.length > 2) return buffer;
  return next;
}

/** Dollars the server typed. Blank, zero, and extra fraction digits are refused. */
export function parseOpenAmountCents(raw: string): number | null {
  const cleaned = String(raw ?? "").trim().replace(/[$,\s]/g, "");
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > OPEN_AMOUNT_MAX_CENTS) return null;
  return cents;
}

/**
 * Food is the first active kitchen, then a both-entity.
 * Bar is the first active bar, then a drinks entity, then a both-entity.
 * One entity covers both lines. Destinations stay Kitchen and Bar.
 */
export function resolveOpenEntities(vendors: readonly OpenVendor[]): {
  foodId?: string;
  barId?: string;
} {
  const active = vendors.filter((vendor) => vendor.active !== false && vendor.id);
  const kitchen = active.find((vendor) => vendor.stationType === "kitchen");
  const bar = active.find((vendor) => vendor.stationType === "bar");
  const drinks = active.find((vendor) => vendor.drinks);
  const both = active.find((vendor) => vendor.stationType === "both");
  const foodId =
    kitchen?.id ??
    (both && !both.drinks ? both.id : undefined) ??
    both?.id ??
    active.find((vendor) => vendor.stationType !== "bar" && !vendor.drinks)?.id ??
    active[0]?.id;
  const barId =
    bar?.id ??
    drinks?.id ??
    both?.id ??
    active.find((vendor) => vendor.id !== foodId)?.id ??
    foodId;
  return { foodId, barId };
}

type OpenCatalogItem = {
  id: string;
  name: string;
  categoryId: string;
  priceCents: number;
  course?: string;
  station?: string;
  modifierGroupIds?: string[];
  available?: boolean;
  vendorId?: string;
  taxCategory?: string;
  openKind?: OpenKind;
  archived?: boolean;
  description?: string;
  happyHourPriceCents?: number;
};

type OpenCatalogCategory = {
  id: string;
  name: string;
  sort: number;
  color: string;
  station?: string;
  destinationName?: string;
  printerId?: string;
  vendorId?: string;
  openBook?: boolean;
  wellBook?: boolean;
};

function openItem<TItem extends OpenCatalogItem>(
  kind: OpenKind,
  entityId: string | undefined,
): TItem {
  const liquor = kind === "liquor";
  const row: OpenCatalogItem = {
    id: liquor ? OPEN_LIQUOR_ID : OPEN_FOOD_ID,
    name: liquor ? OPEN_LIQUOR_NAME : OPEN_FOOD_NAME,
    categoryId: liquor ? OPEN_LIQUOR_CATEGORY_ID : OPEN_FOOD_CATEGORY_ID,
    priceCents: 0,
    course: liquor ? "drink" : "entree",
    station: liquor ? "bar" : "kitchen",
    modifierGroupIds: [],
    available: true,
    vendorId: entityId,
    taxCategory: liquor ? "bev" : "food",
    openKind: kind,
    description: "Enter the amount on the check.",
  };
  return row as unknown as TItem;
}

function openCategory<TCat extends OpenCatalogCategory>(
  kind: OpenKind,
  entityId: string | undefined,
): TCat {
  const liquor = kind === "liquor";
  const row: OpenCatalogCategory = {
    id: liquor ? OPEN_LIQUOR_CATEGORY_ID : OPEN_FOOD_CATEGORY_ID,
    name: liquor ? OPEN_LIQUOR_NAME : OPEN_FOOD_NAME,
    sort: liquor ? 9001 : 9000,
    color: liquor ? "#2C4A6E" : "#9A6700",
    station: liquor ? "bar" : "kitchen",
    destinationName: liquor ? "Bar" : "Kitchen",
    vendorId: entityId,
    openBook: true,
  };
  return row as unknown as TCat;
}

/** Put both rows back. Archive, delete, upload, and a well book do not remove them. */
export function syncOpenCatalog<
  TItem extends OpenCatalogItem,
  TCat extends OpenCatalogCategory,
>(input: {
  items: readonly TItem[];
  categories: readonly TCat[];
  vendors: readonly OpenVendor[];
}): { items: TItem[]; categories: TCat[] } {
  const { foodId, barId } = resolveOpenEntities(input.vendors);
  const items = input.items.filter((item) => !isOpenMenuItem(item));
  const categories = input.categories.filter(
    (cat) =>
      cat.id !== OPEN_FOOD_CATEGORY_ID &&
      cat.id !== OPEN_LIQUOR_CATEGORY_ID &&
      cat.openBook !== true,
  );
  return {
    items: [...items, openItem<TItem>("food", foodId), openItem<TItem>("liquor", barId)],
    categories: [
      ...categories,
      openCategory<TCat>("food", foodId),
      openCategory<TCat>("liquor", barId),
    ],
  };
}
