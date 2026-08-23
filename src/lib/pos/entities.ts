import type {
  Employee,
  EntityId,
  PosView,
  VenueEntityId,
} from "./types";
import { EMPLOYEES } from "./seed";
import { ROLE_LABEL } from "./rbac";

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
  /** POS modules this venue type does not use */
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

const C = {
  lime: "#c8f542",
  slate: "#94a3b8",
  sky: "#7dd3fc",
  mint: "#86efac",
  rose: "#fca5a5",
  violet: "#c4b5fd",
  gold: "#fcd34d",
  orange: "#fdba74",
  indigo: "#a5b4fc",
};

function restaurantStaff(): EntityStaffSpec[] {
  const titleFor = (e: Employee): string => {
    if (e.id === "emp_srv1") return "Server · Dining";
    if (e.id === "emp_srv2") return "Server · Booth";
    if (e.id === "emp_srv3") return "Server";
    return ROLE_LABEL[e.role];
  };
  const blurbFor = (e: Employee): string => {
    if (e.role === "owner") return "Full house & platform control";
    if (e.role === "manager") return "Floor, labor, money & reports";
    if (e.id === "emp_srv1") return "Dining section · orders & guests";
    if (e.id === "emp_srv2") return "Booth section · orders & guests";
    if (e.role === "bartender") return "Bar KDS, tabs & drink assist";
    if (e.role === "host") return "Waitlist, reservations & seating";
    if (e.role === "kitchen") return "Expo / kitchen display";
    if (e.role === "busser") return "Table turns & cleanliness";
    return "Floor, orders & guests";
  };
  return EMPLOYEES.filter((e) => e.active).map((e) => ({
    id: e.id,
    name: e.name,
    pin: e.pin,
    role: e.role,
    title: titleFor(e),
    blurb: blurbFor(e),
    color: e.color,
    homeSectionIds: e.homeSectionIds,
    tipsEarned: e.tipsEarned,
    salesTotal: e.salesTotal,
    clockedIn: e.clockedIn,
    homeView: e.role === "owner" || e.role === "manager" ? "floor" : undefined,
  }));
}

