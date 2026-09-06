/**
 * Free-text → operating model / follow-ups. Leaf module (no @/ runtime imports).
 */
import type { LocationMode } from "../pos/saas-types";
import type { PlanSlug } from "./types";
import type {
  IntakeModules,
  InterviewMessage,
  InterviewQuestion,
  InterviewRecommendation,
  InterviewTurnResult,
} from "./prospect-types";

const WORD_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  both: 2,
  couple: 2,
  several: 3,
};

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

function countUnits(corpus: string, unitAlt: string): number {
  const digit = corpus.match(new RegExp(`(\\d+)\\s+(${unitAlt})\\b`, "i"));
  if (digit?.[1]) {
    const n = Number(digit[1]);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  const word = corpus.match(
    new RegExp(
      `\\b(one|two|three|four|five|six|seven|eight|nine|ten|both|couple|several)\\s+(?:of\\s+)?(${unitAlt})\\b`,
      "i",
    ),
  );
  if (word?.[1]) {
    const n = WORD_NUM[word[1].toLowerCase()];
    if (n) return n;
  }
  return 0;
}

export function corpusOf(freeText: string, messages: InterviewMessage[]): string {
  const parts = [freeText, ...messages.map((m) => m.text)];
  return parts.join("\n").toLowerCase();
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
  hostCompanyLikely: boolean;
  peerLikely: boolean;
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
  barAndKitchen: boolean;
  oneCheck: boolean;
  payEach: boolean;
  reservations: boolean;
  waitlist: boolean;
  kiosk: boolean;
  online: boolean;
  cashVsCard: boolean;
  sections: boolean;
  fullServiceFloor: boolean;
};

function saidHostCompany(corpus: string): boolean {
  return has(
    corpus,
    "landlord",
    "host company",
    "host brand",
    "host cut",
    "we are the host",
    "we're the host",
    "as the host",
    "host + tenant",
    "host and tenant",
    "host with tenant",
    "tenants pay us",
    "our tenants",
  );
}

function saidPeerExplicit(corpus: string): boolean {
  return has(
    corpus,
    "shared building",
    "shared venue",
    "shared hall",
    "peer venue",
    "peers",
    "independent operators",
    "independent entities",
    "no landlord",
    "no host brand",
    "no host company",
    "no host merchant",
    "the laundry",
    "named building",
  );
}

function saidSingleOperatorOnly(corpus: string): boolean {
  return has(
    corpus,
    "single operator only",
    "one operator only",
    "just one operator",
    "only one operator",
    "just us",
    "owner-operated",
    "family run",
    "one team",
  );
}

const NAME_STOP = new Set([
  "a",
  "an",
  "the",
  "our",
  "we",
  "my",
  "and",
  "with",
  "plus",
  "have",
  "has",
  "run",
  "runs",
  "also",
  "full",
  "service",
  "this",
  "that",
  "their",
]);

function isBrandName(raw: string): boolean {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0 && !NAME_STOP.has(t));
  if (tokens.length >= 2) return true;
  return tokens.length === 1 && tokens[0]!.length >= 4;
}

/** Named bar-side brand + named kitchen brand (Steam Distillery + Diamond House BBQ). */
function twoNamedBarKitchen(corpus: string): boolean {
  const re =
    /\b([a-z][a-z'&-]*(?:\s+[a-z][a-z'&-]*){0,3})\s+(bar|distillery|brewery|taproom|lounge|cocktail)\b[\s\S]{0,80}\b(?:and|\+)\b[\s\S]{0,80}\b([a-z][a-z'&-]*(?:\s+[a-z][a-z'&-]*){0,3})\s+(kitchen|kitchens|bbq|barbecue|grill|smokehouse)\b/;
  const m = corpus.match(re);
  if (m && isBrandName(m[1] ?? "") && isBrandName(m[3] ?? "")) return true;
  const flipped =
    /\b([a-z][a-z'&-]*(?:\s+[a-z][a-z'&-]*){0,3})\s+(kitchen|kitchens|bbq|barbecue|grill|smokehouse)\b[\s\S]{0,80}\b(?:and|\+)\b[\s\S]{0,80}\b([a-z][a-z'&-]*(?:\s+[a-z][a-z'&-]*){0,3})\s+(bar|distillery|brewery|taproom|lounge|cocktail)\b/;
  const n = corpus.match(flipped);
  return Boolean(n && isBrandName(n[1] ?? "") && isBrandName(n[3] ?? ""));
}

