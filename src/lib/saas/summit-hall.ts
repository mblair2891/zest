/**
 * Isolated generic demo peer venue — Summit Hall.
 * Not a customer house. No real emails. PINs are floor-only (not owner password).
 */
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABEL,
  DEFAULT_TARGET_COST_PCT,
  type CostSku,
  type CostSettings,
  type ItemRecipe,
} from "@/lib/costs/types";
import type { QrPolicy } from "@/lib/pos/qr-policy";
import type { EmployeeRole, MenuCategory, MenuItem } from "@/lib/pos/types";
import type { LocationFloorPlan } from "./location-catalog";

export const SUMMIT_HALL_ORG_ID = "org_summit_hall";
export const SUMMIT_HALL_LOCATION_ID = "loc_summit_hall";
export const SUMMIT_HALL_SLUG = "summit-hall";
export const SUMMIT_HALL_NAME = "Summit Hall";
export const SUMMIT_HEARTH_OP_ID = "opr_summit_hearth";
export const SUMMIT_COPPER_OP_ID = "opr_summit_copper";

export const SUMMIT_HALL_QR_POLICY: QrPolicy = {
  flags: ["reorder_after_open", "pay_only", "print_qr_on_ticket", "table_tents"],
  orderAllow: "food_and_drinks",
  payAllow: "both",
  split: "by_item",
  tip: true,
  alcoholAgeAffirm: true,
  afterPay: "keep_open_for_reorder",
  ticketQrTtlSec: 15 * 60,
};

export type SummitStaffSpec = {
  id: string;
  pin: string;
  name: string;
  role: EmployeeRole;
  operatorId: string | null;
  color: string;
  title: string;
  homeView?: "kitchen" | "bar" | "floor" | "host";
};

/** Floor PIN roster. No 0000. PIN login is not clock-in. */
export const SUMMIT_HALL_STAFF: readonly SummitStaffSpec[] = [
  {
    id: "emp_summit_host",
    pin: "1111",
    name: "Host",
    role: "host",
    operatorId: null,
    color: "#9A6700",
    title: "Host stand",
    homeView: "host",
  },
  {
    id: "emp_summit_server",
    pin: "2222",
    name: "Server",
    role: "server",
    operatorId: SUMMIT_HEARTH_OP_ID,
    color: "#1F7A4C",
    title: "Server · Hearth",
  },
  {
    id: "emp_summit_bartender",
    pin: "3333",
    name: "Bartender",
    role: "bartender",
    operatorId: SUMMIT_COPPER_OP_ID,
    color: "#2C4A6E",
    title: "Bartender · Copper",
    homeView: "bar",
  },
  {
    id: "emp_summit_kitchen",
    pin: "4444",
    name: "Kitchen",
    role: "kitchen",
    operatorId: SUMMIT_HEARTH_OP_ID,
    color: "#A61B1B",
    title: "Kitchen · Hearth",
    homeView: "kitchen",
  },
  {
    id: "emp_summit_supervisor",
    pin: "5555",
    name: "Supervisor",
    role: "manager",
    operatorId: null,
    color: "#5C5C5C",
    title: "Supervisor",
  },
  {
    id: "emp_summit_manager",
    pin: "9999",
    name: "Manager",
    role: "owner",
    operatorId: null,
    color: "#2C4A6E",
    title: "Manager",
  },
  {
    id: "emp_summit_busser",
    pin: "6666",
    name: "Busser",
    role: "busser",
    operatorId: null,
    color: "#4A5568",
    title: "Busser",
  },
];

export const SUMMIT_HALL_CATEGORIES: MenuCategory[] = [
  { id: "cat_hearth_plates", name: "Plates", sort: 0, color: "#9A6700", station: "kitchen" },
  { id: "cat_hearth_sandwich", name: "Sandwich", sort: 1, color: "#B45309", station: "kitchen" },
  { id: "cat_hearth_sides", name: "Sides", sort: 2, color: "#A16207", station: "kitchen" },
  { id: "cat_hearth_dessert", name: "Dessert", sort: 3, color: "#854D0E", station: "kitchen" },
  { id: "cat_copper_cocktails", name: "Cocktails", sort: 10, color: "#2C4A6E", station: "bar" },
  { id: "cat_copper_beer", name: "Beer", sort: 11, color: "#1E3A5F", station: "bar" },
  { id: "cat_copper_wine", name: "Wine", sort: 12, color: "#7F1D1D", station: "bar" },
  { id: "cat_copper_na", name: "NA", sort: 13, color: "#0F766E", station: "bar" },
];

function hearthItem(
  id: string,
  name: string,
  categoryId: string,
  priceCents: number,
  course: MenuItem["course"],
  description: string,
): MenuItem {
  return {
    id,
    name,
    categoryId,
    priceCents,
    course,
    station: "kitchen",
    description,
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId: SUMMIT_HEARTH_OP_ID,
  };
}

