import { employeesForVenue, venueById } from "@/lib/pos/entities";
import { laundryPosSlice } from "@/lib/pos/laundry-seed";
import { defaultPackagesForMode, SUMMEX_PACKAGES, type PackageId } from "@/lib/pos/packages";
import type { SaasLocation, SaasOrganization } from "@/lib/pos/saas-types";
import {
  STARTER_CATEGORIES,
  STARTER_MENU,
  STARTER_MODIFIERS,
  starterSettings,
  starterSettlement,
  starterTables,
  starterVendor,
} from "@/lib/pos/starter-seed";
import type {
  Employee,
  FloorSection,
  MenuCategory,
  MenuItem,
  Table,
  Vendor,
  VenueEntityId,
} from "@/lib/pos/types";
import { DEMO_CATALOG, demoLocationId, demoOrgId } from "./catalog";

function allPackageIds(): PackageId[] {
  return SUMMEX_PACKAGES.map((p) => p.id);
}

function extraMenu(type: VenueEntityId): { categories: MenuCategory[]; items: MenuItem[] } {
  if (type === "bar_lounge") {
    return {
      categories: [
        { id: "cat_cocktails", name: "Cocktails", sort: 0, color: "#2C4A6E", station: "bar" },
        { id: "cat_beer", name: "Beer & wine", sort: 1, color: "#5b9fd4", station: "bar" },
        { id: "cat_plates", name: "Small plates", sort: 2, color: "#9A6700", station: "kitchen" },
      ],
      items: [
        {
          id: "itm_highball",
          name: "House highball",
          categoryId: "cat_cocktails",
          priceCents: 1400,
          course: "drink",
          station: "bar",
          modifierGroupIds: [],
          available: true,
        },
        {
          id: "itm_negroni",
          name: "Negroni",
          categoryId: "cat_cocktails",
          priceCents: 1600,
          course: "drink",
          station: "bar",
          modifierGroupIds: [],
          available: true,
        },
        {
          id: "itm_lager",
          name: "Draft lager",
          categoryId: "cat_beer",
          priceCents: 800,
          course: "drink",
          station: "bar",
          modifierGroupIds: [],
          available: true,
        },
        {
          id: "itm_olives",
          name: "Marinated olives",
          categoryId: "cat_plates",
          priceCents: 900,
          course: "appetizer",
          station: "kitchen",
          modifierGroupIds: [],
          available: true,
        },
      ],
    };
  }
  if (type === "cafe") {
    return {
      categories: [
        { id: "cat_espresso", name: "Espresso", sort: 0, color: "#2C4A6E", station: "bar" },
        { id: "cat_pastry", name: "Pastry", sort: 1, color: "#9A6700", station: "kitchen" },
      ],
      items: [
        {
          id: "itm_latte",
          name: "Latte",
          categoryId: "cat_espresso",
          priceCents: 550,
          course: "drink",
          station: "bar",
          modifierGroupIds: [],
          available: true,
        },
        {
          id: "itm_drip",
          name: "Drip coffee",
          categoryId: "cat_espresso",
          priceCents: 350,
          course: "drink",
          station: "bar",
          modifierGroupIds: [],
          available: true,
        },
        {
          id: "itm_croissant",
          name: "Butter croissant",
          categoryId: "cat_pastry",
          priceCents: 450,
          course: "side",
          station: "kitchen",
          modifierGroupIds: [],
          available: true,
        },
      ],
    };
  }
  if (type === "qsr") {
    return {
      categories: [
        { id: "cat_mains", name: "Mains", sort: 0, color: "#2C4A6E", station: "kitchen" },
        { id: "cat_sides", name: "Sides", sort: 1, color: "#94a3b8", station: "kitchen" },
        { id: "cat_drinks", name: "Drinks", sort: 2, color: "#e5a320", station: "bar" },
      ],
      items: [
        {
          id: "itm_burger",
          name: "Cheeseburger",
          categoryId: "cat_mains",
          priceCents: 1200,
          course: "entree",
          station: "kitchen",
          modifierGroupIds: [],
          available: true,
        },
        {
          id: "itm_fries",
          name: "Fries",
          categoryId: "cat_sides",
          priceCents: 400,
          course: "side",
          station: "kitchen",
          modifierGroupIds: [],
          available: true,
        },
        {
          id: "itm_soda",
          name: "Fountain soda",
          categoryId: "cat_drinks",
          priceCents: 300,
          course: "drink",
          station: "bar",
          modifierGroupIds: [],
          available: true,
        },
      ],
    };
  }
  return {
    categories: STARTER_CATEGORIES.map((c) => ({ ...c })),
    items: STARTER_MENU.map((m) => ({ ...m })),
  };
}

