import { VENUE_TYPES, type PlanSlug } from "./types";
import type { LocationMode } from "@/lib/pos/saas-types";
import { emptyIntakeAnswers } from "./pricing";
import type {
  IntakeAnswers,
  IntakeModules,
  InterviewMessage,
  InterviewRecommendation,
} from "./prospect-types";
export {
  corpusOf,
  followUpRoundCount,
  gapQuestionsFromNarrative,
  heuristicInterviewTurn,
  heuristicRecommendation,
  inferNarrativeFacts,
  normalizeInterviewTurn,
  overlayNarrativeModel,
  type NarrativeFacts,
  type NarrativeShape,
} from "./interview-narrative";

const MODULE_IDS: Array<keyof IntakeModules> = [
  "tableService",
  "counterQsr",
  "kiosk",
  "online",
  "kds",
  "inventory",
  "labor",
  "giftCards",
  "crm",
  "marketing",
  "vendorPortal",
  "multiLocationReporting",
];

const MODULE_ALIASES: Record<string, keyof IntakeModules> = {
  floor: "tableService",
  table_service: "tableService",
  tableservice: "tableService",
  host_stand: "tableService",
  counter: "counterQsr",
  qsr: "counterQsr",
  counter_qsr: "counterQsr",
  kiosk: "kiosk",
  online: "online",
  order_ahead: "online",
  kds: "kds",
  kitchen: "kds",
  bar_display: "kds",
  inventory: "inventory",
  labor: "labor",
  scheduling: "labor",
  tips: "labor",
  gift_cards: "giftCards",
  giftcards: "giftCards",
  gift: "giftCards",
  crm: "crm",
  guests: "crm",
  loyalty: "crm",
  marketing: "marketing",
  vendor_portal: "vendorPortal",
  vendorportal: "vendorPortal",
  vendors: "vendorPortal",
  multi_location: "multiLocationReporting",
  reporting: "multiLocationReporting",
};

const VENUE_ALIASES: Record<string, LocationMode> = {
  restaurant: "restaurant",
  full_service: "restaurant",
  dining: "restaurant",
  food_hall: "food_hall",
  foodhall: "food_hall",
  hall: "food_hall",
  truck_pod: "truck_pod",
  truck: "truck_pod",
  pod: "truck_pod",
  ghost_kitchen: "ghost_kitchen",
  ghost: "ghost_kitchen",
  catering: "catering",
  bar_lounge: "bar_lounge",
  bar: "bar_lounge",
  lounge: "bar_lounge",
  cafe: "cafe",
  café: "cafe",
  coffee: "cafe",
  qsr: "qsr",
};

