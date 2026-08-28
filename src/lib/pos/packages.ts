/** Summex commercial packages — catalog + helpers */

export type PackageCategory =
  | "core"
  | "operations"
  | "commerce"
  | "intelligence"
  | "platform";

export type PackageId =
  | "pos_core"
  | "kds"
  | "host_stand"
  | "online_kiosk"
  | "labor"
  | "inventory"
  | "reports_cash"
  | "menu_admin"
  | "guests_crm"
  | "integrations"
  | "hall_settlement"
  | "vendor_portal"
  | "truck_pod"
  | "ai_inventory"
  | "drink_ai"
  | "advanced_ops"
  | "marketing_suite"
  | "location_website"
  | "saas_console";

export interface SummexPackage {
  id: PackageId;
  name: string;
  shortName: string;
  category: PackageCategory;
  tagline: string;
  /** List price USD / location / month (0 = included with any paid seat or free POS track) */
  priceMonthly: number;
  /** If true, cannot be fully removed from a live location (safety floor) */
  required?: boolean;
  /** Suggested for location modes */
  modes: Array<
    | "restaurant"
    | "food_hall"
    | "truck_pod"
    | "ghost_kitchen"
    | "catering"
    | "bar_lounge"
    | "cafe"
    | "qsr"
    | "all"
  >;
  /** Views this package unlocks in the POS shell */
  views: string[];
}

export const SUMMEX_PACKAGES: SummexPackage[] = [
  {
    id: "pos_core",
    name: "Summex POS Core",
    shortName: "POS Core",
    category: "core",
    tagline: "Floor, order, takeout, payments UI, multi-vendor lines",
    priceMonthly: 0,
    required: true,
    modes: ["all"],
    views: ["floor", "order", "takeout", "hall", "cash", "settings"],
  },
  {
    id: "kds",
    name: "Order Display (ODS)",
    shortName: "ODS",
    category: "core",
    tagline: "Station displays, Start/Bump, vendor-routed tickets",
    priceMonthly: 0,
    modes: ["all"],
    views: ["kitchen", "bar"],
  },
  {
    id: "host_stand",
    name: "Host Stand",
    shortName: "Host",
    category: "operations",
    tagline: "Waitlist, reservations, quoted waits, seat flow",
    priceMonthly: 29,
    modes: ["restaurant", "food_hall", "all"],
    views: ["waitlist"],
  },
  {
    id: "online_kiosk",
    name: "Online & Kiosk Ordering",
    shortName: "Online",
    category: "commerce",
    tagline: "Web ordering board, kiosk channel, promo codes",
    priceMonthly: 49,
    modes: ["all"],
    views: ["online"],
  },
  {
    id: "labor",
    name: "Labor & hours export",
    shortName: "Labor",
    category: "operations",
    tagline: "Schedule, clock, optional employment packets, ADP/Intuit/CSV hours feed",
    priceMonthly: 79,
    modes: ["all"],
    views: ["labor", "employees", "schedule", "hr"],
  },
  {
    id: "inventory",
    name: "Inventory & Recipes",
    shortName: "Stock",
    category: "operations",
    tagline: "Invoices, recipes, variance, PAR, purchase orders",
    priceMonthly: 49,
    modes: ["all"],
    views: ["inventory", "recipes", "purchasing"],
  },
  {
    id: "reports_cash",
    name: "Reports & Cash Drawer",
    shortName: "Reports",
    category: "operations",
    tagline: "Shift sales, tender mix, drawer open/close, audit",
    priceMonthly: 0,
    modes: ["all"],
    views: ["reports", "cash"],
  },
  {
    id: "menu_admin",
    name: "Menu Admin",
    shortName: "Menu",
    category: "operations",
    tagline: "Categories, pricing, 86 board, happy hour",
    priceMonthly: 0,
    modes: ["all"],
    views: ["menu"],
  },
  {
    id: "guests_crm",
    name: "Guests & CRM Lite",
    shortName: "Guests",
    category: "commerce",
    tagline: "Profiles, loyalty, gift cards, campaigns",
    priceMonthly: 39,
    modes: ["all"],
    views: ["customers", "campaigns", "marketing"],
  },
  {
    id: "integrations",
    name: "Integrations Hub",
    shortName: "Integrations",
    category: "platform",
    tagline: "Payroll, accounting, delivery, SMS partner catalog",
    priceMonthly: 49,
    modes: ["all"],
    views: ["integrations"],
  },
  {
    id: "hall_settlement",
    name: "Hall Multi-Vendor Settlement",
    shortName: "Settlement",
    category: "platform",
    tagline: "Single guest pay, period payouts, host cut, cash split reports",
    priceMonthly: 199,
    modes: ["food_hall", "truck_pod", "all"],
    views: ["settlement", "hq", "payouts", "ledger"],
  },
  {
    id: "vendor_portal",
    name: "Vendor Portal",
    shortName: "Vendors",
    category: "platform",
    tagline: "Merchant self-serve sales, 86, last payout snapshot",
    priceMonthly: 29,
    modes: ["food_hall", "truck_pod", "all"],
    views: ["vendor_portal"],
  },
  {
    id: "truck_pod",
    name: "Truck Pod Ops",
    shortName: "Truck pod",
    category: "platform",
    tagline: "Pad map, rent/power, lineup, amps capacity, lease invoices",
    priceMonthly: 149,
    modes: ["truck_pod"],
    views: ["truck_pod"],
  },
  {
    id: "ai_inventory",
    name: "AI Inventory Intelligence",
    shortName: "AI stock",
    category: "intelligence",
    tagline: "AI cost picture, variance exceptions, price recommendations",
    priceMonthly: 99,
    modes: ["all"],
    views: ["inventory_ai"],
  },
  {
    id: "drink_ai",
    name: "Drink AI Assist",
    shortName: "Drink AI",
    category: "intelligence",
    tagline: "Spirit/profile questionnaire, food pairing, add to check",
    priceMonthly: 39,
    modes: ["restaurant", "food_hall", "all"],
    views: ["drink_ai"],
  },
  {
    id: "advanced_ops",
    name: "Advanced Ops Pack",
    shortName: "Adv ops",
    category: "operations",
    tagline: "Floor editor, promos, catering, delivery, checklists, feature matrix",
    priceMonthly: 79,
    modes: ["all"],
    views: [
      "floor_editor",
      "promos",
      "catering",
      "delivery",
      "checklists",
      "features",
      "package",
    ],
  },
  {
    id: "marketing_suite",
    name: "Marketing & Social Suite",
    shortName: "Marketing",
    category: "commerce",
    tagline: "Social + Google connect, post calendar, email/SMS, loyalty program",
    priceMonthly: 79,
    modes: ["all"],
    views: ["marketing", "campaigns", "customers"],
  },
  {
    id: "location_website",
    name: "Location Websites",
    shortName: "Website",
    category: "commerce",
    tagline: "Per-location public site builder with SEO, menu & order CTAs",
    priceMonthly: 39,
    modes: ["all"],
    views: ["website", "marketing"],
  },
  {
    id: "saas_console",
    name: "SaaS Console",
    shortName: "SaaS",
    category: "platform",
    tagline: "Org, locations, packages, devices, billing, onboarding — lives at /platform",
    priceMonthly: 0,
    modes: ["all"],
    views: [], // platform route only, not POS nav
  },
];