function barAndKitchenPair(corpus: string): boolean {
  const barish = /\b(bar|distillery|brewery|taproom|lounge|cocktail)\b/.test(corpus);
  const kitchenish = /\b(kitchen|kitchens|bbq|barbecue|grill|smokehouse)\b/.test(corpus);
  return barish && kitchenish;
}

export function inferNarrativeFacts(corpus: string): NarrativeFacts {
  const locCount = Math.max(
    countUnits(corpus, "location|locations|site|sites|venue|venues|spot|spots|building|buildings"),
    has(corpus, "single location", "one location", "one site", "one building") ? 1 : 0,
    firstInt(corpus, [/(\d+)\s+(location|site|venue|spot)/i], 0),
  );
  const namedEntities = Math.max(
    countUnits(
      corpus,
      "entity|entities|operator|operators|vendor|vendors|stall|stalls|brand|brands|concept|concepts",
    ),
    firstInt(corpus, [/(\d+)\s+(operator|vendor|stall|concept|kitchen|entit)/i], 0),
  );
  const barAndKitchen = barAndKitchenPair(corpus);
  const namedPair = twoNamedBarKitchen(corpus);
  const operatorCount = Math.max(namedEntities, namedPair ? 2 : 0);

  const hostCompanyLikely =
    saidHostCompany(corpus) ||
    (has(corpus, "food hall", "foodhall") &&
      !saidPeerExplicit(corpus) &&
      namedEntities < 2 &&
      !namedPair);
  const peerLikely =
    !saidSingleOperatorOnly(corpus) &&
    !hostCompanyLikely &&
    (saidPeerExplicit(corpus) || operatorCount >= 2);

  const hostLikely =
    !peerLikely &&
    (hostCompanyLikely ||
      has(
        corpus,
        "food hall",
        "foodhall",
        "stalls",
        "vendors",
        "multiple operators",
        "multi-vendor",
        "truck pod",
      ));

  const singleLikely =
    !peerLikely &&
    !hostLikely &&
    (saidSingleOperatorOnly(corpus) ||
      has(corpus, "single operator", "my cafe", "my coffee", "one ipad", "one tablet"));

  const hasBar = has(corpus, "bar", "well", "wells", "cocktail", "lounge", "spirits", "tap", "distillery");
  const noBar =
    has(corpus, "no bar", "without a bar", "no liquor", "no alcohol") ||
    (has(corpus, "coffee", "cafe", "café", "espresso") && !hasBar);
  const hasKitchen = has(corpus, "kitchen", "kitchens", "cook", "line", "bbq", "barbecue");
  const hasFloor = has(
    corpus,
    "seat",
    "seats",
    "server",
    "servers",
    "table",
    "tables",
    "dining",
    "floor",
    "section",
    "full service",
  );
  const hasCounter = has(corpus, "counter", "qsr", "quick service", "takeout", "coffee", "cafe", "café", "window");
  const seats = firstInt(corpus, [/(\d+)\s+(seat|covers|dining)/i], 0);
  let devices = firstInt(
    corpus,
    [/(\d+)\s+(ipad|tablet|device|terminal|handheld|pos|station)/i],
    0,
  );
  if (devices < 1 && has(corpus, "one ipad", "one tablet", "an ipad")) devices = 1;

  let shape: NarrativeShape = "unknown";
  if (peerLikely || hostLikely || operatorCount >= 2) shape = "hall";
  else if (has(corpus, "ghost")) shape = "ghost";
  else if (has(corpus, "cafe", "café", "coffee", "espresso") && !hasFloor) shape = "cafe";
  else if (has(corpus, "qsr", "quick service", "counter") && !hasFloor) shape = "qsr";
  else if (hasBar && !hasFloor) shape = "bar";
  else if (hasFloor || seats >= 20) shape = "full_service";
  else if (hasCounter) shape = "cafe";

  return {
    shape,
    hostLikely,
    hostCompanyLikely,
    peerLikely,
    singleLikely: singleLikely && !peerLikely,
    locCount,
    operatorCount,
    seats,
    devices,
    hasBar: hasBar && !noBar,
    noBar,
    hasKitchen,
    hasFloor,
    hasCounter,
    barAndKitchen,
    oneCheck: has(corpus, "one check", "one host check", "split settlement", "split capture"),
    payEach: has(corpus, "pay each", "per vendor", "own terminal", "each pays"),
    reservations: has(corpus, "reservation", "book a table", "opentable"),
    waitlist: has(corpus, "waitlist", "wait list"),
    kiosk: has(corpus, "kiosk"),
    online: has(corpus, "online", "order-ahead", "order ahead", "website", "delivery"),
    cashVsCard: has(corpus, "cash", "card", "quantum", "reader"),
    sections: has(corpus, "section", "sections", "server section"),
    fullServiceFloor:
      has(corpus, "full service", "table service", "dining", "dining room") ||
      seats > 0 ||
      has(corpus, "full bar") && has(corpus, "dining", "seat", "seats"),
  };
}

