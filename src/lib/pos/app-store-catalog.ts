/** Summex App Store — station apps for tablets / ODS / platform */

export type StoreAppId =
  | "floor"
  | "order"
  | "kitchen"
  | "bar"
  | "host"
  | "manager"
  | "owner"
  | "platform"
  | "online"
  | "kiosk"
  | "settlement"
  | "labor"
  | "drink_ai"
  | "marketing"
  | "website"
  | "loyalty";

export type StoreCategory =
  | "front_of_house"
  | "production"
  | "management"
  | "platform"
  | "guest";

export interface StoreApp {
  id: StoreAppId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  category: StoreCategory;
  /** Path to open (same origin) */
  href: string;
  /** Suggested demo PIN / quick login hint */
  pinHint?: string;
  roleHint?: string;
  rating: number;
  reviews: number;
  sizeLabel: string;
  age: string;
  featured?: boolean;
  badge?: string;
  /** Tailwind-ish gradient stops for icon */
  iconFrom: string;
  iconTo: string;
  emoji: string;
}

export const STORE_CATEGORIES: { id: StoreCategory | "all"; label: string }[] =
  [
    { id: "all", label: "For you" },
    { id: "front_of_house", label: "Front of house" },
    { id: "production", label: "Kitchen & bar" },
    { id: "management", label: "Management" },
    { id: "platform", label: "Platform" },
    { id: "guest", label: "Guest" },
  ];

