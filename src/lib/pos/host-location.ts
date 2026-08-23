import { uid } from "@/lib/utils";
import type {
  Employee,
  MenuCategory,
  MenuItem,
  RestaurantSettings,
  SettlementConfig,
  Table,
  TicketStation,
  VenueEntityId,
  Vendor,
} from "./types";
import type {
  LocationMenuCategory,
  LocationMenuItem,
  LocationOperator,
  SaasLocation,
} from "./saas-types";
import { SETTINGS } from "./seed";
import { isVenueEntityId } from "./entities";

const OP_COLORS = [
  "#94a3b8",
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#67e8f9",
  "#86efac",
  "#c4b5fd",
];

export function nextOperatorColor(index: number): string {
  return OP_COLORS[index % OP_COLORS.length]!;
}

export function operatorOwnsItem(
  op: LocationOperator,
  item: LocationMenuItem,
): boolean {
  if (op.ownedItemIds.includes(item.id)) return true;
  return op.ownedCategoryIds.includes(item.categoryId);
}

export function ownerForItem(
  operators: LocationOperator[],
  item: LocationMenuItem,
): LocationOperator | undefined {
  const byItem = operators.find(
    (o) => o.active && o.ownedItemIds.includes(item.id),
  );
  if (byItem) return byItem;
  return operators.find(
    (o) => o.active && o.ownedCategoryIds.includes(item.categoryId),
  );
}

export function stationForOperatorItem(
  itemStation: TicketStation,
  operator?: LocationOperator | Vendor | null,
): TicketStation {
  const kind =
    operator && "stationType" in operator ? operator.stationType : undefined;
  if (kind === "bar") return "bar";
  if (kind === "kitchen") return "kitchen";
  return itemStation === "bar" || itemStation === "kitchen"
    ? itemStation
    : "kitchen";
}

export interface HostLocationOnboardingStatus {
  hostBrand: boolean;
  operatorCount: number;
  operatorsOk: boolean;
  categories: number;
  items: number;
  routedOperators: number;
  ready: boolean;
  missing: string[];
}

export function hostLocationStatus(
  location: SaasLocation | undefined,
  operators: LocationOperator[],
  categories: LocationMenuCategory[],
  items: LocationMenuItem[],
): HostLocationOnboardingStatus {
  const ops = operators.filter((o) => o.active);
  const cats = categories;
  const missing: string[] = [];
  const hostBrand = Boolean(location?.hostBrandName?.trim());
  if (!hostBrand) missing.push("Set the host brand name");
  if (ops.length < 2) missing.push("Add at least two operators");
  const routed = ops.filter((o) => {
    const ownsCat = o.ownedCategoryIds.some((id) =>
      cats.some((c) => c.id === id),
    );
    const ownsItem = o.ownedItemIds.some((id) => items.some((i) => i.id === id));
    return Boolean(o.stationType) && (ownsCat || ownsItem);
  });
  if (ops.length >= 2 && routed.length < 2) {
    missing.push("Route each operator to a station and menu they own");
  }
  if (items.length === 0) missing.push("Add menu items (or generate a starter catalog)");
  const ready =
    hostBrand &&
    ops.length >= 2 &&
    routed.length >= 2 &&
    items.length > 0 &&
    location?.operatingModel === "host_multi_operator";
  return {
    hostBrand,
    operatorCount: ops.length,
    operatorsOk: ops.length >= 2,
    categories: cats.length,
    items: items.length,
    routedOperators: routed.length,
    ready: Boolean(ready),
    missing,
  };
}

export interface CompiledHostPos {
  settings: RestaurantSettings;
  employees: Employee[];
  categories: MenuCategory[];
  menuItems: MenuItem[];
  vendors: Vendor[];
  tables: Table[];
  settlementConfig: SettlementConfig;
  entityId: VenueEntityId;
  hostBrandName: string;
}

