import type {
  Employee,
  EntityId,
  PosView,
  VenueEntityId,
} from "./types";

export interface EntityStaffSpec {
  id: string;
  name: string;
  pin: string;
  role: Employee["role"];
  title: string;
  blurb: string;
  color: string;
  homeView?: PosView;
  extraViews?: PosView[];
  homeSectionIds?: string[];
  tipsEarned?: number;
  salesTotal?: number;
  clockedIn?: boolean;
}

export interface VenueEntity {
  id: VenueEntityId;
  kind: "venue";
  name: string;
  shortName: string;
  venueName: string;
  address: string;
  tagline: string;
  blurb: string;
  locationId: string;
  mode: VenueEntityId;
  defaultView: PosView;
  hiddenViews: PosView[];
  staff: EntityStaffSpec[];
}

export interface SaasEntity {
  id: "saas";
  kind: "saas";
  name: string;
  shortName: string;
  tagline: string;
  blurb: string;
  href: "/platform";
  staff: { title: string; blurb: string }[];
}

export type EntityDef = VenueEntity | SaasEntity;

function venue(
  partial: Omit<VenueEntity, "kind" | "staff" | "locationId" | "venueName" | "address">,
): VenueEntity {
  return {
    ...partial,
    kind: "venue",
    venueName: partial.shortName,
    address: "",
    locationId: "",
    staff: [],
  };
}

/** Product catalog of venue types — no tenant/staff data. */
export const VENUE_ENTITIES: VenueEntity[] = [
  venue({
    id: "restaurant",
    name: "Full-service restaurant",
    shortName: "Restaurant",
    tagline: "Tables, bar, host stand",
    blurb: "Classic dining room with sections, bar tabs, and a host stand.",
    mode: "restaurant",
    defaultView: "floor",
    hiddenViews: ["hall", "settlement", "vendor_portal", "truck_pod"],
  }),
  venue({
    id: "food_hall",
    name: "Food hall",
    shortName: "Food hall",
    tagline: "Many operators, one check",
    blurb: "Host plus operator teams. Guests pay once; operators settle by period.",
    mode: "food_hall",
    defaultView: "hall",
    hiddenViews: ["truck_pod"],
  }),
  venue({
    id: "truck_pod",
    name: "Truck pod",
    shortName: "Truck pod",
    tagline: "Pads, power, rotating trucks",
    blurb: "Lot operator assigns pads. Each truck runs its own window.",
    mode: "truck_pod",
    defaultView: "truck_pod",
    hiddenViews: ["hall", "waitlist"],
  }),
  venue({
    id: "ghost_kitchen",
    name: "Ghost kitchen",
    shortName: "Ghost kitchen",
    tagline: "Virtual brands, shared line",
    blurb: "No dining room. Dispatch, brands, and a shared kitchen.",
    mode: "ghost_kitchen",
    defaultView: "order",
    hiddenViews: ["hall", "truck_pod", "waitlist"],
  }),
  venue({
    id: "catering",
    name: "Catering",
    shortName: "Catering",
    tagline: "Events, drop-off, captains",
    blurb: "Off-site events and banquet service.",
    mode: "catering",
    defaultView: "catering",
    hiddenViews: ["hall", "truck_pod"],
  }),
  venue({
    id: "bar_lounge",
    name: "Bar & lounge",
    shortName: "Bar",
    tagline: "Tabs first, light kitchen",
    blurb: "Bar-led service. Tabs, cocktail KDS, optional small plates.",
    mode: "bar_lounge",
    defaultView: "bar",
    hiddenViews: ["hall", "truck_pod", "waitlist"],
  }),
  venue({
    id: "cafe",
    name: "Café / bakery",
    shortName: "Café",
    tagline: "Counter, espresso, pastry",
    blurb: "Queue at the counter. Barista and baker share one check.",
    mode: "cafe",
    defaultView: "order",
    hiddenViews: ["hall", "truck_pod", "waitlist"],
  }),
  venue({
    id: "qsr",
    name: "Quick service",
    shortName: "QSR",
    tagline: "Counter and drive-thru",
    blurb: "Fast service, simple tickets, high throughput.",
    mode: "qsr",
    defaultView: "order",
    hiddenViews: ["hall", "truck_pod", "waitlist"],
  }),
];

export const SAAS_ENTITY: SaasEntity = {
  id: "saas",
  kind: "saas",
  name: "SaaS platform",
  shortName: "Platform",
  tagline: "Orgs, locations, packages, billing",
  blurb: "Multi-tenant control plane — not mixed into restaurant POS.",
  href: "/platform",
  staff: [{ title: "Platform admin", blurb: "Control plane — no restaurant seed" }],
};

export const ALL_ENTITIES: EntityDef[] = [...VENUE_ENTITIES, SAAS_ENTITY];

export function venueById(id: string | undefined): VenueEntity | undefined {
  return VENUE_ENTITIES.find((e) => e.id === id);
}

export function isVenueEntityId(id: string | undefined): id is VenueEntityId {
  return VENUE_ENTITIES.some((e) => e.id === id);
}

export function viewsHiddenFor(id: VenueEntityId | undefined): PosView[] {
  return venueById(id)?.hiddenViews ?? [];
}

export function entityAllowsView(
  id: VenueEntityId | undefined,
  view: PosView,
): boolean {
  return !viewsHiddenFor(id).includes(view);
}

/** Host + multi-operator locations always expose settlement, KDS, and vendor views. */
export function posAllowsView(
  id: VenueEntityId | undefined,
  view: PosView,
  opts?: { hostMultiOperator?: boolean },
): boolean {
  if (opts?.hostMultiOperator) {
    if (
      view === "settlement" ||
      view === "vendor_portal" ||
      view === "kitchen" ||
      view === "bar" ||
      view === "order" ||
      view === "floor"
    ) {
      return true;
    }
    if (view === "truck_pod" && id !== "truck_pod") return false;
  }
  return entityAllowsView(id, view);
}

export function employeesForVenue(id: VenueEntityId): Employee[] {
  const ent = venueById(id);
  if (!ent) return [];
  const now = Date.now();
  return ent.staff.map((s) => ({
    id: s.id,
    name: s.name,
    pin: s.pin,
    role: s.role,
    color: s.color,
    clockedIn: s.clockedIn ?? true,
    clockInAt: now - 1000 * 60 * 90,
    tipsEarned: s.tipsEarned ?? 0,
    salesTotal: s.salesTotal ?? 0,
    active: true,
    homeSectionIds: s.homeSectionIds ?? [],
    entityId: id,
    title: s.title,
    homeView: s.homeView,
    extraViews: s.extraViews,
  }));
}

export type EntityIdName = EntityId;