export const SUMMEX_STORE_APPS: StoreApp[] = [
  {
    id: "floor",
    name: "Summex Floor",
    shortName: "Floor",
    tagline: "Host stand — floor & to-go",
    description:
      "Floor map, seat guests, table status, and to-go order entry on the host stand.",
    category: "front_of_house",
    href: "/station?station=host",
    pinHint: "1111",
    roleHint: "Server",
    rating: 4.9,
    reviews: 1284,
    sizeLabel: "Web app",
    age: "Everyone",
    featured: true,
    badge: "Popular",
    iconFrom: "#1A1A1A",
    iconTo: "#7cb518",
    emoji: "🪑",
  },
  {
    id: "order",
    name: "Summex Order",
    shortName: "Order",
    tagline: "Handheld & bar order entry",
    description:
      "Order entry on handhelds and bar stations. Pay and gift when the PIN allows. Send to ODS.",
    category: "front_of_house",
    href: "/station?station=order",
    pinHint: "1111",
    roleHint: "Server",
    rating: 4.8,
    reviews: 902,
    sizeLabel: "Web app",
    age: "Everyone",
    featured: true,
    iconFrom: "#5b9fd4",
    iconTo: "#2d6a9f",
    emoji: "🧾",
  },
  {
    id: "kitchen",
    name: "Summex Kitchen",
    shortName: "Kitchen",
    tagline: "Ticket display — Start / Bump",
    description:
      "Kitchen order display only: Start and Bump. No menu, no pay. Built for 27″ Android and tablets.",
    category: "production",
    href: "/station?station=ods",
    pinHint: "5555",
    roleHint: "Kitchen",
    rating: 4.9,
    reviews: 756,
    sizeLabel: "Web app",
    age: "Everyone",
    featured: true,
    badge: "ODS",
    iconFrom: "#e5a320",
    iconTo: "#b45309",
    emoji: "👨‍🍳",
  },
  {
    id: "bar",
    name: "Summex Bar",
    shortName: "Bar",
    tagline: "Bar station ordering",
    description:
      "Bar rail order entry — send tickets, pay and gift when the PIN allows. Same Order role as handhelds.",
    category: "production",
    href: "/station?station=order",
    pinHint: "3333",
    roleHint: "Bartender",
    rating: 4.7,
    reviews: 512,
    sizeLabel: "Web app",
    age: "Everyone",
    iconFrom: "#a78bfa",
    iconTo: "#6d28d9",
    emoji: "🍸",
  },
  {
    id: "host",
    name: "Summex Host",
    shortName: "Host",
    tagline: "Floor map, seat & to-go",
    description:
      "Host stand: floor map, seat parties, table status, and to-go order entry.",
    category: "front_of_house",
    href: "/station?station=host",
    pinHint: "4444",
    roleHint: "Host",
    rating: 4.6,
    reviews: 340,
    sizeLabel: "Web app",
    age: "Everyone",
    iconFrom: "#34d399",
    iconTo: "#059669",
    emoji: "📋",
  },
  {
    id: "manager",
    name: "Summex Manager",
    shortName: "Manager",
    tagline: "HQ, labor, cash & reports",
    description:
      "Site control: HQ dashboard, labor red-flag rules, cash drawer, inventory, and shift reports.",
    category: "management",
    href: "/?station=hq",
    pinHint: "0000",
    roleHint: "Manager",
    rating: 4.8,
    reviews: 621,
    sizeLabel: "Web app",
    age: "Everyone",
    featured: true,
    iconFrom: "#f472b6",
    iconTo: "#be185d",
    emoji: "📊",
  },
  {
    id: "owner",
    name: "Summex Owner",
    shortName: "Owner",
    tagline: "Full site power tools",
    description:
      "Everything a manager sees plus settlement, packages preview, and full feature surface.",
    category: "management",
    href: "/?station=hq",
    pinHint: "9999",
    roleHint: "Owner",
    rating: 4.9,
    reviews: 198,
    sizeLabel: "Web app",
    age: "Everyone",
    iconFrom: "#1A1A1A",
    iconTo: "#0f1608",
    emoji: "👑",
  },
  {
    id: "settlement",
    name: "Summex Settlement",
    shortName: "Settle",
    tagline: "Multi-vendor payouts",
    description:
      "Period close, host cut, card fee allocation, and cash distribution for food halls.",
    category: "management",
    href: "/?station=settlement",
    pinHint: "9999",
    roleHint: "Owner",
    rating: 4.8,
    reviews: 144,
    sizeLabel: "Web app",
    age: "Everyone",
    badge: "Hall",
    iconFrom: "#fbbf24",
    iconTo: "#92400e",
    emoji: "🏦",
  },
  {
    id: "labor",
    name: "Summex Labor",
    shortName: "Labor",
    tagline: "Clock, red-flag, hours export",
    description:
      "Clock windows, auto-approve near last ticket, supervisor flags, and ADP/Intuit/CSV hours export. Summex does not process payroll.",
    category: "management",
    href: "/?station=labor",
    pinHint: "0000",
    roleHint: "Manager",
    rating: 4.7,
    reviews: 203,
    sizeLabel: "Web app",
    age: "Everyone",
    iconFrom: "#38bdf8",
    iconTo: "#0369a1",
    emoji: "⏱️",
  },
  {
    id: "drink_ai",
    name: "Summex Drink AI",
    shortName: "Drink AI",
    tagline: "Cocktail coach",
    description:
      "Spirit & profile questionnaire with food pairing suggestions for the bar.",
    category: "production",
    href: "/?station=drink_ai",
    pinHint: "3333",
    roleHint: "Bartender",
    rating: 4.6,
    reviews: 89,
    sizeLabel: "Web app",
    age: "Everyone",
    badge: "AI",
    iconFrom: "#e879f9",
    iconTo: "#a21caf",
    emoji: "✨",
  },
  {
    id: "platform",
    name: "Summex Platform",
    shortName: "Platform",
    tagline: "SaaS control plane",
    description:
      "Multi-tenant orgs, locations, packages, devices, hardware policy, and billing — separate from POS.",
    category: "platform",
    href: "/platform",
    roleHint: "Platform admin",
    rating: 4.9,
    reviews: 76,
    sizeLabel: "Web app",
    age: "Everyone",
    featured: true,
    badge: "SaaS",
    iconFrom: "#1A1A1A",
    iconTo: "#3b82f6",
    emoji: "🚀",
  },
  {
    id: "marketing",
    name: "Summex Marketing",
    shortName: "Marketing",
    tagline: "Social, Google, posts & campaigns",
    description:
      "Connect Instagram, Facebook, Google Business, TikTok & more. Schedule posts, run SMS/email, and manage loyalty rules.",
    category: "management",
    href: "/?station=marketing",
    pinHint: "0000",
    roleHint: "Manager",
    rating: 4.8,
    reviews: 156,
    sizeLabel: "Web app",
    age: "Everyone",
    featured: true,
    badge: "Growth",
    iconFrom: "#f472b6",
    iconTo: "#7c3aed",
    emoji: "📣",
  },
  {
    id: "website",
    name: "Summex Sites",
    shortName: "Website",
    tagline: "Per-location websites",
    description:
      "Publish a branded location website with hours, order CTA, loyalty & gift cards.",
    category: "management",
    href: "/?station=website",
    pinHint: "9999",
    roleHint: "Owner",
    rating: 4.7,
    reviews: 98,
    sizeLabel: "Web app",
    age: "Everyone",
    badge: "Web",
    iconFrom: "#38bdf8",
    iconTo: "#0ea5e9",
    emoji: "🌐",
  },
  {
    id: "loyalty",
    name: "Summex Rewards",
    shortName: "Rewards",
    tagline: "Loyalty & gift cards",
    description:
      "Tiers, points, punch cards, issue/reload gift cards, and guest CRM.",
    category: "management",
    href: "/?station=customers",
    pinHint: "0000",
    roleHint: "Manager",
    rating: 4.9,
    reviews: 312,
    sizeLabel: "Web app",
    age: "Everyone",
    featured: true,
    badge: "CRM",
    iconFrom: "#1A1A1A",
    iconTo: "#e5a320",
    emoji: "🎁",
  },
  {
    id: "online",
    name: "Summex Online",
    shortName: "Online",
    tagline: "Guest web ordering",
    description: "Customer-facing online menu and checkout board.",
    category: "guest",
    href: "/online",
    rating: 4.5,
    reviews: 430,
    sizeLabel: "Web app",
    age: "Everyone",
    iconFrom: "#2dd4bf",
    iconTo: "#0f766e",
    emoji: "🌐",
  },
  {
    id: "kiosk",
    name: "Summex Kiosk",
    shortName: "Kiosk",
    tagline: "Self-serve ordering",
    description: "Counter kiosk experience for QSR-style ordering.",
    category: "guest",
    href: "/kiosk",
    rating: 4.4,
    reviews: 210,
    sizeLabel: "Web app",
    age: "Everyone",
    iconFrom: "#94a3b8",
    iconTo: "#334155",
    emoji: "🖥️",
  },
];

export function getStoreApp(id: string) {
  return SUMMEX_STORE_APPS.find((a) => a.id === id);
}