export function parseRecommendation(raw: unknown): InterviewRecommendation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const modelRaw = String(o.operatingModel ?? "");
  const operatingModel: InterviewRecommendation["operatingModel"] =
    modelRaw === "peer_venue" ||
    modelRaw === "peer" ||
    modelRaw === "shared_venue" ||
    modelRaw === "shared_building"
      ? "peer_venue"
      : modelRaw === "host_multi_operator" ||
          modelRaw === "host_operators" ||
          modelRaw === "host"
        ? "host_multi_operator"
        : "single_operator";
  const venueTypes: LocationMode[] = [];
  const venuesRaw = Array.isArray(o.venueTypes) ? o.venueTypes : [];
  for (const v of venuesRaw) {
    const key = String(v)
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const mapped = VENUE_ALIASES[key];
    if (mapped && !venueTypes.includes(mapped)) venueTypes.push(mapped);
    else if ((VENUE_TYPES as readonly string[]).includes(key) && !venueTypes.includes(key as LocationMode)) {
      venueTypes.push(key as LocationMode);
    }
  }
  if (venueTypes.length === 0) venueTypes.push("restaurant");
  const modules: Array<keyof IntakeModules> = [];
  const modsRaw = Array.isArray(o.modules) ? o.modules : [];
  for (const m of modsRaw) {
    const key = String(m)
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const id = MODULE_ALIASES[key] ?? (MODULE_IDS.includes(key as keyof IntakeModules) ? (key as keyof IntakeModules) : null);
    if (id && !modules.includes(id)) modules.push(id);
  }
  if (!modules.includes("kds")) {
    /* kds is usually wanted; leave as model said */
  }
  const est =
    o.estimates && typeof o.estimates === "object"
      ? (o.estimates as Record<string, unknown>)
      : {};
  const hints =
    o.pricingHints && typeof o.pricingHints === "object"
      ? (o.pricingHints as Record<string, unknown>)
      : {};
  const planRaw = String(hints.suggestedPlan ?? "starter");
  const suggestedPlan: PlanSlug =
    planRaw === "full_service" || planRaw === "food_hall" || planRaw === "starter"
      ? planRaw
      : operatingModel === "host_multi_operator" || operatingModel === "peer_venue"
        ? "food_hall"
        : venueTypes.includes("restaurant") || venueTypes.includes("bar_lounge")
          ? "full_service"
          : "starter";
  const rationale = Array.isArray(o.rationale)
    ? o.rationale.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  return {
    summary: typeof o.summary === "string" && o.summary.trim() ? o.summary.trim() : "Recommended setup from your description.",
    operatingModel,
    venueTypes,
    modules: modules.length ? modules : ["tableService", "kds", "online"],
    estimates: {
      locations: Math.max(1, Math.floor(Number(est.locations) || 1)),
      operators: Math.max(1, Math.floor(Number(est.operators) || 1)),
      seats: Math.max(1, Math.floor(Number(est.seats) || 8)),
      devices: Math.max(1, Math.floor(Number(est.devices) || 4)),
    },
    rationale: rationale.slice(0, 8),
    pricingHints: {
      suggestedPlan,
      notes: typeof hints.notes === "string" ? hints.notes : "",
    },
  };
}

export function applyRecommendation(
  base: IntakeAnswers,
  rec: InterviewRecommendation,
): IntakeAnswers {
  const next = structuredClone(base) as IntakeAnswers;
  const host = rec.operatingModel === "host_multi_operator";
  const peer = rec.operatingModel === "peer_venue";
  const typeCounts: IntakeAnswers["portfolio"]["typeCounts"] = {};
  const locCount = rec.estimates.locations;
  if (rec.venueTypes.length === 1) {
    typeCounts[rec.venueTypes[0]!] = locCount;
  } else {
    const share = Math.max(1, Math.floor(locCount / rec.venueTypes.length));
    rec.venueTypes.forEach((t, i) => {
      typeCounts[t] = i === 0 ? locCount - share * (rec.venueTypes.length - 1) : share;
    });
  }
  next.portfolio = {
    locationsNow: locCount,
    locations12mo: Math.max(locCount, next.portfolio.locations12mo),
    typeCounts,
  };
  next.operating = {
    model: peer
      ? "peer_venue"
      : host
        ? "host_operators"
        : rec.venueTypes.length > 1
          ? "mixed"
          : "single",
    operatorsPerLocation: host || peer ? Math.max(2, rec.estimates.operators) : 1,
    guestPaysHostCheck: host || peer,
    barKitchenSplit:
      rec.venueTypes.includes("bar_lounge") || rec.modules.includes("kds"),
    hostStand: host || peer || rec.modules.includes("tableService"),
  };
  const mods = { ...emptyIntakeAnswers().modules };
  for (const id of MODULE_IDS) mods[id] = rec.modules.includes(id);
  if (host || peer) {
    mods.vendorPortal = true;
    mods.kds = true;
  }
  next.modules = mods;
  next.volume = {
    ...next.volume,
    peakDevices: rec.estimates.devices,
    staffSeats: rec.estimates.seats,
    orderStations: Math.max(1, Math.ceil(rec.estimates.devices / 2) || next.volume.orderStations),
    odsStations: Math.max(next.volume.odsStations, rec.modules.includes("kds") ? 1 : 0),
    kioskCount: Math.max(next.volume.kioskCount, rec.modules.includes("kiosk") ? 1 : 0),
  };
  next.hardware = {
    ownsTabletsPrintersDrawers: true,
    shipReaders: true,
    readerQty: Math.max(1, next.hardware?.readerQty || 1),
    readerPay: "purchase",
    shipPartnerDevices: false,
    partnerSkuQty: {},
  };
  const noteBits = [rec.summary, rec.pricingHints.notes].filter(Boolean);
  if (noteBits.length) {
    next.timeline = {
      ...next.timeline,
      notes: [next.timeline.notes, noteBits.join(" ")].filter(Boolean).join("\n"),
    };
  }
  return next;
}

