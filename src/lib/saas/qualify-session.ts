import type { LocationMode } from "../pos/saas-types";
import type { QuoteSnapshot } from "./prospect-types";

export const QUALIFY_PHASES = ["location", "operation", "hardware", "quote"] as const;
export type QualifyPhase = (typeof QUALIFY_PHASES)[number];

export type QualifyChip = { id: string; label: string };

export type QualifyMessage = {
  role: "user" | "assistant";
  text: string;
  at: string;
  chips?: QualifyChip[];
};

export type EntityRelation = "concept" | "legal" | "floor" | "service_style" | "unknown";

export type QualifyEntity = {
  id: string;
  label: string;
  venueType: LocationMode | "retail" | null;
  relation?: EntityRelation;
  wells: number | null;
  tills: number | null;
  hostStands: number | null;
  kiosks: number | null;
  handhelds: number | null;
  kitchenDisplays: number | null;
  cashDrawers: boolean | null;
  tables: boolean | null;
  counter: boolean | null;
  attachedBar: boolean | null;
  frontNone?: boolean;
};

export type QualifyFacts = {
  locationCount: number | null;
  city: string;
  region: string;
  entityCount: number | null;
  sameOwner: boolean | null;
  sameBuilding: boolean | null;
  sharedCashHouse: boolean | null;
  separateMenus: boolean | null;
  separateStaff: boolean | null;
  separateTills: boolean | null;
  separateReporting: boolean | null;
  relation: EntityRelation | null;
  goLive: string;
  contactEmail: string;
  contactName: string;
};

export type QualifySession = {
  messages: QualifyMessage[];
  facts: QualifyFacts;
  entities: QualifyEntity[];
  quote: QuoteSnapshot | null;
  savedAt: string;
  chips: QualifyChip[];
  readyToQuote: boolean;
  showQuote: boolean;
  assumptions: string[];
};

export function emptyQualifyFacts(): QualifyFacts {
  return {
    locationCount: null,
    city: "",
    region: "",
    entityCount: null,
    sameOwner: null,
    sameBuilding: null,
    sharedCashHouse: null,
    separateMenus: null,
    separateStaff: null,
    separateTills: null,
    separateReporting: null,
    relation: null,
    goLive: "",
    contactEmail: "",
    contactName: "",
  };
}

export function emptyQualifyEntity(id: string, label = ""): QualifyEntity {
  return {
    id,
    label: label || "",
    venueType: null,
    wells: null,
    tills: null,
    hostStands: null,
    kiosks: null,
    handhelds: null,
    kitchenDisplays: null,
    cashDrawers: null,
    tables: null,
    counter: null,
    attachedBar: null,
  };
}

export function emptyQualifySession(now = new Date().toISOString()): QualifySession {
  return {
    messages: [],
    facts: emptyQualifyFacts(),
    entities: [],
    quote: null,
    savedAt: now,
    chips: [],
    readyToQuote: false,
    showQuote: false,
    assumptions: [],
  };
}

