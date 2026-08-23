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

const QUESTION_BANK: InterviewQuestion[] = [
  {
    id: "locations",
    prompt: "How many locations do you operate today, and how many in the next 12 months?",
    hint: "A number is enough — e.g. 1 now, 2 next year.",
  },
  {
    id: "model",
    prompt: "Is each location a single operator, or a host with multiple operators / vendors?",
    hint: "Food halls and truck pods are typically host + operators.",
  },
  {
    id: "one_check",
    prompt: "Do guests pay one host check (split settlement), or pay each operator separately?",
  },
  {
    id: "routing",
    prompt: "Do bar and kitchen run as separate stations that need their own displays?",
  },
  {
    id: "channels",
    prompt: "Which channels do you need: floor / table service, counter, KDS, online/order-ahead, kiosk?",
  },
  {
    id: "volume",
    prompt: "Rough monthly guest-check volume or GMV band (under $50k, $50–150k, $150–400k, $400k+)?",
  },
  {
    id: "scale",
    prompt: "Peak concurrent devices (POS, KDS, handhelds) and roughly how many staff logins?",
  },
];

export function heuristicInterviewTurn(opts: {
  freeText: string;
  messages: InterviewMessage[];
}): InterviewTurnResult {
  const corpus = corpusOf(opts.freeText, opts.messages);
  const asked = askedIds(opts.messages);
  const followupRounds = opts.messages.filter((m) => m.role === "user").length;
  const missing: InterviewQuestion[] = [];

  const locKnown =
    firstInt(corpus, [/(\d+)\s+(location|site|venue|spot)/i, /(\d+)\s+now/i], 0) > 0 ||
    has(corpus, "one location", "single location", "a location", "this location");
  const hostSignal = has(
    corpus,
    "food hall",
    "foodhall",
    "host",
    "vendor",
    "operators",
    "stall",
    "pod",
    "multi-vendor",
    "multi vendor",
    "multiple operators",
  );
  const singleSignal = has(corpus, "single operator", "just us", "one team", "owner-operated");
  const payKnown = has(corpus, "one check", "one host check", "split settlement", "pay each", "per vendor");
  const routingKnown = has(corpus, "bar and kitchen", "separate station", "kds", "expo", "bar display");
  const channelKnown = has(
    corpus,
    "floor",
    "table service",
    "kds",
    "online",
    "order-ahead",
    "kiosk",
    "counter",
  );
  const volumeKnown = has(corpus, "gmv", "volume", "checks", "50k", "150k", "400k", "$");
  const scaleKnown = has(corpus, "device", "terminal", "handheld", "seat", "staff", "login");

  if (!locKnown && !asked.has("locations")) missing.push(QUESTION_BANK[0]!);
  if (!hostSignal && !singleSignal && !asked.has("model")) missing.push(QUESTION_BANK[1]!);
  if (hostSignal && !payKnown && !asked.has("one_check")) missing.push(QUESTION_BANK[2]!);
  if (!routingKnown && !asked.has("routing")) missing.push(QUESTION_BANK[3]!);
  if (!channelKnown && !asked.has("channels")) missing.push(QUESTION_BANK[4]!);
  if (!volumeKnown && !asked.has("volume")) missing.push(QUESTION_BANK[5]!);
  if (!scaleKnown && !asked.has("scale")) missing.push(QUESTION_BANK[6]!);

  const shouldRecommend = followupRounds >= 3 || missing.length === 0 || asked.size >= 6;
  if (!shouldRecommend && missing.length > 0) {
    const batch = missing.slice(0, 2).map((q) => ({
      ...q,
      prompt: q.prompt,
    }));
    return { type: "questions", questions: batch, source: "heuristic" };
  }
  return {
    type: "recommendation",
    recommendation: heuristicRecommendation(corpus, opts.freeText),
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
  if (modules.size <= 1) {
    modules.add("tableService");
    modules.add("online");
    modules.add("labor");
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
        ? "Guest cards still run on Summex Payments with a host MID. Gift cards stay first-party."
        : "Guest cards run on Summex Payments only. Gift cards stay first-party.",
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
  return `You are interviewing a hospitality operator for Summex (Zest) SaaS pricing.
Summex is multi-tenant restaurant software: restaurants, bars, cafes, QSR, food halls, truck pods, ghost kitchens, catering.
Guest card processing is ALWAYS Summex Payments (host MID when multi-operator). Never recommend Stripe, Square, or Adyen.
Gift cards are first-party (our ledger), not an external vendor.

Only recommend catalog options:
- venueTypes: restaurant, food_hall, truck_pod, ghost_kitchen, catering, bar_lounge, cafe, qsr
- modules: tableService, counterQsr, kiosk, online, kds, inventory, labor, giftCards, crm, marketing, vendorPortal, multiLocationReporting
- operatingModel: host_multi_operator OR single_operator
- suggestedPlan: starter | full_service | food_hall

Ask 3–8 targeted follow-ups total across the whole interview. Prefer clarifying:
- location / operator counts
- one host check vs pay-per-vendor
- bar vs food routing
- channels (floor, KDS, online, kiosk)
- volume, devices, staff seats
Do not interrogate endlessly. When you have enough, return a recommendation.

Reply with JSON only, no markdown. One of:
{"type":"questions","questions":[{"id":"snake_id","prompt":"...","hint":"..."}]}
{"type":"recommendation","recommendation":{"summary":"...","operatingModel":"host_multi_operator"|"single_operator","venueTypes":["restaurant"],"modules":["kds","online"],"estimates":{"locations":1,"operators":2,"seats":15,"devices":6},"rationale":["..."],"pricingHints":{"suggestedPlan":"food_hall","notes":"..."}}}`;
}
