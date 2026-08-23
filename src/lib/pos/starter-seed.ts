import type {
  Employee,
  FloorSection,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  RestaurantSettings,
  SettlementConfig,
  Table,
  Vendor,
} from "./types";
import { DEFAULT_FLOOR_SECTIONS, DEFAULT_SECTION_POLICY } from "./section-control";
import type { VenueEntityId } from "./types";

export type TenantMenuMode = "empty" | "categories" | "csv_later" | "starter";

/** Minimal POS payload for a brand-new location (DEV_DEMO=0). Not Seaport. */
export function starterSettings(venueName: string): RestaurantSettings {
  return {
    name: venueName || "New location",
    address: "",
    phone: "",
    taxRate: 0.0875,
    autoGratPercent: 0.2,
    autoGratPartySize: 6,
    happyHourEnabled: false,
    happyHourStart: 15,
    happyHourEnd: 18,
    happyHourDays: [1, 2, 3, 4, 5],
    currency: "USD",
    receiptFooter: "Thank you.",
    managerPin: "0000",
    serviceChargeLabel: "Auto-gratuity",
    multiTenantHallMode: false,
    onlineOrderingEnabled: true,
    qrOrderingEnabled: true,
    sectionPolicy: { ...DEFAULT_SECTION_POLICY },
  };
}

export function starterOwner(name: string): Employee {
  return {
    id: "emp_owner",
    name: name.trim() || "Owner",
    pin: "0000",
    role: "owner",
    color: "#2C4A6E",
    clockedIn: true,
    clockInAt: Date.now(),
    tipsEarned: 0,
    salesTotal: 0,
    active: true,
    homeSectionIds: [],
  };
}

export const STARTER_CATEGORIES: MenuCategory[] = [
  { id: "cat_starters", name: "Starters", sort: 0, color: "#2C4A6E", station: "kitchen" },
  { id: "cat_mains", name: "Mains", sort: 1, color: "#5b9fd4", station: "kitchen" },
  { id: "cat_sides", name: "Sides", sort: 2, color: "#94a3b8", station: "kitchen" },
  { id: "cat_drinks", name: "Drinks", sort: 3, color: "#e5a320", station: "bar" },
];

export const STARTER_MODIFIERS: ModifierGroup[] = [
  {
    id: "mod_notes",
    name: "Kitchen note",
    required: false,
    min: 0,
    max: 2,
    options: [
      { id: "nt_no_onion", name: "No onion", priceCents: 0 },
      { id: "nt_allergy", name: "Allergy alert", priceCents: 0 },
    ],
  },
];

export const STARTER_MENU: MenuItem[] = [
  {
    id: "mi_salad",
    name: "House salad",
    categoryId: "cat_starters",
    priceCents: 1200,
    course: "appetizer",
    station: "kitchen",
    description: "Greens, vinaigrette",
    modifierGroupIds: ["mod_notes"],
    available: true,
    online: true,
  },
  {
    id: "mi_soup",
    name: "Soup of the day",
    categoryId: "cat_starters",
    priceCents: 900,
    course: "appetizer",
    station: "kitchen",
    modifierGroupIds: [],
    available: true,
    online: true,
  },
  {
    id: "mi_burger",
    name: "Cheeseburger",
    categoryId: "cat_mains",
    priceCents: 1800,
    course: "entree",
    station: "kitchen",
    description: "Cheddar, pickle, bun",
    modifierGroupIds: ["mod_notes"],
    available: true,
    online: true,
  },
  {
    id: "mi_chicken",
    name: "Roast chicken",
    categoryId: "cat_mains",
    priceCents: 2400,
    course: "entree",
    station: "kitchen",
    modifierGroupIds: ["mod_notes"],
    available: true,
    online: true,
  },
  {
    id: "mi_fries",
    name: "Fries",
    categoryId: "cat_sides",
    priceCents: 600,
    course: "side",
    station: "kitchen",
    modifierGroupIds: [],
    available: true,
    online: true,
  },
  {
    id: "mi_tea",
    name: "Iced tea",
    categoryId: "cat_drinks",
    priceCents: 400,
    course: "drink",
    station: "bar",
    modifierGroupIds: [],
    available: true,
    online: true,
  },
  {
    id: "mi_water",
    name: "Sparkling water",
    categoryId: "cat_drinks",
    priceCents: 400,
    course: "drink",
    station: "bar",
    modifierGroupIds: [],
    available: true,
    online: true,
  },
  {
    id: "mi_wine",
    name: "House wine",
    categoryId: "cat_drinks",
    priceCents: 1100,
    course: "drink",
    station: "bar",
    modifierGroupIds: [],
    available: true,
    online: true,
  },
];

