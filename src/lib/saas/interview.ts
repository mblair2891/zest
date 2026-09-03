import { VENUE_TYPES, type PlanSlug } from "./types";
import type { LocationMode } from "@/lib/pos/saas-types";
import { emptyIntakeAnswers } from "./pricing";
import type {
  IntakeAnswers,
  IntakeModules,
  InterviewMessage,
  InterviewQuestion,
  InterviewRecommendation,
  InterviewTurnResult,
} from "./prospect-types";

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

export function corpusOf(freeText: string, messages: InterviewMessage[]): string {
  const parts = [freeText, ...messages.map((m) => m.text)];
  return parts.join("\n").toLowerCase();
}

function has(corpus: string, ...needles: string[]): boolean {
  return needles.some((n) => corpus.includes(n));
}

function firstInt(corpus: string, patterns: RegExp[], fallback: number): number {
  for (const re of patterns) {
    const m = corpus.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
  }
  return fallback;
}

export function parseRecommendation(raw: unknown): InterviewRecommendation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const modelRaw = String(o.operatingModel ?? "");
  const operatingModel: InterviewRecommendation["operatingModel"] =
    modelRaw === "host_multi_operator" ||
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
      : operatingModel === "host_multi_operator"
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
    model: host ? "host_operators" : rec.venueTypes.length > 1 ? "mixed" : "single",
    operatorsPerLocation: host ? Math.max(2, rec.estimates.operators) : 1,
    guestPaysHostCheck: host,
    barKitchenSplit:
      rec.venueTypes.includes("bar_lounge") || rec.modules.includes("kds"),
    hostStand: host || rec.modules.includes("tableService"),
  };
  const mods = { ...emptyIntakeAnswers().modules };
  for (const id of MODULE_IDS) mods[id] = rec.modules.includes(id);
  if (host) {
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

function askedIds(messages: InterviewMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    const hit = m.text.match(/\[q:([a-z0-9_]+)\]/gi);
    if (hit) {
      for (const h of hit) {
        const id = h.slice(3, -1).toLowerCase();
        ids.add(id);
      }
    }
  }
  return ids;
}