export const PACKAGE_BY_ID: Record<PackageId, SummexPackage> = Object.fromEntries(
  SUMMEX_PACKAGES.map((p) => [p.id, p]),
) as Record<PackageId, SummexPackage>;

export function formatPackagePrice(p: SummexPackage): string {
  if (p.priceMonthly === 0) return "Included";
  return `$${p.priceMonthly}/mo`;
}

export function defaultPackagesForMode(
  mode:
    | "restaurant"
    | "food_hall"
    | "truck_pod"
    | "ghost_kitchen"
    | "catering"
    | "bar_lounge"
    | "cafe"
    | "qsr",
): PackageId[] {
  const base: PackageId[] = [
    "pos_core",
    "kds",
    "reports_cash",
    "menu_admin",
    "saas_console",
  ];
  if (mode === "restaurant") {
    return [
      ...base,
      "host_stand",
      "online_kiosk",
      "labor",
      "inventory",
      "guests_crm",
      "integrations",
      "drink_ai",
      "marketing_suite",
      "location_website",
      "advanced_ops",
    ];
  }
  if (mode === "food_hall") {
    return [
      ...base,
      "host_stand",
      "online_kiosk",
      "labor",
      "inventory",
      "guests_crm",
      "integrations",
      "hall_settlement",
      "vendor_portal",
      "ai_inventory",
      "drink_ai",
      "marketing_suite",
      "location_website",
      "advanced_ops",
    ];
  }
  if (mode === "truck_pod") {
    return [
      ...base,
      "online_kiosk",
      "labor",
      "hall_settlement",
      "vendor_portal",
      "truck_pod",
      "integrations",
      "ai_inventory",
      "marketing_suite",
      "location_website",
    ];
  }
  if (mode === "ghost_kitchen") {
    return [
      ...base,
      "online_kiosk",
      "labor",
      "inventory",
      "integrations",
      "advanced_ops",
      "ai_inventory",
      "marketing_suite",
      "location_website",
    ];
  }
  if (mode === "catering") {
    return [
      ...base,
      "labor",
      "inventory",
      "guests_crm",
      "advanced_ops",
      "integrations",
      "marketing_suite",
      "location_website",
    ];
  }
  if (mode === "bar_lounge") {
    return [
      ...base,
      "labor",
      "inventory",
      "guests_crm",
      "drink_ai",
      "integrations",
      "marketing_suite",
      "location_website",
    ];
  }
  if (mode === "cafe") {
    return [
      ...base,
      "online_kiosk",
      "labor",
      "inventory",
      "guests_crm",
      "drink_ai",
      "integrations",
      "marketing_suite",
      "location_website",
    ];
  }
  if (mode === "qsr") {
    return [
      ...base,
      "online_kiosk",
      "labor",
      "inventory",
      "guests_crm",
      "integrations",
      "marketing_suite",
      "location_website",
    ];
  }
  return [...base, "online_kiosk", "labor", "inventory", "integrations", "marketing_suite", "location_website"];
}

export function packagesForLocation(
  mode: Parameters<typeof defaultPackagesForMode>[0],
  operatingModel?: "single_operator" | "host_multi_operator",
): PackageId[] {
  const pkgs = new Set<PackageId>(defaultPackagesForMode(mode));
  if (operatingModel === "host_multi_operator") {
    pkgs.add("kds");
    pkgs.add("hall_settlement");
    pkgs.add("vendor_portal");
  }
  return Array.from(pkgs);
}

export function packageMonthlyTotal(enabled: PackageId[]): number {
  return enabled.reduce((s, id) => s + (PACKAGE_BY_ID[id]?.priceMonthly ?? 0), 0);
}

/** Map POS view → required package (if any). Missing = always allowed. */
export function packageForView(view: string): PackageId | null {
  for (const p of SUMMEX_PACKAGES) {
    if (p.views.includes(view)) return p.id;
  }
  return null;
}