function copperItem(
  id: string,
  name: string,
  categoryId: string,
  priceCents: number,
  description: string,
): MenuItem {
  return {
    id,
    name,
    categoryId,
    priceCents,
    course: "drink",
    station: "bar",
    description,
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId: SUMMIT_COPPER_OP_ID,
  };
}

export const SUMMIT_HALL_MENU: MenuItem[] = [
  hearthItem("itm_hearth_chicken", "Summit roast chicken", "cat_hearth_plates", 1800, "entree", "Half chicken, herb butter, pan jus. Hearth Kitchen."),
  hearthItem("itm_hearth_steak", "Pan steak", "cat_hearth_plates", 2200, "entree", "Seared steak, potatoes. Hearth Kitchen."),
  hearthItem("itm_hearth_salmon", "Herb salmon", "cat_hearth_plates", 2100, "entree", "Roasted salmon, lemon. Hearth Kitchen."),
  hearthItem("itm_hearth_pasta", "Market pasta", "cat_hearth_plates", 1600, "entree", "Seasonal pasta, house sauce. Hearth Kitchen."),
  hearthItem("itm_hearth_club", "Hearth club", "cat_hearth_sandwich", 1400, "entree", "Turkey, bacon, tomato on toast. Hearth Kitchen."),
  hearthItem("itm_hearth_grilled_cheese", "Grilled cheese", "cat_hearth_sandwich", 1100, "entree", "Cheddar, tomato, sourdough. Hearth Kitchen."),
  hearthItem("itm_hearth_potatoes", "Roasted potatoes", "cat_hearth_sides", 600, "side", "Crisp potatoes. Hearth Kitchen."),
  hearthItem("itm_hearth_salad", "House salad", "cat_hearth_sides", 700, "side", "Greens, vinaigrette. Hearth Kitchen."),
  hearthItem("itm_hearth_veg", "Seasonal veg", "cat_hearth_sides", 550, "side", "Market vegetables. Hearth Kitchen."),
  hearthItem("itm_hearth_chocolate", "Chocolate pot", "cat_hearth_dessert", 800, "dessert", "Dark chocolate pot. Hearth Kitchen."),
  hearthItem("itm_hearth_tart", "Citrus tart", "cat_hearth_dessert", 750, "dessert", "Lemon tart, cream. Hearth Kitchen."),
  copperItem("itm_copper_mule", "Copper mule", "cat_copper_cocktails", 1200, "Vodka, ginger, lime. Copper Bar."),
  copperItem("itm_copper_fashioned", "Hall old fashioned", "cat_copper_cocktails", 1400, "Bourbon, bitters, orange. Copper Bar."),
  copperItem("itm_copper_sour", "Summit sour", "cat_copper_cocktails", 1300, "Whiskey, lemon, foam. Copper Bar."),
  copperItem("itm_copper_spritz", "Hall spritz", "cat_copper_cocktails", 1100, "Aperitif, bubbles, orange. Copper Bar."),
  copperItem("itm_copper_lager", "Draft lager", "cat_copper_beer", 700, "Pint. Copper Bar."),
  copperItem("itm_copper_ipa", "House IPA", "cat_copper_beer", 800, "Pint. Copper Bar."),
  copperItem("itm_copper_red", "House red", "cat_copper_wine", 900, "Glass. Copper Bar."),
  copperItem("itm_copper_white", "House white", "cat_copper_wine", 900, "Glass. Copper Bar."),
  copperItem("itm_copper_sparkling", "Sparkling water", "cat_copper_na", 400, "Bottle. Copper Bar."),
  copperItem("itm_copper_soda", "House soda", "cat_copper_na", 350, "Fountain. Copper Bar."),
  copperItem("itm_copper_zero_mule", "Zero mule", "cat_copper_na", 800, "Ginger, lime, no spirit. Copper Bar."),
];

