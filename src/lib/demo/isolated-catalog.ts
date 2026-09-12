/**
 * Isolated demo houses. DEMO ONLY — excluded from CRM, pipeline, and revenue.
 * Never treat these names as live subscribers.
 */
export const ISOLATED_DEMO_IDS = [
  "summit-hall",
  "harbor-lot",
  "ash-street-coffee",
  "redbird-chicken",
] as const;
export type IsolatedDemoId = (typeof ISOLATED_DEMO_IDS)[number];

export type IsolatedDemoCard = {
  id: IsolatedDemoId;
  slug: string;
  name: string;
  title: string;
  blurb: string;
  kind: "peer" | "hosted" | "counter" | "drive_through";
  orgId: string;
  locationId: string;
};

export const ISOLATED_DEMO_CARDS: IsolatedDemoCard[] = [
  {
    id: "summit-hall",
    slug: "summit-hall",
    name: "Summit Hall",
    title: "Peer full-service",
    blurb: "Shared building. Hearth Kitchen + Copper Bar. No host merchant. One guest check.",
    kind: "peer",
    orgId: "org_summit_hall",
    locationId: "loc_summit_hall",
  },
  {
    id: "harbor-lot",
    slug: "harbor-lot",
    name: "Harbor Lot",
    title: "Food-truck pod + host",
    blurb: "Host merchant on the pad plus six trucks. Shared seating. One guest check.",
    kind: "hosted",
    orgId: "org_harbor_lot",
    locationId: "loc_harbor_lot",
  },
  {
    id: "ash-street-coffee",
    slug: "ash-street-coffee",
    name: "Ash Street Coffee",
    title: "Counter",
    blurb: "Single operator. Queue and ticket number. Counter order + pay. One ODS. No floor map.",
    kind: "counter",
    orgId: "org_ash_street",
    locationId: "loc_ash_street",
  },
  {
    id: "redbird-chicken",
    slug: "redbird-chicken",
    name: "Redbird Chicken",
    title: "Drive-through",
    blurb: "Single operator. Order-taker, window, kitchen ODS. Lane tickets. No dining room.",
    kind: "drive_through",
    orgId: "org_redbird",
    locationId: "loc_redbird",
  },
];

export const ISOLATED_DEMO_ORG_IDS = ISOLATED_DEMO_CARDS.map((c) => c.orgId);
export const ISOLATED_DEMO_LOCATION_IDS = ISOLATED_DEMO_CARDS.map((c) => c.locationId);
export const ISOLATED_DEMO_SLUGS = ISOLATED_DEMO_CARDS.map((c) => c.slug);

export function isIsolatedDemoOrgId(id: string | null | undefined): boolean {
  return Boolean(id && ISOLATED_DEMO_ORG_IDS.includes(id));
}

export function isIsolatedDemoLocationId(id: string | null | undefined): boolean {
  return Boolean(id && ISOLATED_DEMO_LOCATION_IDS.includes(id));
}

export function isIsolatedDemoSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? "").trim().toLowerCase();
  return ISOLATED_DEMO_SLUGS.includes(s as IsolatedDemoCard["slug"]);
}

/** Shared PIN cheat-sheet for tablet tours. Roles that do not apply are omitted per house. */
export const DEMO_PIN_MAP = {
  host: "1111",
  cashier: "2222",
  cook: "3333",
  runner: "4444",
  busser: "5555",
  supervisor: "7777",
  manager: "9999",
} as const;
