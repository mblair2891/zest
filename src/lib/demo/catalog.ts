import type { VenueEntityId } from "@/lib/pos/types";

export type DemoCatalogEntry = {
  type: VenueEntityId;
  title: string;
  shortName: string;
  hostName: string;
  blurb: string;
  tourFocus: string;
  sharePath: string;
  tourPath: string;
};

/** One shareable prospect demo per establishment type. */
export const DEMO_CATALOG: DemoCatalogEntry[] = [
  {
    type: "restaurant",
    title: "Full-service restaurant",
    shortName: "Restaurant",
    hostName: "The Dining Room",
    blurb: "Sections, a host stand, kitchen and bar on one check.",
    tourFocus: "Seat a table, course the check, pay once through Quantum Payments.",
    sharePath: "/demo/restaurant",
    tourPath: "/demo/restaurant/tour",
  },
  {
    type: "food_hall",
    title: "Host + multi-operator",
    shortName: "The Laundry",
    hostName: "The Laundry",
    blurb: "Steam Distillery and Diamond House BBQ under The Laundry. Each entity has its own login. Host grants view vs edit and assigns devices.",
    tourFocus: "Steam vs Diamond logins, view-only peer menu, host permission matrix, device assignment.",
    sharePath: "/demo/food_hall",
    tourPath: "/demo/food_hall/tour",
  },
  {
    type: "bar_lounge",
    title: "Bar & lounge",
    shortName: "Bar",
    hostName: "The Lounge",
    blurb: "Tabs first, cocktail tickets, light plates.",
    tourFocus: "Open a tab, bump bar tickets, close on Quantum Payments.",
    sharePath: "/demo/bar_lounge",
    tourPath: "/demo/bar_lounge/tour",
  },
  {
    type: "qsr",
    title: "Quick service",
    shortName: "QSR",
    hostName: "The Window",
    blurb: "Counter and make line. No table service.",
    tourFocus: "Open a check, send the line, take a card, complete.",
    sharePath: "/demo/qsr",
    tourPath: "/demo/qsr/tour",
  },
  {
    type: "cafe",
    title: "Café / bakery",
    shortName: "Café",
    hostName: "Counter Café",
    blurb: "Espresso bar and pastry on one counter check.",
    tourFocus: "Queue at the counter, route drinks vs pastry, pay once.",
    sharePath: "/demo/cafe",
    tourPath: "/demo/cafe/tour",
  },
  {
    type: "truck_pod",
    title: "Truck pod",
    shortName: "Truck pod",
    hostName: "Westside Lot",
    blurb: "Pads, a window, and a host lot — not a dining room.",
    tourFocus: "Window order, kitchen ticket, host lot context.",
    sharePath: "/demo/truck_pod",
    tourPath: "/demo/truck_pod/tour",
  },
  {
    type: "ghost_kitchen",
    title: "Ghost kitchen",
    shortName: "Ghost kitchen",
    hostName: "Forge Commissary",
    blurb: "No dining room. Brands, expo, and dispatch.",
    tourFocus: "Takeout check, kitchen rail, handoff — no host stand.",
    sharePath: "/demo/ghost_kitchen",
    tourPath: "/demo/ghost_kitchen/tour",
  },
  {
    type: "catering",
    title: "Catering",
    shortName: "Catering",
    hostName: "Service Company",
    blurb: "Event checks, packing, and a kitchen that is not a dining room.",
    tourFocus: "Build an event check, send the kitchen, close the job.",
    sharePath: "/demo/catering",
    tourPath: "/demo/catering/tour",
  },
];

export const FULL_TOUR_PATH = "/demo/tour/full";

export function demoEntry(type: VenueEntityId): DemoCatalogEntry | undefined {
  return DEMO_CATALOG.find((d) => d.type === type);
}

export function demoShareUrl(path: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "https://www.summex.app");
  return `${base.replace(/\/$/, "")}${path}`;
}

export function demoOrgId(type: VenueEntityId): string {
  return `org_demo_${type}`;
}

export function demoLocationId(type: VenueEntityId): string {
  return type === "food_hall" ? "loc_hall" : `loc_demo_${type}`;
}