function demoTables(type: VenueEntityId, locationId: string): Table[] {
  if (type === "ghost_kitchen") return [];
  if (type === "qsr" || type === "cafe") {
    return [
      {
        id: "t_counter",
        label: "C1",
        section: "Counter",
        seats: 1,
        x: 20,
        y: 20,
        w: 16,
        h: 10,
        shape: "rect",
        status: "available",
        locationId,
      },
    ];
  }
  return starterTables().map((t) => ({ ...t, locationId }));
}

function demoSections(type: VenueEntityId): FloorSection[] {
  if (type === "ghost_kitchen") return [];
  if (type === "qsr" || type === "cafe") {
    return [{ id: "sec_counter", name: "Counter", color: "sec-1", sort: 0 }];
  }
  if (type === "bar_lounge") {
    return [
      { id: "sec_bar", name: "Bar", color: "sec-3", sort: 0 },
      { id: "sec_lounge", name: "Lounge", color: "sec-1", sort: 1 },
    ];
  }
  return [
    { id: "sec_dining", name: "Dining", color: "sec-1", sort: 0 },
    { id: "sec_bar", name: "Bar", color: "sec-3", sort: 1 },
  ];
}

export function demoPosSlice(type: VenueEntityId) {
  if (type === "food_hall") return laundryPosSlice();

  const entry = DEMO_CATALOG.find((d) => d.type === type)!;
  const locId = demoLocationId(type);
  const ent = venueById(type);
  const staff: Employee[] = employeesForVenue(type).map((e) => ({
    ...e,
    clockedIn: true,
    clockInAt: Date.now(),
  }));
  const menu = extraMenu(type);
  const tables = demoTables(type, locId);
  const settings = starterSettings(entry.hostName);
  settings.address = `DEMO · ${entry.hostName}`;
  settings.receiptFooter = `${entry.hostName} · Prospect demo · Quantum Payments`;
  settings.multiTenantHallMode = false;
  settings.cashDiscountEnabled = true;
  settings.cashDiscountPercent = 5;
  settings.cashRoundIncrement = 0.25;
  settings.cashRoundMode = "up";
  const vendor: Vendor = {
    ...starterVendor(),
    id: `vnd_demo_${type}`,
    name: entry.hostName,
    shortName: entry.shortName,
    locationId: locId,
  };
  const defaultView = ent?.defaultView ?? "order";
  return {
    tenantLocationId: locId,
    settings,
    employees: staff.length ? staff : employeesForVenue("restaurant"),
    currentEmployeeId: null as string | null,
    categories: menu.categories,
    menuItems: menu.items,
    modifierGroups: STARTER_MODIFIERS.map((g) => ({
      ...g,
      options: g.options.map((o) => ({ ...o })),
    })),
    tables,
    orders: [],
    tickets: [],
    waitlist: [],
    reservations: [],
    vendors: [vendor],
    inventory: menu.items.slice(0, 4).map((it, i) => ({
      id: `inv_demo_${type}_${i}`,
      name: `${it.name} cost`,
      unit: "ea",
      onHand: 12,
      par: 16,
      costCents: Math.round(it.priceCents * 0.32),
      linkedMenuItemIds: [it.id],
      lowStock: false,
    })),
    settlementConfig: {
      ...starterSettlement(entry.hostName),
      locationId: locId,
      locationName: entry.hostName,
      hostCutEnabled: false,
    },
    settlementPeriods: [],
    chargebacks: [],
    ledgerEntries: [],
    extraTableGrants: [],
    sectionOverrides: {} as Record<string, string[]>,
    floorSections: demoSections(type),
    activeEntityId: type,
    view: defaultView,
    activeOrderId: null as string | null,
    activeTableId: null as string | null,
    selectedCategoryId: menu.categories[0]?.id ?? null,
    selectedLineId: null as string | null,
  };
}

export function demoSaasOrg(type: VenueEntityId): {
  org: SaasOrganization;
  location: SaasLocation;
} {
  const entry = DEMO_CATALOG.find((d) => d.type === type)!;
  const locId = demoLocationId(type);
  const orgId = demoOrgId(type);
  return {
    org: {
      id: orgId,
      name: `${entry.hostName} (demo)`,
      legalName: `${entry.hostName} Demo`,
      plan: "platform_internal",
      seats: 99,
      locationsIncluded: 9,
      merchantsIncluded: 40,
      billingEmail: "",
      status: "active",
      createdAt: Date.now(),
    },
    location: {
      id: locId,
      orgId,
      name: entry.hostName,
      code: type.toUpperCase().slice(0, 8),
      address: `DEMO · ${entry.hostName}`,
      mode: type,
      timezone: "America/Los_Angeles",
      open: true,
      enabledPackages: allPackageIds().length
        ? allPackageIds()
        : defaultPackagesForMode(type),
    },
  };
}