const STAFF: Array<{
  suffix: string;
  name: string;
  pin: string;
  role: Employee["role"];
  title: string;
  color: string;
  homeView: Employee["homeView"];
  extraViews?: Employee["extraViews"];
}> = [
  {
    suffix: "owner",
    name: "House Owner",
    pin: "9999",
    role: "owner",
    title: "Owner",
    color: "#c8f542",
    homeView: "floor",
  },
  {
    suffix: "mgr",
    name: "House Manager",
    pin: "0000",
    role: "manager",
    title: "Manager",
    color: "#94a3b8",
    homeView: "floor",
  },
  {
    suffix: "srv",
    name: "Floor Server",
    pin: "1111",
    role: "server",
    title: "Server",
    color: "#7dd3fc",
    homeView: "floor",
  },
  {
    suffix: "kit",
    name: "Kitchen Station",
    pin: "2222",
    role: "kitchen",
    title: "Kitchen",
    color: "#fcd34d",
    homeView: "kitchen",
  },
  {
    suffix: "bar",
    name: "Bar Station",
    pin: "3333",
    role: "bartender",
    title: "Bartender",
    color: "#fca5a5",
    homeView: "bar",
  },
];

function hostTables(locationId: string): Table[] {
  const dining: Table[] = [
    { label: "1", seats: 2, x: 8, y: 14, w: 10, h: 10, shape: "round" as const },
    { label: "2", seats: 2, x: 24, y: 14, w: 10, h: 10, shape: "round" as const },
    { label: "3", seats: 4, x: 40, y: 12, w: 14, h: 12, shape: "rect" as const },
    { label: "4", seats: 4, x: 58, y: 12, w: 14, h: 12, shape: "rect" as const },
    { label: "5", seats: 4, x: 76, y: 12, w: 14, h: 12, shape: "rect" as const },
    { label: "6", seats: 6, x: 8, y: 34, w: 18, h: 14, shape: "rect" as const },
    { label: "7", seats: 6, x: 32, y: 34, w: 18, h: 14, shape: "rect" as const },
    { label: "8", seats: 4, x: 56, y: 36, w: 14, h: 12, shape: "round" as const },
    { label: "9", seats: 4, x: 74, y: 36, w: 14, h: 12, shape: "round" as const },
    { label: "10", seats: 8, x: 14, y: 58, w: 22, h: 14, shape: "rect" as const },
  ].map((t) => ({
    id: `t_${locationId}_${t.label}`,
    section: "Dining",
    status: "available" as const,
    locationId,
    ...t,
  }));
  const bar: Table[] = ["B1", "B2", "B3", "B4", "B5", "B6"].map((label, i) => ({
    id: `t_${locationId}_${label}`,
    label,
    section: "Bar",
    seats: 1,
    x: 10 + i * 12,
    y: 80,
    w: 8,
    h: 8,
    shape: "bar" as const,
    status: "available" as const,
    locationId,
  }));
  return [...dining, ...bar];
}