export const SUMMIT_HALL_SKUS: CostSku[] = [
  sku("sku_chicken", "Chicken (half)", "food", SUMMIT_HEARTH_OP_ID, "each", 18, 24, 420),
  sku("sku_steak", "Steak (ea)", "food", SUMMIT_HEARTH_OP_ID, "each", 12, 16, 780),
  sku("sku_salmon", "Salmon (ea)", "food", SUMMIT_HEARTH_OP_ID, "each", 10, 14, 640),
  sku("sku_pasta", "Fresh pasta (lb)", "food", SUMMIT_HEARTH_OP_ID, "lb", 8, 12, 280),
  sku("sku_turkey", "Sliced turkey (lb)", "food", SUMMIT_HEARTH_OP_ID, "lb", 6, 10, 320),
  sku("sku_bacon", "Bacon (lb)", "food", SUMMIT_HEARTH_OP_ID, "lb", 5, 8, 360),
  sku("sku_bread", "Pullman loaf", "food", SUMMIT_HEARTH_OP_ID, "each", 6, 8, 240),
  sku("sku_cheddar", "Cheddar (lb)", "food", SUMMIT_HEARTH_OP_ID, "lb", 4, 6, 380),
  sku("sku_potato", "Potatoes (lb)", "food", SUMMIT_HEARTH_OP_ID, "lb", 20, 30, 90),
  sku("sku_greens", "Mixed greens (lb)", "food", SUMMIT_HEARTH_OP_ID, "lb", 8, 12, 220),
  sku("sku_vinaigrette", "House vinaigrette", "food", SUMMIT_HEARTH_OP_ID, "qt", 4, 6, 180),
  sku("sku_chocolate", "Dark chocolate (lb)", "food", SUMMIT_HEARTH_OP_ID, "lb", 3, 5, 540),
  sku("sku_cream", "Heavy cream (qt)", "food", SUMMIT_HEARTH_OP_ID, "qt", 6, 8, 260),
  sku("sku_bourbon", "Well bourbon", "liquor", SUMMIT_COPPER_OP_ID, "btl", 6, 10, 2200),
  sku("sku_vodka", "Well vodka", "liquor", SUMMIT_COPPER_OP_ID, "btl", 6, 10, 1800),
  sku("sku_ginger", "Ginger beer (cs)", "other", SUMMIT_COPPER_OP_ID, "cs", 4, 6, 1600),
  sku("sku_lime", "Limes (ea)", "food", SUMMIT_COPPER_OP_ID, "each", 40, 60, 25),
  sku("sku_lager_keg", "Lager keg", "beer", SUMMIT_COPPER_OP_ID, "keg", 2, 3, 9800),
  sku("sku_red_wine", "House red (btl)", "wine", SUMMIT_COPPER_OP_ID, "btl", 8, 12, 900),
];

function sku(
  id: string,
  name: string,
  category: CostSku["category"],
  entityId: string,
  unit: string,
  onHand: number,
  par: number,
  costCents: number,
): CostSku {
  return {
    id,
    name,
    category,
    entityId,
    unit,
    packSize: 1,
    packLabel: unit,
    onHand,
    par,
    parMin: Math.max(1, Math.round(par * 0.6)),
    parMax: Math.round(par * 1.4),
    costCents,
    leadDays: 2,
  };
}

function recipe(
  id: string,
  menuItemId: string,
  name: string,
  entityId: string,
  station: ItemRecipe["station"],
  lines: ItemRecipe["lines"],
  steps: ItemRecipe["steps"],
  extra?: Partial<ItemRecipe>,
): ItemRecipe {
  return {
    id,
    menuItemId,
    menuItemIds: [menuItemId],
    name,
    entityId,
    station,
    wasteFactor: 0.04,
    yieldQty: 1,
    yieldUnit: station === "bar" ? "drink" : "plate",
    allergens: extra?.allergens ?? [],
    dietary: extra?.dietary ?? [],
    steps,
    lines,
    ...extra,
  };
}

