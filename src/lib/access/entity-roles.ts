import type { EmployeeRole, VenueEntityId } from "@/lib/pos/types";

/** Location PIN / membership roles that apply to a venue type. */
export const ROLES_BY_VENUE: Record<VenueEntityId, EmployeeRole[]> = {
  restaurant: [
    "owner",
    "manager",
    "server",
    "host",
    "bartender",
    "kitchen",
    "busser",
    "cashier",
    "accountant",
    "kiosk",
  ],
  food_hall: [
    "owner",
    "manager",
    "server",
    "host",
    "bartender",
    "kitchen",
    "cashier",
    "vendor_operator",
    "accountant",
    "kiosk",
  ],
  truck_pod: [
    "owner",
    "manager",
    "cashier",
    "kitchen",
    "vendor_operator",
    "accountant",
    "kiosk",
  ],
  ghost_kitchen: [
    "owner",
    "manager",
    "kitchen",
    "cashier",
    "vendor_operator",
    "accountant",
  ],
  catering: ["owner", "manager", "kitchen", "server", "cashier", "accountant"],
  bar_lounge: [
    "owner",
    "manager",
    "bartender",
    "server",
    "kitchen",
    "cashier",
    "accountant",
    "kiosk",
  ],
  cafe: ["owner", "manager", "cashier", "kitchen", "bartender", "accountant", "kiosk"],
  qsr: ["owner", "manager", "cashier", "kitchen", "accountant", "kiosk"],
};

export function rolesForVenue(type: VenueEntityId | null | undefined): EmployeeRole[] {
  if (!type) return ROLES_BY_VENUE.restaurant;
  return ROLES_BY_VENUE[type] ?? ROLES_BY_VENUE.restaurant;
}

export function roleAppliesToVenue(
  role: EmployeeRole,
  type: VenueEntityId | null | undefined,
): boolean {
  return rolesForVenue(type).includes(role);
}

export type SettingsPackId =
  | "profile"
  | "tax"
  | "payments"
  | "cash_discount"
  | "devices"
  | "staff"
  | "notifications"
  | "hours"
  | "sections"
  | "bar_tabs"
  | "counter_expo"
  | "host_operators"
  | "kiosk_front"
  | "voice"
  | "floor_qr";

const UNIVERSAL: SettingsPackId[] = [
  "profile",
  "tax",
  "payments",
  "cash_discount",
  "devices",
  "staff",
  "notifications",
  "hours",
  "voice",
];

export const SETTINGS_PACKS_BY_VENUE: Record<VenueEntityId, SettingsPackId[]> = {
  restaurant: [...UNIVERSAL, "sections", "floor_qr", "kiosk_front"],
  food_hall: [...UNIVERSAL, "sections", "floor_qr", "host_operators", "kiosk_front"],
  truck_pod: [...UNIVERSAL, "host_operators", "counter_expo", "kiosk_front"],
  ghost_kitchen: [...UNIVERSAL, "counter_expo"],
  catering: [...UNIVERSAL, "counter_expo"],
  bar_lounge: [...UNIVERSAL, "sections", "bar_tabs", "floor_qr", "kiosk_front"],
  cafe: [...UNIVERSAL, "counter_expo", "kiosk_front"],
  qsr: [...UNIVERSAL, "counter_expo", "kiosk_front"],
};

export const SETTINGS_PACK_LABEL: Record<SettingsPackId, string> = {
  profile: "Profile",
  tax: "Tax & service charge",
  payments: "Quantum Payments / tenders",
  cash_discount: "Cash discount",
  devices: "Devices, printers, KDS",
  staff: "Staff & roles",
  notifications: "Notifications",
  hours: "Hours",
  sections: "Sections & floor",
  bar_tabs: "Bar stations & tabs",
  counter_expo: "Counter & expo",
  host_operators: "Operators, permissions & devices",
  kiosk_front: "Kiosk, waitlist, check-in",
  voice: "Voice control",
  floor_qr: "Floor statuses, flash & QR",
};

/** Subscriber is the host location; guest operators are onboarded onto it. */
export function isHostMultiVenue(type: VenueEntityId | null | undefined): boolean {
  return type === "food_hall" || type === "truck_pod" || type === "ghost_kitchen";
}

export function settingsPacksForVenue(
  type: VenueEntityId | null | undefined,
): SettingsPackId[] {
  if (!type) return SETTINGS_PACKS_BY_VENUE.restaurant;
  return SETTINGS_PACKS_BY_VENUE[type] ?? UNIVERSAL;
}

export const VENUE_TYPE_LABEL: Record<VenueEntityId, string> = {
  restaurant: "Full-service restaurant",
  food_hall: "Host + multi-operator",
  truck_pod: "Truck pod",
  ghost_kitchen: "Ghost kitchen",
  catering: "Catering",
  bar_lounge: "Bar & lounge",
  cafe: "Café",
  qsr: "Quick service",
};