export function compileHostLocationPos(input: {
  location: SaasLocation;
  operators: LocationOperator[];
  categories: LocationMenuCategory[];
  items: LocationMenuItem[];
}): CompiledHostPos {
  const { location, operators, categories, items } = input;
  const hostBrandName = location.hostBrandName?.trim() || location.name;
  const entityId: VenueEntityId = isVenueEntityId(location.mode)
    ? location.mode
    : "restaurant";
  const ops = operators.filter((o) => o.active);

  const vendors: Vendor[] = ops.map((o) => ({
    id: o.id,
    name: o.name,
    shortName: o.shortName || o.name,
    locationId: location.id,
    color: o.color,
    cuisine: "",
    active: o.active,
    bankLast4: o.payoutLast4,
    bankLabel: o.payoutAccountLabel,
    stationLabel:
      o.stationType === "both"
        ? "Bar + kitchen"
        : o.stationType === "bar"
          ? "Bar"
          : "Kitchen",
    stationType: o.stationType,
  }));

  const posCategories: MenuCategory[] = categories
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((c) => ({
      id: c.id,
      name: c.name,
      sort: c.sort,
      color: c.color,
      station: c.station,
    }));

  const posItems: MenuItem[] = items.map((it) => {
    const cat = categories.find((c) => c.id === it.categoryId);
    const owner = ownerForItem(ops, it);
    const baseStation: TicketStation = it.station ?? cat?.station ?? "kitchen";
    const station = stationForOperatorItem(baseStation, owner);
    const course = it.course;
    return {
      id: it.id,
      name: it.name,
      categoryId: it.categoryId,
      priceCents: it.priceCents,
      course,
      station,
      description: it.description,
      modifierGroupIds: [],
      available: it.available,
      vendorId: owner?.id,
    };
  });

  const now = Date.now();
  const employees: Employee[] = STAFF.map((s) => ({
    id: `emp_${location.id}_${s.suffix}`,
    name: s.name,
    pin: s.pin,
    role: s.role,
    color: s.color,
    clockedIn: true,
    clockInAt: now - 1000 * 60 * 30,
    tipsEarned: 0,
    salesTotal: 0,
    active: true,
    entityId,
    title: s.title,
    homeView: s.homeView,
    extraViews: s.extraViews,
    homeSectionIds:
      s.role === "bartender"
        ? ["sec_bar"]
        : s.role === "server" || s.role === "host" || s.role === "busser"
          ? ["sec_dining", "sec_booth", "sec_bar"]
          : [],
  }));

  const periodStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d.getTime();
  })();

  const settings: RestaurantSettings = {
    ...SETTINGS,
    name: hostBrandName,
    address: location.address || SETTINGS.address,
    receiptFooter: `Thank you for dining at ${hostBrandName}. Charged via Zest Payments.`,
    multiTenantHallMode: true,
    hostMultiOperator: true,
  };

  const settlementConfig: SettlementConfig = {
    locationId: location.id,
    locationName: location.name,
    periodType: "weekly",
    customPeriodDays: 7,
    cardFeePercent: 2.9,
    hostCutEnabled: true,
    hostCutType: "percent_of_gross",
    hostCutPercent: 5,
    hostCutFixedCents: 0,
    hostName: hostBrandName,
    taxRemittedBy: "host",
    tipPoolWithVendors: false,
    currentPeriodStart: periodStart,
  };

  return {
    settings,
    employees,
    categories: posCategories,
    menuItems: posItems,
    vendors,
    tables: hostTables(location.id),
    settlementConfig,
    entityId,
    hostBrandName,
  };
}

export function starterCatalogDraft(): {
  categories: Omit<LocationMenuCategory, "id" | "locationId">[];
  items: Omit<LocationMenuItem, "id" | "locationId" | "categoryId">[][];
} {
  return {
    categories: [
      {
        name: "Drinks",
        sort: 1,
        color: "#f87171",
        station: "bar",
      },
      {
        name: "Kitchen",
        sort: 2,
        color: "#94a3b8",
        station: "kitchen",
      },
    ],
    items: [
      [
        {
          name: "House cocktail",
          priceCents: 1400,
          course: "drink",
          station: "bar",
          available: true,
        },
        {
          name: "Draft beer",
          priceCents: 800,
          course: "drink",
          station: "bar",
          available: true,
        },
        {
          name: "Soft drink",
          priceCents: 400,
          course: "drink",
          station: "bar",
          available: true,
        },
      ],
      [
        {
          name: "House starter",
          priceCents: 1200,
          course: "appetizer",
          station: "kitchen",
          available: true,
        },
        {
          name: "House plate",
          priceCents: 2200,
          course: "entree",
          station: "kitchen",
          available: true,
        },
        {
          name: "Dessert",
          priceCents: 900,
          course: "dessert",
          station: "kitchen",
          available: true,
        },
      ],
    ],
  };
}

export function codeFromName(name: string): string {
  const letters = name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w.slice(0, 3).toUpperCase())
    .join("-");
  const suffix = uid("x").slice(-4).toUpperCase();
  return (letters || "LOC") + "-" + suffix;
}