export function followUpRoundCount(messages: InterviewMessage[]): number {
  return messages.filter((m) => m.role === "assistant" && /\[q:/.test(m.text)).length;
}

export type NarrativeShape =
  | "hall"
  | "cafe"
  | "qsr"
  | "bar"
  | "full_service"
  | "ghost"
  | "unknown";

export type NarrativeFacts = {
  shape: NarrativeShape;
  hostLikely: boolean;
  singleLikely: boolean;
  locCount: number;
  operatorCount: number;
  seats: number;
  devices: number;
  hasBar: boolean;
  noBar: boolean;
  hasKitchen: boolean;
  hasFloor: boolean;
  hasCounter: boolean;
  oneCheck: boolean;
  payEach: boolean;
  reservations: boolean;
  waitlist: boolean;
  kiosk: boolean;
  online: boolean;
  cashVsCard: boolean;
  sections: boolean;
};

export function inferNarrativeFacts(corpus: string): NarrativeFacts {
  const hostLikely = has(
    corpus,
    "food hall",
    "foodhall",
    "hall with",
    "two kitchens",
    "2 kitchens",
    "stall",
    "stalls",
    "vendors",
    "operators",
    "multi-vendor",
    "multi vendor",
    "multiple operators",
    "truck pod",
    "pod",
  );
  const singleLikely = has(
    corpus,
    "single operator",
    "just us",
    "one team",
    "owner-operated",
    "family run",
    "our shop",
    "my cafe",
    "my coffee",
    "one iPad",
    "one ipad",
    "one tablet",
  );
  const hasBar = has(corpus, "bar", "well", "wells", "cocktail", "lounge", "spirits", "tap");
  const noBar = has(corpus, "no bar", "without a bar", "no liquor", "no alcohol", "beer and wine only")
    || (has(corpus, "coffee", "cafe", "café", "espresso") && !hasBar);
  const hasKitchen = has(corpus, "kitchen", "kitchens", "cook", "line");
  const hasFloor = has(corpus, "seat", "seats", "server", "servers", "table", "tables", "dining", "floor", "section");
  const hasCounter = has(corpus, "counter", "qsr", "quick service", "takeout", "coffee", "cafe", "café", "window");
  const locCount = firstInt(corpus, [/(\d+)\s+(location|site|venue|spot)/i], 0);
  const operatorCount = firstInt(corpus, [/(\d+)\s+(operator|vendor|stall|concept|kitchen)/i], 0);
  const seats = firstInt(corpus, [/(\d+)\s+(seat|covers)/i], 0);
  let devices = firstInt(
    corpus,
    [/(\d+)\s+(ipad|tablet|device|terminal|handheld|pos|station)/i],
    0,
  );
  if (devices < 1 && has(corpus, "one ipad", "one tablet", "an ipad")) devices = 1;
  let shape: NarrativeShape = "unknown";
  if (hostLikely || has(corpus, "food hall", "foodhall")) shape = "hall";
  else if (has(corpus, "ghost")) shape = "ghost";
  else if (has(corpus, "cafe", "café", "coffee", "espresso") && !hasFloor) shape = "cafe";
  else if (has(corpus, "qsr", "quick service", "counter") && !hasFloor) shape = "qsr";
  else if (hasBar && !hasFloor) shape = "bar";
  else if (hasFloor || seats >= 20) shape = "full_service";
  else if (hasCounter) shape = "cafe";

  return {
    shape,
    hostLikely,
    singleLikely: singleLikely && !hostLikely,
    locCount,
    operatorCount,
    seats,
    devices,
    hasBar: hasBar && !noBar,
    noBar,
    hasKitchen,
    hasFloor,
    hasCounter,
    oneCheck: has(corpus, "one check", "one host check", "split settlement", "split capture"),
    payEach: has(corpus, "pay each", "per vendor", "own terminal", "each pays"),
    reservations: has(corpus, "reservation", "book a table", "opentable"),
    waitlist: has(corpus, "waitlist", "wait list"),
    kiosk: has(corpus, "kiosk"),
    online: has(corpus, "online", "order-ahead", "order ahead", "website", "delivery"),
    cashVsCard: has(corpus, "cash", "card", "quantum", "reader"),
    sections: has(corpus, "section", "sections", "server section"),
  };
}

function q(id: string, prompt: string, hint?: string): InterviewQuestion {
  return hint ? { id, prompt, hint } : { id, prompt };
}

/** 1–3 questions that only fill gaps in THIS narrative. Never a canned script. */
export function gapQuestionsFromNarrative(
  facts: NarrativeFacts,
  asked: Set<string>,
): InterviewQuestion[] {
  const out: InterviewQuestion[] = [];
  const add = (item: InterviewQuestion) => {
    if (!asked.has(item.id) && out.length < 3) out.push(item);
  };

  if (facts.shape === "hall") {
    if (facts.operatorCount < 2) {
      add(q("tenants", "How many tenant operators (brands) sit on that floor?", "A number is enough — e.g. two kitchens plus a bar."));
    }
    if (!facts.oneCheck && !facts.payEach) {
      add(q("one_check", "Who takes the guest card — one host check, or does each brand swipe separately?"));
    }
    if (!facts.hasFloor && !asked.has("shared_floor")) {
      add(q("shared_floor", "Is the dining room a shared floor (one host stand), or does each kitchen run its own seating?"));
    }
    return out;
  }

  if (facts.shape === "cafe" || facts.shape === "qsr") {
    if (!facts.online && !facts.kiosk) {
      add(q("channels_light", "Besides the counter, do you need online / order-ahead or a guest kiosk?"));
    }
    if (facts.devices < 1) {
      add(q("stations_light", "How many order tablets and kitchen/bar displays will you run?"));
    }
    return out;
  }

  if (facts.shape === "full_service") {
    if (!facts.sections && facts.seats >= 20) {
      add(q("sections", "Do you split the room into server sections?"));
    }
    if (!facts.reservations && !facts.waitlist) {
      add(q("reservations", "Do you take reservations or run a waitlist, or walk-in only?"));
    }
    if (!facts.cashVsCard) {
      add(q("cash_card", "Mostly card, mostly cash, or a mix?"));
    }
    return out;
  }

  if (facts.shape === "bar") {
    if (!facts.hasKitchen && !asked.has("food")) {
      add(q("food", "Is this drinks-only, or is there a kitchen / food program too?"));
    }
    if (facts.hasBar && !hasWellsKnown(facts)) {
      add(q("wells", "How many bar wells / bartender stations?"));
    }
    return out;
  }

  if (facts.locCount < 1 && facts.shape === "unknown") {
    add(q("what_you_run", "What kind of house is this — counter, dining room, bar, or a hall with more than one brand?"));
  }
  if (!facts.hostLikely && !facts.singleLikely && facts.shape === "unknown") {
    add(q("model", "Is this one operator, or a host with more than one brand on the same floor?"));
  }
  return out;
}

function hasWellsKnown(facts: NarrativeFacts): boolean {
  return facts.devices > 0 && facts.hasBar;
}

export function heuristicInterviewTurn(opts: {
  freeText: string;
  messages: InterviewMessage[];
  forceRecommend?: boolean;
}): InterviewTurnResult {
  const corpus = corpusOf(opts.freeText, opts.messages);
  const facts = inferNarrativeFacts(corpus);
  const asked = askedIds(opts.messages);
  const rounds = followUpRoundCount(opts.messages);
  const rec = heuristicRecommendation(corpus, opts.freeText);
  const missing = gapQuestionsFromNarrative(facts, asked);

  if (!opts.forceRecommend && rounds < 2 && missing.length > 0) {
    return {
      type: "questions",
      questions: missing.slice(0, 3),
      source: "heuristic",
      draftRecommendation: rec,
    };
  }
  return {
    type: "recommendation",
    recommendation: rec,
    source: "heuristic",
  };
}

export function heuristicRecommendation(corpus: string, freeText: string): InterviewRecommendation {
  const host =
    has(
      corpus,
      "food hall",
      "foodhall",
      "host",
      "vendor",
      "stall",
      "operators",
      "pod",
      "multi-vendor",
      "multiple operators",
    ) && !has(corpus, "single operator only");
  const venues: LocationMode[] = [];
  if (has(corpus, "food hall", "foodhall", "stall")) venues.push("food_hall");
  if (has(corpus, "truck", "pod")) venues.push("truck_pod");
  if (has(corpus, "ghost")) venues.push("ghost_kitchen");
  if (has(corpus, "cater")) venues.push("catering");
  if (has(corpus, "cafe", "café", "coffee")) venues.push("cafe");
  if (has(corpus, "qsr", "quick service", "counter", "fast casual")) venues.push("qsr");
  if (has(corpus, "bar", "lounge", "cocktail", "spirits")) venues.push("bar_lounge");
  if (has(corpus, "restaurant", "dining", "table service", "full service") || venues.length === 0) {
    if (!venues.includes("food_hall")) venues.push("restaurant");
  }
  const uniqueVenues = [...new Set(venues)];

  const modules = new Set<keyof IntakeModules>(["kds"]);
  if (has(corpus, "table", "floor", "host stand", "waitlist", "section", "dining")) {
    modules.add("tableService");
  }
  if (has(corpus, "counter", "qsr", "quick service")) modules.add("counterQsr");
  if (has(corpus, "kiosk")) modules.add("kiosk");
  if (has(corpus, "online", "order-ahead", "order ahead", "website", "delivery")) modules.add("online");
  if (has(corpus, "inventory", "purchasing", "recipe", "par")) modules.add("inventory");
  if (has(corpus, "labor", "schedule", "tip", "payroll")) modules.add("labor");
  if (has(corpus, "gift")) modules.add("giftCards");
  if (has(corpus, "crm", "loyalty", "guest", "regular")) modules.add("crm");
  if (has(corpus, "marketing", "campaign", "sms", "email")) modules.add("marketing");
  if (host) {
    modules.add("vendorPortal");
    modules.add("kds");
    modules.add("online");
  }
  if (has(corpus, "multi-location", "multiple location", "portfolio")) {
    modules.add("multiLocationReporting");
  }
  if (modules.size <= 1 && host) {
    modules.add("vendorPortal");
  }
  if (modules.size <= 1 && has(corpus, "coffee", "cafe", "café", "counter", "qsr")) {
    modules.add("counterQsr");
    modules.add("kds");
  }

  const locations = firstInt(corpus, [/(\d+)\s+(location|site|venue|spot)/i], 1);
  const operators = host
    ? firstInt(corpus, [/(\d+)\s+(operator|vendor|stall|concept)/i], 2)
    : 1;
  const seats = firstInt(corpus, [/(\d+)\s+(seat|staff|login|employee)/i], host ? 20 : 12);
  const devices = firstInt(corpus, [/(\d+)\s+(device|terminal|handheld|pos|kds)/i], host ? 8 : 6);

  let gmvNote = "";
  if (has(corpus, "400k", "400 k")) gmvNote = "Volume band sounds like $400k+.";
  else if (has(corpus, "150k", "150 k")) gmvNote = "Volume band sounds like $150–400k.";
  else if (has(corpus, "50k", "50 k")) gmvNote = "Volume band sounds like $50–150k.";

  const suggestedPlan: PlanSlug = host
    ? "food_hall"
    : uniqueVenues.includes("restaurant") || uniqueVenues.includes("bar_lounge")
      ? "full_service"
      : "starter";

  const rationale = [
    host
      ? "Description sounds like a host with multiple operators."
      : "Treating this as a single-operator location unless you change it.",
    `Venue type(s): ${uniqueVenues.join(", ").replaceAll("_", " ")}.`,
    `Modules chosen from what you mentioned (and host defaults if applicable).`,
  ];
  if (gmvNote) rationale.push(gmvNote);

  return {
    summary: freeText.trim().slice(0, 240),
    operatingModel: host ? "host_multi_operator" : "single_operator",
    venueTypes: uniqueVenues,
    modules: [...modules],
    estimates: { locations, operators, seats, devices },
    rationale,
    pricingHints: {
      suggestedPlan,
      notes: host
        ? "Guest cards still run on Quantum Payments. Each entity is its own merchant; one guest check; split capture. Gift cards stay first-party."
        : "Guest cards run on Quantum Payments only. Gift cards stay first-party.",
    },
  };
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
- operatingModel: host_multi_operator OR single_operator
- suggestedPlan: starter | full_service | food_hall

Rules:
1. Read the narrative + structured intake already filled + prior Q&A.
2. Ask 2–5 clarifying questions that only cover what is missing or ambiguous in THEIR description.
3. Do not ask anything already stated in the text or prior fields.
4. Do not ask about features their description does not imply.
   Examples:
   - "food hall, two kitchens" → tenant count, who takes the card, shared floor or not. Not espresso machines.
   - "coffee counter, one iPad" → do NOT ask about wells, host stand, or tip pools.
   - "80 seats, servers, no bar" → skip multi-well; ask sections, reservations, cash vs card.
5. Max TWO rounds of follow-ups unless they add new facts in the narrative. After two rounds, return a recommendation.
6. Always include a draftRecommendation (best guess from what they already wrote) alongside questions so they can toggle modules.

JSON only, no markdown. One of:
{"type":"questions","questions":[{"id":"snake_id","prompt":"...","hint":"..."}],"draftRecommendation":{...}}
{"type":"recommendation","recommendation":{"summary":"...","operatingModel":"host_multi_operator"|"single_operator","venueTypes":["restaurant"],"modules":["kds","online"],"estimates":{"locations":1,"operators":2,"seats":15,"devices":6},"rationale":["..."],"pricingHints":{"suggestedPlan":"food_hall","notes":"..."}}}`;
}