export function starterTables(): Table[] {
  const dining: Table[] = [
    { id: "t1", label: "1", section: "Dining", seats: 2, x: 8, y: 12, w: 10, h: 10, shape: "round", status: "available" },
    { id: "t2", label: "2", section: "Dining", seats: 2, x: 24, y: 12, w: 10, h: 10, shape: "round", status: "available" },
    { id: "t3", label: "3", section: "Dining", seats: 4, x: 42, y: 10, w: 14, h: 12, shape: "rect", status: "available" },
    { id: "t4", label: "4", section: "Dining", seats: 4, x: 62, y: 10, w: 14, h: 12, shape: "rect", status: "available" },
    { id: "t5", label: "5", section: "Dining", seats: 4, x: 8, y: 36, w: 14, h: 12, shape: "rect", status: "available" },
    { id: "t6", label: "6", section: "Dining", seats: 6, x: 30, y: 36, w: 18, h: 14, shape: "rect", status: "available" },
  ];
  const bar: Table[] = [
    { id: "b1", label: "B1", section: "Bar", seats: 1, x: 10, y: 78, w: 8, h: 8, shape: "bar", status: "available" },
    { id: "b2", label: "B2", section: "Bar", seats: 1, x: 22, y: 78, w: 8, h: 8, shape: "bar", status: "available" },
    { id: "b3", label: "B3", section: "Bar", seats: 1, x: 34, y: 78, w: 8, h: 8, shape: "bar", status: "available" },
    { id: "b4", label: "B4", section: "Bar", seats: 1, x: 46, y: 78, w: 8, h: 8, shape: "bar", status: "available" },
  ];
  return [...dining, ...bar];
}

export function starterVendor(): Vendor {
  return {
    id: "vnd_house",
    name: "House kitchen",
    shortName: "House",
    locationId: "loc_new",
    color: "#94a3b8",
    cuisine: "American",
    active: true,
    bankLast4: "0000",
    bankLabel: "Operating",
    stationLabel: "Line",
  };
}

export function starterSettlement(venueName: string): SettlementConfig {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return {
    locationId: "loc_new",
    locationName: venueName,
    periodType: "weekly",
    customPeriodDays: 7,
    cardFeePercent: 2.9,
    hostCutEnabled: false,
    hostCutType: "percent_of_gross",
    hostCutPercent: 0,
    hostCutFixedCents: 0,
    hostName: venueName,
    taxRemittedBy: "host",
    tipPoolWithVendors: false,
    currentPeriodStart: d.getTime(),
  };
}

export function tablesFromCount(count: number, sectionNames: string[]): Table[] {
  const sections = sectionNames.length ? sectionNames : ["Dining"];
  const n = Math.max(0, Math.floor(count));
  const out: Table[] = [];
  const cols = 6;
  for (let i = 0; i < n; i += 1) {
    const section = sections[i % sections.length]!;
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.push({
      id: `t${i + 1}`,
      label: String(i + 1),
      section,
      seats: 4,
      x: 8 + col * 14,
      y: 10 + row * 16,
      w: 12,
      h: 12,
      shape: "rect",
      status: "available",
    });
  }
  return out;
}

export function starterPosSlice(opts: {
  venueName: string;
  entityId: VenueEntityId;
  ownerName: string;
  locationId: string;
  menuMode?: TenantMenuMode;
  vendors?: Vendor[];
  tables?: Table[];
  floorSections?: FloorSection[];
  settlement?: Partial<SettlementConfig>;
  address?: string;
  hallMode?: boolean;
}) {
  const owner = starterOwner(opts.ownerName);
  const menuMode = opts.menuMode ?? "empty";
  const categories =
    menuMode === "empty" || menuMode === "csv_later"
      ? []
      : STARTER_CATEGORIES.map((c) => ({ ...c }));
  const menuItems =
    menuMode === "starter" ? STARTER_MENU.map((m) => ({ ...m })) : [];
  const hall =
    opts.hallMode ?? (opts.entityId === "food_hall" || (opts.vendors?.length ?? 0) > 1);
  const vendors =
    opts.vendors && opts.vendors.length > 0
      ? opts.vendors.map((v) => ({ ...v, locationId: opts.locationId }))
      : hall
        ? []
        : [{ ...starterVendor(), locationId: opts.locationId, name: opts.venueName, shortName: opts.venueName.slice(0, 12) }];
  const tables = opts.tables ?? (menuMode === "starter" ? starterTables() : []);
  const floorSections =
    opts.floorSections ??
    (tables.length
      ? DEFAULT_FLOOR_SECTIONS.map((s) => ({ ...s }))
      : []);
  const settings = starterSettings(opts.venueName);
  if (opts.address) settings.address = opts.address;
  settings.multiTenantHallMode = hall;
  const settlement = {
    ...starterSettlement(opts.venueName),
    locationId: opts.locationId,
    locationName: opts.venueName,
    ...opts.settlement,
  };
  return {
    tenantLocationId: opts.locationId,
    settings,
    employees: [owner],
    currentEmployeeId: owner.id,
    categories,
    menuItems,
    modifierGroups:
      menuMode === "starter"
        ? STARTER_MODIFIERS.map((g) => ({
            ...g,
            options: g.options.map((o) => ({ ...o })),
          }))
        : [],
    tables,
    orders: [],
    tickets: [],
    waitlist: [],
    reservations: [],
    customers: [],
    giftCards: [],
    inventory: [],
    vendors,
    settlementConfig: settlement,
    settlementPeriods: [],
    extraTableGrants: [],
    sectionOverrides: {},
    floorSections,
    activeEntityId: opts.entityId,
    view: "floor" as const,
    activeOrderId: null,
    activeTableId: null,
    selectedCategoryId: categories[0]?.id ?? null,
    selectedLineId: null,
    activeSeat: null,
  };
}