export const SUMMIT_HALL_RECIPES: ItemRecipe[] = [
  recipe(
    "rec_hearth_chicken",
    "itm_hearth_chicken",
    "Summit roast chicken",
    SUMMIT_HEARTH_OP_ID,
    "kitchen",
    [
      { name: "Chicken (half)", skuId: "sku_chicken", qty: 1, unit: "each" },
      { name: "Potatoes", skuId: "sku_potato", qty: 0.4, unit: "lb" },
    ],
    [
      { text: "Season and roast chicken", seconds: 2400 },
      { text: "Roast potatoes in pan drippings", seconds: 900 },
      { text: "Plate with herb butter" },
    ],
  ),
  recipe(
    "rec_hearth_club",
    "itm_hearth_club",
    "Hearth club",
    SUMMIT_HEARTH_OP_ID,
    "kitchen",
    [
      { name: "Pullman", skuId: "sku_bread", qty: 0.12, unit: "each" },
      { name: "Turkey", skuId: "sku_turkey", qty: 0.25, unit: "lb" },
      { name: "Bacon", skuId: "sku_bacon", qty: 0.08, unit: "lb" },
    ],
    [
      { text: "Toast bread" },
      { text: "Stack turkey, bacon, tomato" },
      { text: "Cut and plate" },
    ],
    { allergens: ["gluten"] },
  ),
  recipe(
    "rec_hearth_salad",
    "itm_hearth_salad",
    "House salad",
    SUMMIT_HEARTH_OP_ID,
    "kitchen",
    [
      { name: "Mixed greens", skuId: "sku_greens", qty: 0.2, unit: "lb" },
      { name: "Vinaigrette", skuId: "sku_vinaigrette", qty: 0.08, unit: "qt" },
    ],
    [{ text: "Wash greens" }, { text: "Toss and plate" }],
    { dietary: ["vegetarian"] },
  ),
  recipe(
    "rec_hearth_chocolate",
    "itm_hearth_chocolate",
    "Chocolate pot",
    SUMMIT_HEARTH_OP_ID,
    "dessert",
    [
      { name: "Dark chocolate", skuId: "sku_chocolate", qty: 0.12, unit: "lb" },
      { name: "Cream", skuId: "sku_cream", qty: 0.1, unit: "qt" },
    ],
    [{ text: "Melt chocolate with cream" }, { text: "Chill and serve" }],
    { allergens: ["dairy"], yieldUnit: "each" },
  ),
  recipe(
    "rec_copper_mule",
    "itm_copper_mule",
    "Copper mule",
    SUMMIT_COPPER_OP_ID,
    "bar",
    [
      { name: "Vodka", skuId: "sku_vodka", qty: 2, unit: "oz" },
      { name: "Ginger beer", skuId: "sku_ginger", qty: 4, unit: "oz" },
      { name: "Lime", skuId: "sku_lime", qty: 0.5, unit: "each" },
    ],
    [
      { text: "Build over ice in copper mug" },
      { text: "Top ginger beer; lime wedge" },
    ],
    { glassware: "Mule mug", garnish: "Lime wedge" },
  ),
  recipe(
    "rec_copper_fashioned",
    "itm_copper_fashioned",
    "Hall old fashioned",
    SUMMIT_COPPER_OP_ID,
    "bar",
    [
      { name: "Bourbon", skuId: "sku_bourbon", qty: 2, unit: "oz" },
      { name: "Lime", skuId: "sku_lime", qty: 0.1, unit: "each" },
    ],
    [
      { text: "Stir bourbon, sugar, bitters with ice", seconds: 20 },
      { text: "Strain over ice; orange" },
    ],
    { glassware: "Rocks", garnish: "Orange peel" },
  ),
  recipe(
    "rec_copper_lager",
    "itm_copper_lager",
    "Draft lager",
    SUMMIT_COPPER_OP_ID,
    "bar",
    [{ name: "Lager", skuId: "sku_lager_keg", qty: 16, unit: "oz" }],
    [{ text: "Pour pint; settle foam" }],
    { glassware: "Pint", yieldUnit: "pint" },
  ),
  recipe(
    "rec_copper_red",
    "itm_copper_red",
    "House red",
    SUMMIT_COPPER_OP_ID,
    "bar",
    [{ name: "House red", skuId: "sku_red_wine", qty: 5, unit: "oz" }],
    [{ text: "Pour 5 oz glass" }],
    { glassware: "Wine", yieldUnit: "glass" },
  ),
];

export const SUMMIT_HALL_COST_SETTINGS: CostSettings = {
  targetCostPct: { ...DEFAULT_TARGET_COST_PCT },
  itemTargetCostPct: {},
  poApproveThresholdCents: 50_000,
  varianceAlertPct: 8,
  defaultWasteFactor: 0.04,
  categories: COST_CATEGORIES.map((id) => ({ id, label: COST_CATEGORY_LABEL[id] })),
  theoreticalIncludeVoids: false,
  theoreticalIncludeComps: true,
};

export function summitHallFloorPlan(): LocationFloorPlan {
  const dining = [1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => ({
    id: `t_summit_${n}`,
    label: String(n),
    section: "Dining",
    seats: 4,
    x: 10 + (i % 4) * 20,
    y: 12 + Math.floor(i / 4) * 28,
    w: 14,
    h: 14,
    shape: "round" as const,
    kind: "table" as const,
  }));
  const bar = [1, 2, 3, 4, 5, 6].map((n, i) => ({
    id: `t_summit_b${n}`,
    label: `B${n}`,
    section: "Bar",
    seats: 1,
    x: 8 + i * 14,
    y: 78,
    w: 10,
    h: 10,
    shape: "bar" as const,
    kind: "barstool" as const,
  }));
  return {
    tables: [...dining, ...bar],
    sections: [
      { id: "sec_summit_dining", name: "Dining", color: "sec-1", sort: 0 },
      { id: "sec_summit_bar", name: "Bar", color: "sec-3", sort: 1 },
    ],
  };
}

export function isSummitHallOrgId(id: string | null | undefined): boolean {
  return id === SUMMIT_HALL_ORG_ID;
}

export function isSummitHallLocationId(id: string | null | undefined): boolean {
  return id === SUMMIT_HALL_LOCATION_ID;
}

export function hearthMenuCount(): number {
  return SUMMIT_HALL_MENU.filter((m) => m.vendorId === SUMMIT_HEARTH_OP_ID).length;
}

export function copperMenuCount(): number {
  return SUMMIT_HALL_MENU.filter((m) => m.vendorId === SUMMIT_COPPER_OP_ID).length;
}