export function parseMessages(raw: unknown): InterviewMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: InterviewMessage[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const role = o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : null;
    const text = typeof o.text === "string" ? o.text : typeof o.content === "string" ? o.content : "";
    if (!role || !text) continue;
    out.push({
      role,
      text,
      at: typeof o.at === "string" ? o.at : new Date().toISOString(),
    });
  }
  return out;
}

export function interviewSystemPrompt(): string {
  return `You interview a hospitality operator for Summex pricing. Questions MUST be derived from THEIR free-text description. Never use a fixed same-for-everybody list.

Summex: restaurants, bars, cafés, QSR, food halls, truck pods, ghost kitchens, catering.
Guest cards are ALWAYS Quantum Payments (per-entity merchant, one guest check, split capture). Never recommend Square, Stripe, or Adyen. Gift cards are first-party. Tablets/printers/drawers are BYO. Live cards need Finix/Quantum readers supplied through Summex.

Catalog only:
- venueTypes: restaurant, food_hall, truck_pod, ghost_kitchen, catering, bar_lounge, cafe, qsr
- modules: tableService, counterQsr, kiosk, online, kds, inventory, labor, giftCards, crm, marketing, vendorPortal, multiLocationReporting
- operatingModel: host_multi_operator OR peer_venue OR single_operator
- suggestedPlan: starter | full_service | food_hall

Rules:
1. Read the narrative + structured intake already filled + prior Q&A.
2. Ask 2–5 clarifying questions that only cover what is missing or ambiguous in THEIR description.
3. Do not ask anything already stated in the text or prior fields.
4. Do not ask about features their description does not imply.
   Examples:
   - "food hall, two kitchens" → tenant count, who takes the card, shared floor or not. Not espresso machines.
   - "coffee counter, one tablet" (they may say iPad) → do NOT ask about wells, host stand, or tip pools.
   - "80 seats, servers, no bar" → skip multi-well; ask sections, reservations, cash vs card.
   - "single location, two entities, bar operator + food operator kitchen" → operatingModel peer_venue, estimates.operators 2. NOT single_operator. NOT host_multi_operator unless they said landlord/host company/host cut. Do not ask a canned model list. suggestedPlan food_hall. Follow-ups only for seats/dining if they never mentioned them.
5. Max TWO rounds of follow-ups unless they add new facts in the narrative. After two rounds, return a recommendation.
6. Always include a draftRecommendation (best guess from what they already wrote) alongside questions so they can toggle modules.

JSON only, no markdown. One of:
{"type":"questions","questions":[{"id":"snake_id","prompt":"...","hint":"..."}],"draftRecommendation":{...}}
{"type":"recommendation","recommendation":{"summary":"...","operatingModel":"host_multi_operator"|"peer_venue"|"single_operator","venueTypes":["restaurant"],"modules":["kds","online"],"estimates":{"locations":1,"operators":2,"seats":15,"devices":6},"rationale":["..."],"pricingHints":{"suggestedPlan":"food_hall","notes":"..."}}}
A shared building with independent operators and no landlord POS is peer_venue (not host_multi_operator). "Two entities" or a named bar plus a named kitchen in one location is peer_venue. Host_multi_operator is only when a host company sells or takes a cut. "Single location" is not "single operator".`;
}