function q(id: string, prompt: string, hint?: string): InterviewQuestion {
  return hint ? { id, prompt, hint } : { id, prompt };
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

/** 1–3 questions that only fill gaps in THIS narrative. Never a canned script. */
export function gapQuestionsFromNarrative(
  facts: NarrativeFacts,
  asked: Set<string>,
): InterviewQuestion[] {
  const out: InterviewQuestion[] = [];
  const add = (item: InterviewQuestion) => {
    if (!asked.has(item.id) && out.length < 3) out.push(item);
  };

  if (facts.peerLikely && facts.operatorCount >= 2) {
    return out;
  }

  if (facts.shape === "hall") {
    if (facts.operatorCount < 2) {
      add(
        q(
          "tenants",
          "How many independent operators (brands) sit in that building?",
          "A number is enough — e.g. a bar and a kitchen.",
        ),
      );
    }
    if (!facts.peerLikely && !facts.hostCompanyLikely) {
      add(
        q(
          "landlord",
          "Is there a landlord or host company that sells, or are the operators independent in a named building?",
        ),
      );
    }
    if (!facts.oneCheck && !facts.payEach) {
      add(q("one_check", "Who takes the guest card — one check, or does each brand swipe separately?"));
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
    return out;
  }

  if (facts.locCount < 1 && facts.shape === "unknown") {
    add(
      q(
        "what_you_run",
        "What kind of house is this — counter, dining room, bar, or a building with more than one brand?",
      ),
    );
  }
  return out;
}

export function heuristicRecommendation(corpus: string, freeText: string): InterviewRecommendation {
  const facts = inferNarrativeFacts(corpus);
  const peer = facts.peerLikely;
  const host = !peer && facts.hostLikely;

  const venues: LocationMode[] = [];
  if (peer || host || has(corpus, "food hall", "foodhall", "stall")) venues.push("food_hall");
  if (has(corpus, "truck", "pod")) venues.push("truck_pod");
  if (has(corpus, "ghost")) venues.push("ghost_kitchen");
  if (has(corpus, "cater")) venues.push("catering");
  if (has(corpus, "cafe", "café", "coffee")) venues.push("cafe");
  if (has(corpus, "qsr", "quick service", "counter", "fast casual")) venues.push("qsr");
  if (has(corpus, "bar", "lounge", "cocktail", "spirits", "distillery")) venues.push("bar_lounge");
  if (
    has(corpus, "restaurant", "dining", "table service", "full service", "bbq", "kitchen") ||
    venues.length === 0
  ) {
    if (!venues.includes("food_hall")) venues.push("restaurant");
  }
  const uniqueVenues =
    peer || host ? (["food_hall"] as LocationMode[]) : [...new Set(venues)];

  const modules = new Set<keyof IntakeModules>(["kds"]);
  if (facts.fullServiceFloor || facts.hasFloor) modules.add("tableService");
  if (has(corpus, "counter", "qsr", "quick service")) modules.add("counterQsr");
  if (facts.kiosk) modules.add("kiosk");
  if (facts.online) modules.add("online");
  if (has(corpus, "inventory", "purchasing", "recipe", "par")) modules.add("inventory");
  if (has(corpus, "labor", "schedule", "tip", "payroll")) modules.add("labor");
  if (has(corpus, "gift")) modules.add("giftCards");
  if (has(corpus, "crm", "loyalty", "guest", "regular")) modules.add("crm");
  if (has(corpus, "marketing", "campaign", "sms", "email")) modules.add("marketing");
  if (host || peer) {
    modules.add("vendorPortal");
    modules.add("kds");
  }

  const locations = Math.max(1, facts.locCount || 1);
  const operators = host || peer ? Math.max(2, facts.operatorCount || 2) : 1;
  const seats = facts.seats || (facts.fullServiceFloor ? 40 : host || peer ? 20 : 12);
  const devices = facts.devices || 4;

  const suggestedPlan: PlanSlug =
    host || peer
      ? "food_hall"
      : uniqueVenues.includes("restaurant") || uniqueVenues.includes("bar_lounge") || facts.fullServiceFloor
        ? "full_service"
        : "starter";

  const rationale = [
    peer
      ? "Two independent operators in one building — shared venue (peers), not a single operator and not a landlord-host unless you said so."
      : host
        ? "Description sounds like a host with tenant operators."
        : "Treating this as a single-operator location unless you change it.",
    `Venue type(s): ${uniqueVenues.join(", ").replaceAll("_", " ")}.`,
    peer
      ? `Package: shared venue + ${operators} selling entities.`
      : `Modules chosen from what you mentioned.`,
  ];

  return {
    summary: freeText.trim().slice(0, 240),
    operatingModel: peer ? "peer_venue" : host ? "host_multi_operator" : "single_operator",
    venueTypes: uniqueVenues,
    modules: [...modules],
    estimates: { locations, operators, seats, devices },
    rationale,
    pricingHints: {
      suggestedPlan,
      notes: peer
        ? "Shared venue: guest pays once; receipt by vendor; each operator is its own Quantum Payments merchant. No host merchant."
        : host
          ? "Guest cards still run on Quantum Payments. Each entity is its own merchant; one guest check."
          : "Guest cards run on Quantum Payments only.",
    },
  };
}

/** If the narrative is clearly peers, do not let a model keep Single operator. */
export function overlayNarrativeModel(
  rec: InterviewRecommendation,
  corpus: string,
  freeText: string,
): InterviewRecommendation {
  const heur = heuristicRecommendation(corpus, freeText);
  if (heur.operatingModel !== "peer_venue") {
    if (
      heur.operatingModel === "host_multi_operator" &&
      rec.operatingModel === "single_operator"
    ) {
      return {
        ...rec,
        operatingModel: "host_multi_operator",
        estimates: {
          ...rec.estimates,
          operators: Math.max(rec.estimates.operators, heur.estimates.operators),
        },
        pricingHints: rec.pricingHints.suggestedPlan === "starter" ? heur.pricingHints : rec.pricingHints,
      };
    }
    return rec;
  }
  if (rec.operatingModel === "host_multi_operator") {
    const facts = inferNarrativeFacts(corpus);
    if (facts.hostCompanyLikely) return rec;
  }
  const tableOk = heur.modules.includes("tableService");
  const modules = [...new Set([
    ...heur.modules,
    ...rec.modules.filter((m) => m !== "tableService" || tableOk),
  ])];
  return {
    ...rec,
    operatingModel: "peer_venue",
    venueTypes: heur.venueTypes.length ? heur.venueTypes : rec.venueTypes,
    modules,
    estimates: {
      ...rec.estimates,
      locations: Math.max(rec.estimates.locations, heur.estimates.locations),
      operators: Math.max(2, rec.estimates.operators, heur.estimates.operators),
    },
    pricingHints: {
      suggestedPlan: "food_hall",
      notes: heur.pricingHints.notes || rec.pricingHints.notes,
    },
    rationale: [...new Set([...heur.rationale, ...rec.rationale])].slice(0, 8),
  };
}

/** Force peer venue + gap-only follow-ups. AI canned lists become a recommendation when the narrative is complete. */
export function normalizeInterviewTurn(
  turn: InterviewTurnResult | null,
  opts: {
    freeText: string;
    messages: InterviewMessage[];
    forceRecommend?: boolean;
    source?: InterviewTurnResult["source"];
  },
): InterviewTurnResult {
  const heur = heuristicInterviewTurn(opts);
  const source = turn?.source ?? opts.source ?? heur.source;
  const corpus = corpusOf(opts.freeText, opts.messages);

  if (!turn) return { ...heur, source };

  if (turn.type === "recommendation") {
    return {
      type: "recommendation",
      recommendation: overlayNarrativeModel(turn.recommendation, corpus, opts.freeText),
      source,
    };
  }

  const draftBase =
    turn.draftRecommendation ??
    (heur.type === "recommendation" ? heur.recommendation : heur.draftRecommendation);
  const draft = overlayNarrativeModel(
    draftBase ?? heuristicRecommendation(corpus, opts.freeText),
    corpus,
    opts.freeText,
  );

  if (opts.forceRecommend || heur.type === "recommendation") {
    return { type: "recommendation", recommendation: draft, source };
  }

  const facts = inferNarrativeFacts(corpus);
  const asked = askedIds(opts.messages);
  const gaps = gapQuestionsFromNarrative(facts, asked);
  if (gaps.length === 0) {
    return { type: "recommendation", recommendation: draft, source };
  }

  const gapIds = new Set(gaps.map((q) => q.id));
  const filtered = turn.questions.filter((q) => gapIds.has(q.id));
  return {
    type: "questions",
    questions: (filtered.length ? filtered : gaps).slice(0, 3),
    source,
    draftRecommendation: draft,
  };
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
  const rec = overlayNarrativeModel(
    heuristicRecommendation(corpus, opts.freeText),
    corpus,
    opts.freeText,
  );
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