export function parseQualifySession(raw: unknown): QualifySession | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const base = emptyQualifySession(typeof o.savedAt === "string" ? o.savedAt : new Date().toISOString());
  if (Array.isArray(o.messages)) {
    base.messages = o.messages
      .map((m) => {
        if (!m || typeof m !== "object") return null;
        const r = m as Record<string, unknown>;
        const role = r.role === "assistant" ? "assistant" : r.role === "user" ? "user" : null;
        const text = typeof r.text === "string" ? r.text : "";
        if (!role || !text) return null;
        const msg: QualifyMessage = {
          role,
          text,
          at: typeof r.at === "string" ? r.at : new Date().toISOString(),
        };
        if (Array.isArray(r.chips)) {
          msg.chips = r.chips
            .map((c) => {
              if (!c || typeof c !== "object") return null;
              const x = c as Record<string, unknown>;
              const id = typeof x.id === "string" ? x.id : "";
              const label = typeof x.label === "string" ? x.label : "";
              return id && label ? { id, label } : null;
            })
            .filter((c): c is QualifyChip => Boolean(c));
        }
        return msg;
      })
      .filter((m): m is QualifyMessage => Boolean(m));
  }
  if (o.facts && typeof o.facts === "object") {
    const f = o.facts as Record<string, unknown>;
    const n = (v: unknown): number | null => {
      const x = Math.round(Number(v));
      return Number.isFinite(x) && x > 0 ? x : null;
    };
    const b = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null);
    base.facts = {
      ...base.facts,
      locationCount: n(f.locationCount),
      city: typeof f.city === "string" ? f.city : "",
      region: typeof f.region === "string" ? f.region : "",
      entityCount: n(f.entityCount),
      sameOwner: b(f.sameOwner),
      sameBuilding: b(f.sameBuilding),
      sharedCashHouse: b(f.sharedCashHouse),
      separateMenus: b(f.separateMenus),
      separateStaff: b(f.separateStaff),
      separateTills: b(f.separateTills),
      separateReporting: b(f.separateReporting),
      relation:
        f.relation === "concept" ||
        f.relation === "legal" ||
        f.relation === "floor" ||
        f.relation === "service_style"
          ? f.relation
          : null,
      goLive: typeof f.goLive === "string" ? f.goLive : "",
      contactEmail: typeof f.contactEmail === "string" ? f.contactEmail : "",
      contactName: typeof f.contactName === "string" ? f.contactName : "",
    };
  }
  if (Array.isArray(o.entities)) {
    base.entities = o.entities.map((e, i) => parseEntity(e, `ent_${i + 1}`)).filter(Boolean) as QualifyEntity[];
  }
  base.readyToQuote = o.readyToQuote === true;
  base.showQuote = o.showQuote === true;
  base.assumptions = Array.isArray(o.assumptions)
    ? o.assumptions.filter((s): s is string => typeof s === "string")
    : [];
  if (o.quote && typeof o.quote === "object") {
    base.quote = o.quote as QuoteSnapshot;
  }
  if (Array.isArray(o.chips)) {
    base.chips = o.chips
      .map((c) => {
        if (!c || typeof c !== "object") return null;
        const x = c as Record<string, unknown>;
        const id = typeof x.id === "string" ? x.id : "";
        const label = typeof x.label === "string" ? x.label : "";
        return id && label ? { id, label } : null;
      })
      .filter((c): c is QualifyChip => Boolean(c));
  }
  return base;
}

function parseEntity(raw: unknown, fallbackId: string): QualifyEntity | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const n = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const x = Math.round(Number(v));
    return Number.isFinite(x) && x >= 0 ? x : null;
  };
  const b = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null);
  const venueRaw = typeof o.venueType === "string" ? o.venueType : null;
  const venueType =
    venueRaw === "retail" ||
    venueRaw === "restaurant" ||
    venueRaw === "bar_lounge" ||
    venueRaw === "cafe" ||
    venueRaw === "qsr" ||
    venueRaw === "food_hall" ||
    venueRaw === "ghost_kitchen" ||
    venueRaw === "catering" ||
    venueRaw === "truck_pod"
      ? venueRaw
      : null;
  return {
    id: typeof o.id === "string" && o.id ? o.id : fallbackId,
    label: typeof o.label === "string" ? o.label : "",
    venueType,
    relation:
      o.relation === "concept" ||
      o.relation === "legal" ||
      o.relation === "floor" ||
      o.relation === "service_style"
        ? o.relation
        : undefined,
    wells: n(o.wells),
    tills: n(o.tills),
    hostStands: n(o.hostStands),
    kiosks: n(o.kiosks),
    handhelds: n(o.handhelds),
    kitchenDisplays: n(o.kitchenDisplays),
    cashDrawers: b(o.cashDrawers),
    tables: b(o.tables),
    counter: b(o.counter),
    attachedBar: b(o.attachedBar),
    frontNone: o.frontNone === true,
  };
}

export function cloneSession(s: QualifySession): QualifySession {
  return structuredClone(s);
}