export const VENUE_ENTITIES: VenueEntity[] = [
  {
    id: "restaurant",
    kind: "venue",
    name: "Full-service restaurant",
    shortName: "Restaurant",
    venueName: "Summex",
    address: "42 Pier Avenue, Seaport District",
    tagline: "Tables, bar, host stand",
    blurb: "Classic dining room with sections, bar tabs, and a host stand.",
    locationId: "loc_rest",
    mode: "restaurant",
    defaultView: "floor",
    hiddenViews: ["hall", "settlement", "vendor_portal", "truck_pod"],
    staff: restaurantStaff(),
  },
  {
    id: "food_hall",
    kind: "venue",
    name: "Food hall",
    shortName: "Food hall",
    venueName: "Summex Market Hall",
    address: "42 Pier Avenue, Seaport",
    tagline: "Many vendors, one check",
    blurb: "Hall operator plus stall teams. Guests pay once; vendors settle by period.",
    locationId: "loc_hall",
    mode: "food_hall",
    defaultView: "hall",
    hiddenViews: ["truck_pod"],
    staff: [
      {
        id: "fh_owner",
        name: "Morgan Blair",
        pin: "9999",
        role: "owner",
        title: "Hall owner",
        blurb: "Hall, settlement, vendors & packages",
        color: C.lime,
        homeView: "hall",
      },
      {
        id: "fh_mgr",
        name: "Alex Rivera",
        pin: "0000",
        role: "manager",
        title: "Hall manager",
        blurb: "Floor, labor, vendor ops",
        color: C.slate,
        homeView: "hall",
      },
      {
        id: "fh_vendor",
        name: "Priya Shah",
        pin: "1111",
        role: "server",
        title: "Vendor operator",
        blurb: "Stall menu, tickets & portal",
        color: C.orange,
        homeView: "vendor_portal",
        extraViews: ["vendor_portal", "hall", "settlement"],
      },
      {
        id: "fh_cook",
        name: "Luis Ortega",
        pin: "2222",
        role: "kitchen",
        title: "Vendor cook",
        blurb: "Stall KDS / line",
        color: C.gold,
        homeView: "kitchen",
      },
      {
        id: "fh_cash",
        name: "Devon Walsh",
        pin: "3333",
        role: "server",
        title: "Hall cashier",
        blurb: "Shared checkout & runners",
        color: C.sky,
        homeView: "order",
        extraViews: ["hall"],
      },
      {
        id: "fh_expo",
        name: "Morgan Diaz",
        pin: "5555",
        role: "kitchen",
        title: "Expo",
        blurb: "Hall expo rail & bump",
        color: C.mint,
        homeView: "kitchen",
      },
    ],
  },
  {
    id: "truck_pod",
    kind: "venue",
    name: "Truck pod",
    shortName: "Truck pod",
    venueName: "Westside Truck Pod",
    address: "880 Lot B, Industrial District",
    tagline: "Pads, power, rotating trucks",
    blurb: "Lot operator assigns pads. Each truck runs its own window.",
    locationId: "loc_pod",
    mode: "truck_pod",
    defaultView: "truck_pod",
    hiddenViews: ["hall", "waitlist"],
    staff: [
      {
        id: "tp_op",
        name: "Morgan Blair",
        pin: "9999",
        role: "owner",
        title: "Pod operator",
        blurb: "Pads, leases, power & GMV",
        color: C.lime,
        homeView: "truck_pod",
      },
      {
        id: "tp_pad",
        name: "Alex Rivera",
        pin: "0000",
        role: "manager",
        title: "Pad manager",
        blurb: "Day lineup & lot ops",
        color: C.slate,
        homeView: "truck_pod",
      },
      {
        id: "tp_truck",
        name: "Ray Cole",
        pin: "1111",
        role: "server",
        title: "Truck owner",
        blurb: "Window orders & sales",
        color: C.orange,
        homeView: "order",
        extraViews: ["truck_pod"],
      },
      {
        id: "tp_cook",
        name: "Nina Brooks",
        pin: "2222",
        role: "kitchen",
        title: "Truck cook",
        blurb: "Truck KDS",
        color: C.gold,
        homeView: "kitchen",
      },
      {
        id: "tp_run",
        name: "Jamie Cruz",
        pin: "7777",
        role: "busser",
        title: "Runner",
        blurb: "Window turns & lot help",
        color: C.indigo,
        homeView: "takeout",
        extraViews: ["takeout", "order"],
      },
    ],
  },
  {
    id: "ghost_kitchen",
    kind: "venue",
    name: "Ghost kitchen",
    shortName: "Ghost kitchen",
    venueName: "Forge Cloud Kitchen",
    address: "200 Commissary Way",
    tagline: "No dining room — brands & dispatch",
    blurb: "Virtual brands, expo, and courier handoff. No host stand.",
    locationId: "loc_ghost",
    mode: "ghost_kitchen",
    defaultView: "kitchen",
    hiddenViews: ["floor", "waitlist", "hall", "truck_pod", "bar"],
    staff: [
      {
        id: "gk_mgr",
        name: "Alex Rivera",
        pin: "0000",
        role: "manager",
        title: "Kitchen manager",
        blurb: "Brands, labor & 86 board",
        color: C.slate,
        homeView: "kitchen",
      },
      {
        id: "gk_line",
        name: "Morgan Diaz",
        pin: "1111",
        role: "kitchen",
        title: "Line cook",
        blurb: "Make line / KDS",
        color: C.gold,
        homeView: "kitchen",
      },
      {
        id: "gk_expo",
        name: "Chris Forge",
        pin: "2222",
        role: "kitchen",
        title: "Expo",
        blurb: "Bag, label, bump",
        color: C.mint,
        homeView: "kitchen",
      },
      {
        id: "gk_disp",
        name: "Riley Chen",
        pin: "3333",
        role: "host",
        title: "Dispatch",
        blurb: "Courier handoff & online board",
        color: C.violet,
        homeView: "online",
        extraViews: ["takeout", "kitchen", "delivery"],
      },
      {
        id: "gk_brand",
        name: "Morgan Blair",
        pin: "9999",
        role: "owner",
        title: "Virtual-brand operator",
        blurb: "Menus, channels & payouts",
        color: C.lime,
        homeView: "online",
      },
    ],
  },
  {
    id: "catering",
    kind: "venue",
    name: "Catering",
    shortName: "Catering",
    venueName: "Summex Occasions",
    address: "42 Pier Avenue — events kitchen",
    tagline: "Off-site events & packing",
    blurb: "Book, pack, run the event, then settle.",
    locationId: "loc_cater",
    mode: "catering",
    defaultView: "catering",
    hiddenViews: ["hall", "truck_pod", "waitlist"],
    staff: [
      {
        id: "ct_mgr",
        name: "Alex Rivera",
        pin: "0000",
        role: "manager",
        title: "Catering manager",
        blurb: "Bookings, labor & BEOs",
        color: C.slate,
        homeView: "catering",
      },
      {
        id: "ct_cap",
        name: "Jordan Lee",
        pin: "1111",
        role: "server",
        title: "Event captain",
        blurb: "On-site service lead",
        color: C.sky,
        homeView: "order",
        extraViews: ["catering"],
      },
      {
        id: "ct_prep",
        name: "Morgan Diaz",
        pin: "2222",
        role: "kitchen",
        title: "Prep cook",
        blurb: "Commissary prep",
        color: C.gold,
        homeView: "kitchen",
        extraViews: ["catering", "recipes"],
      },
      {
        id: "ct_drv",
        name: "Jamie Cruz",
        pin: "3333",
        role: "busser",
        title: "Driver / runner",
        blurb: "Load, drop, return",
        color: C.indigo,
        homeView: "delivery",
        extraViews: ["delivery", "catering", "takeout"],
      },
      {
        id: "ct_sales",
        name: "Riley Chen",
        pin: "4444",
        role: "host",
        title: "Sales coordinator",
        blurb: "Quotes, tastings & clients",
        color: C.violet,
        homeView: "catering",
        extraViews: ["customers", "catering"],
      },
    ],
  },
  {
    id: "bar_lounge",
    kind: "venue",
    name: "Bar & lounge",
    shortName: "Bar",
    venueName: "Pier Room",
    address: "42 Pier Avenue — lounge",
    tagline: "Tabs first, light kitchen",
    blurb: "Bar-led service. Tabs, cocktail KDS, optional small plates.",
    locationId: "loc_bar",
    mode: "bar_lounge",
    defaultView: "bar",
    hiddenViews: ["hall", "truck_pod", "waitlist"],
    staff: [
      {
        id: "br_own",
        name: "Morgan Blair",
        pin: "9999",
        role: "owner",
        title: "Owner",
        blurb: "House, inventory & money",
        color: C.lime,
        homeView: "bar",
      },
      {
        id: "br_mgr",
        name: "Casey Brooks",
        pin: "0000",
        role: "manager",
        title: "Bar manager",
        blurb: "Floor, 86, labor",
        color: C.rose,
        homeView: "bar",
      },
      {
        id: "br_tend",
        name: "Sam Okonkwo",
        pin: "1111",
        role: "bartender",
        title: "Bartender",
        blurb: "Well, tabs & KDS",
        color: C.sky,
        homeView: "bar",
      },
      {
        id: "br_back",
        name: "Jamie Cruz",
        pin: "2222",
        role: "busser",
        title: "Barback",
        blurb: "Ice, glass, restock",
        color: C.indigo,
        homeView: "bar",
        extraViews: ["bar", "inventory"],
      },
      {
        id: "br_srv",
        name: "Jordan Lee",
        pin: "3333",
        role: "server",
        title: "Server",
        blurb: "Lounge tables",
        color: C.mint,
        homeView: "floor",
      },
      {
        id: "br_kit",
        name: "Morgan Diaz",
        pin: "5555",
        role: "kitchen",
        title: "Kitchen",
        blurb: "Small plates",
        color: C.gold,
        homeView: "kitchen",
      },
    ],
  },
  {
    id: "cafe",
    kind: "venue",
    name: "Café / bakery",
    shortName: "Café",
    venueName: "Dockside Café",
    address: "8 Wharf Walk",
    tagline: "Counter, espresso, pastry",
    blurb: "Queue at the counter. Barista and baker share one check.",
    locationId: "loc_cafe",
    mode: "cafe",
    defaultView: "order",
    hiddenViews: ["hall", "truck_pod", "waitlist"],
    staff: [
      {
        id: "cf_own",
        name: "Morgan Blair",
        pin: "9999",
        role: "owner",
        title: "Owner",
        blurb: "Shop, labor & wholesale",
        color: C.lime,
        homeView: "order",
      },
      {
        id: "cf_mgr",
        name: "Alex Rivera",
        pin: "0000",
        role: "manager",
        title: "Manager",
        blurb: "Floor & cash",
        color: C.slate,
        homeView: "order",
      },
      {
        id: "cf_bar",
        name: "Casey Brooks",
        pin: "1111",
        role: "bartender",
        title: "Barista",
        blurb: "Espresso bar & drink assist",
        color: C.rose,
        homeView: "bar",
        extraViews: ["order", "drink_ai"],
      },
      {
        id: "cf_bake",
        name: "Elena Rossi",
        pin: "2222",
        role: "kitchen",
        title: "Baker",
        blurb: "Pastry, 86, recipes",
        color: C.gold,
        homeView: "kitchen",
        extraViews: ["recipes"],
      },
      {
        id: "cf_ctr",
        name: "Devon Walsh",
        pin: "3333",
        role: "server",
        title: "Counter",
        blurb: "Register & pickup",
        color: C.sky,
        homeView: "order",
        extraViews: ["takeout"],
      },
    ],
  },
  {
    id: "qsr",
    kind: "venue",
    name: "Quick service",
    shortName: "QSR",
    venueName: "Salty Window",
    address: "14 Harbor Drive",
    tagline: "Counter & drive-thru",
    blurb: "No table service. Counter, make line, and a drive-thru lane.",
    locationId: "loc_qsr",
    mode: "qsr",
    defaultView: "order",
    hiddenViews: ["hall", "truck_pod", "waitlist"],
    staff: [
      {
        id: "qs_own",
        name: "Morgan Blair",
        pin: "9999",
        role: "owner",
        title: "Owner",
        blurb: "Store & reports",
        color: C.lime,
        homeView: "order",
      },
      {
        id: "qs_mgr",
        name: "Alex Rivera",
        pin: "0000",
        role: "manager",
        title: "Manager",
        blurb: "Labor, 86 & cash",
        color: C.slate,
        homeView: "order",
      },
      {
        id: "qs_ctr",
        name: "Jordan Lee",
        pin: "1111",
        role: "server",
        title: "Counter",
        blurb: "Front register",
        color: C.sky,
        homeView: "order",
        extraViews: ["takeout"],
      },
      {
        id: "qs_kit",
        name: "Morgan Diaz",
        pin: "2222",
        role: "kitchen",
        title: "Kitchen",
        blurb: "Make line",
        color: C.gold,
        homeView: "kitchen",
      },
      {
        id: "qs_dt",
        name: "Riley Chen",
        pin: "3333",
        role: "host",
        title: "Drive-thru",
        blurb: "Lane orders & handoff",
        color: C.violet,
        homeView: "takeout",
        extraViews: ["order", "takeout", "online"],
      },
    ],
  },
];

export const SAAS_ENTITY: SaasEntity = {
  id: "saas",
  kind: "saas",
  name: "SaaS platform",
  shortName: "Platform",
  tagline: "Orgs, locations, packages, billing",
  blurb: "Multi-tenant control plane — not mixed into restaurant POS.",
  href: "/platform",
  staff: [
    { title: "Owner", blurb: "Org, billing & every location" },
    { title: "Admin", blurb: "Users, packages & devices" },
    { title: "Ops", blurb: "Locations, pods & onboarding" },
    { title: "Accountant", blurb: "Payouts, invoices & close" },
    { title: "Support", blurb: "Devices & guest issues" },
  ],
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
