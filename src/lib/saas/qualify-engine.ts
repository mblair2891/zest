import type { LocationMode } from "../pos/saas-types";
import { emptyIntakeAnswers } from "./pricing";
import type { IntakeAnswers } from "./prospect-types";
import {
  cloneSession,
  emptyQualifyEntity,
  emptyQualifySession,
  type QualifyChip,
  type QualifyEntity,
  type QualifyFacts,
  type QualifyPhase,
  type QualifySession,
} from "./qualify-session";

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
};

function nowIso(): string {
  return new Date().toISOString();
}

function has(text: string, ...needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

function firstCount(text: string, unit: string): number | null {
  const digit = text.match(new RegExp(`(\\d+)\\s+(${unit})\\b`, "i"));
  if (digit?.[1]) {
    const n = Number(digit[1]);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  const word = text.match(
    new RegExp(
      `\\b(one|two|three|four|five|six|seven|eight|nine|ten|both|couple)\\s+(?:of\\s+)?(${unit})\\b`,
      "i",
    ),
  );
  if (word?.[1]) {
    const n = WORD_NUM[word[1].toLowerCase()];
    if (n) return n;
  }
  return null;
}

function ensureEntities(session: QualifySession): void {
  const n = Math.max(session.facts.entityCount ?? 0, session.entities.length, 0);
  if (n <= 0) return;
  session.facts.entityCount = Math.max(session.facts.entityCount ?? n, n);
  while (session.entities.length < n) {
    const i = session.entities.length + 1;
    session.entities.push(emptyQualifyEntity(`ent_${i}`, `Entity ${String.fromCharCode(64 + i)}`));
  }
  if (session.entities.length > n) session.entities.length = n;
}

function focusEntity(session: QualifySession): QualifyEntity {
  ensureEntities(session);
  if (!session.entities.length) {
    session.entities.push(emptyQualifyEntity("ent_1", "Entity A"));
    session.facts.entityCount = session.facts.entityCount ?? 1;
  }
  return (
    session.entities.find((e) => !e.venueType) ||
    session.entities.find((e) => entityHardwareOpen(e)) ||
    session.entities[session.entities.length - 1]!
  );
}

function isBar(e: QualifyEntity): boolean {
  return e.venueType === "bar_lounge";
}

function isRestaurant(e: QualifyEntity): boolean {
  return e.venueType === "restaurant" || e.venueType === "food_hall";
}

function isCafe(e: QualifyEntity): boolean {
  return e.venueType === "cafe" || e.venueType === "qsr" || e.venueType === "retail";
}

function frontResolved(e: QualifyEntity): boolean {
  return e.frontNone === true || e.hostStands != null || e.kiosks != null;
}

function entityHardwareOpen(e: QualifyEntity): boolean {
  if (!e.venueType) return true;
  if (isBar(e)) return e.wells == null || !frontResolved(e) || e.cashDrawers == null;
  if (isRestaurant(e)) {
    return (
      (e.tables == null && e.counter == null) ||
      !frontResolved(e) ||
      e.kitchenDisplays == null ||
      e.attachedBar == null ||
      e.cashDrawers == null
    );
  }
  return e.tills == null || e.cashDrawers == null;
}

function relationClarified(facts: QualifyFacts): boolean {
  if ((facts.entityCount ?? 1) < 2) return true;
  return Boolean(facts.relation) || facts.sameBuilding != null || facts.separateTills != null;
}

export function qualifyPhase(session: QualifySession): QualifyPhase {
  const f = session.facts;
  if (session.showQuote && session.quote) return "quote";
  if (f.locationCount == null || f.entityCount == null || !relationClarified(f)) return "location";
  const typesOpen = session.entities.some((e) => !e.venueType);
  if (typesOpen) return "operation";
  if (session.entities.some(entityHardwareOpen) || !f.goLive) return "hardware";
  return "quote";
}

export function isReadyToQuote(session: QualifySession): boolean {
  const f = session.facts;
  if (f.locationCount == null || f.entityCount == null) return false;
  if (!relationClarified(f)) return false;
  if (!session.entities.length) return false;
  if (session.entities.some((e) => !e.venueType)) return false;
  if (session.entities.some(entityHardwareOpen)) return false;
  if (!f.goLive) return false;
  return true;
}

function extractInto(session: QualifySession, raw: string): void {
  const text = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return;
  const f = session.facts;

  const locs = firstCount(text, "location|locations|site|sites|address|addresses");
  if (locs != null) f.locationCount = locs;
  if (has(text, "single location", "one location", "one address", "one site", "one building") && f.locationCount == null) {
    f.locationCount = 1;
  }

  const ents = firstCount(text, "entit(?:y|ies)|operator|operators|concept|concepts|brand|brands|business(?:es)?");
  if (ents != null) f.entityCount = ents;
  if (has(text, "two entities", "2 entities", "two businesses", "two concepts") && (f.entityCount == null || f.entityCount < 2)) {
    f.entityCount = 2;
  }

  if (has(text, "same owner", "same ownership", "we own both", "both ours")) f.sameOwner = true;
  if (has(text, "different owner", "separate owners")) f.sameOwner = false;
  if (has(text, "same building", "same roof", "under one roof", "one address", "one building")) f.sameBuilding = true;
  if (has(text, "separate buildings", "different buildings", "two addresses")) f.sameBuilding = false;
  if (has(text, "shared cash", "one house bank", "shared till", "shared drawer")) {
    f.sharedCashHouse = true;
    f.separateTills = false;
  }
  if (has(text, "own till", "own tills", "separate till", "separate tills", "own reporting", "separate reporting")) {
    f.separateTills = true;
    f.separateReporting = true;
  }
  if (has(text, "separate menu", "own menu", "separate menus")) f.separateMenus = true;
  if (has(text, "separate staff", "own staff")) f.separateStaff = true;
  if (has(text, "two concepts", "concept in the same", "restaurant and a bar", "bar and a restaurant")) {
    f.relation = "concept";
    f.sameBuilding = f.sameBuilding ?? true;
  }
  if (has(text, "two legal", "two businesses", "separate llc", "separate companies")) f.relation = "legal";
  if (has(text, "two floors", "upstairs", "downstairs")) f.relation = "floor";
  if (has(text, "two service styles", "counter and tables")) f.relation = "service_style";

  const city = raw.match(/\b(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/);
  if (city) {
    f.city = city[1] ?? f.city;
    f.region = city[2] ?? f.region;
  }
  const zip = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zip?.[1]) f.region = f.region || zip[1];

  if (has(text, "30 day", "this month", "asap", "next month")) f.goLive = f.goLive || "30 days";
  if (has(text, "90 day", "this quarter", "three months")) f.goLive = f.goLive || "90 days";
  if (has(text, "later", "next year", "no rush")) f.goLive = f.goLive || "later";

  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email?.[0]) f.contactEmail = email[0];

  ensureEntities(session);

  const barOnly =
    has(text, "we're a bar", "we are a bar", "it's a bar", "its a bar", "nightclub", "we're a nightclub") ||
    (/\bbar\b/.test(text) && !has(text, "restaurant", "kitchen", "dining") && (f.entityCount ?? 1) <= 1);
  if (barOnly) {
    f.locationCount = f.locationCount ?? 1;
    f.entityCount = f.entityCount ?? 1;
    ensureEntities(session);
    const e = session.entities[0]!;
    e.venueType = "bar_lounge";
    if (!e.label || e.label.startsWith("Entity")) e.label = "Bar";
  }

  const restOnly =
    has(text, "we're a restaurant", "we are a restaurant", "dining room") &&
    !has(text, "bar", "nightclub");
  if (restOnly) {
    f.locationCount = f.locationCount ?? 1;
    f.entityCount = f.entityCount ?? 1;
    ensureEntities(session);
    const e = session.entities[0]!;
    e.venueType = "restaurant";
    if (!e.label || e.label.startsWith("Entity")) e.label = "Restaurant";
  }

  if (has(text, "cafe", "coffee", "espresso") && !has(text, "bar", "restaurant")) {
    f.locationCount = f.locationCount ?? 1;
    f.entityCount = f.entityCount ?? 1;
    ensureEntities(session);
    const e = session.entities[0]!;
    e.venueType = "cafe";
    if (!e.label || e.label.startsWith("Entity")) e.label = "Café";
  }

  if (has(text, "retail", "shop", "store") && !has(text, "bar", "restaurant")) {
    f.locationCount = f.locationCount ?? 1;
    f.entityCount = f.entityCount ?? 1;
    ensureEntities(session);
    const e = session.entities[0]!;
    e.venueType = "retail";
    if (!e.label || e.label.startsWith("Entity")) e.label = "Retail";
  }

  const e = focusEntity(session);
  const wells = firstCount(text, "well|wells");
  if (wells != null) e.wells = wells;
  const tills = firstCount(text, "till|tills|register|registers|drawer|drawers");
  if (tills != null && !has(text, "well")) e.tills = tills;
  const kiosks = firstCount(text, "kiosk|kiosks");
  if (kiosks != null) e.kiosks = kiosks;
  if (has(text, "a kiosk", "self-serve", "self serve") && e.kiosks == null) e.kiosks = 1;
  const hosts = firstCount(text, "host stand|host stands|hostess stand|hostess");
  if (hosts != null) e.hostStands = hosts;
  if (has(text, "host stand", "hostess stand", "hostess") && e.hostStands == null) e.hostStands = 1;
  if (has(text, "no host", "no hostess", "no kiosk", "neither")) {
    if (has(text, "neither") || (has(text, "no host") && has(text, "no kiosk"))) {
      e.frontNone = true;
      e.hostStands = e.hostStands ?? 0;
      e.kiosks = e.kiosks ?? 0;
    }
  }
  const handhelds = firstCount(text, "handheld|handhelds");
  if (handhelds != null) e.handhelds = handhelds;
  const kds = firstCount(text, "kds|kitchen display|kitchen displays|kitchen printer|kitchen printers");
  if (kds != null) e.kitchenDisplays = kds;
  if (has(text, "kds", "kitchen display", "kitchen printer") && e.kitchenDisplays == null) e.kitchenDisplays = 1;
  if (has(text, "no kds", "no kitchen display")) e.kitchenDisplays = 0;
  if (has(text, "cash drawer", "need cash", "we take cash")) e.cashDrawers = true;
  if (has(text, "no cash", "card only", "no drawers")) e.cashDrawers = false;
  if (has(text, "tables") || has(text, "table service", "full service")) e.tables = true;
  if (has(text, "counter")) e.counter = true;
  if (has(text, "attached bar", "has a bar", "our bar")) e.attachedBar = true;
  if (has(text, "no bar", "drinks-only", "drinks only")) e.attachedBar = false;

  if (has(text, "restaurant") && has(text, "bar") && (f.entityCount ?? 0) >= 2) {
    const bar = session.entities.find((x) => !x.venueType || x.venueType === "bar_lounge") ?? session.entities[0];
    const rest =
      session.entities.find((x) => x !== bar && (!x.venueType || x.venueType === "restaurant")) ??
      session.entities[1];
    if (bar) {
      bar.venueType = "bar_lounge";
      if (!bar.label || bar.label.startsWith("Entity")) bar.label = "Bar";
    }
    if (rest) {
      rest.venueType = "restaurant";
      if (!rest.label || rest.label.startsWith("Entity")) rest.label = "Restaurant";
    }
  }
}

type Gap = { prompt: string; chips: QualifyChip[] };

function nextGaps(session: QualifySession): Gap[] {
  const f = session.facts;
  const gaps: Gap[] = [];
  const add = (prompt: string, chips: QualifyChip[]) => {
    if (gaps.length < 2) gaps.push({ prompt, chips });
  };

  if (f.locationCount == null) {
    add("How many locations should we price?", [
      { id: "loc_1", label: "One location" },
      { id: "loc_2", label: "Two locations" },
      { id: "loc_3plus", label: "Three or more" },
    ]);
    return gaps;
  }

  if (f.entityCount == null) {
    add("At that location, is it one operation or more than one entity / concept?", [
      { id: "ent_1", label: "One operation" },
      { id: "ent_2", label: "Two entities" },
      { id: "ent_3plus", label: "Three or more" },
    ]);
    return gaps;
  }

  if ((f.entityCount ?? 1) >= 2 && !relationClarified(f)) {
    add(
      "Are they two concepts in the same building (like a restaurant and a bar), or two separate businesses that only share ownership? And should each have its own tills and reporting?",
      [
        { id: "rel_concepts", label: "Two concepts, one building" },
        { id: "rel_legal", label: "Two businesses / legal entities" },
        { id: "rel_floors", label: "Two floors" },
        { id: "rel_styles", label: "Two service styles" },
        { id: "tills_separate", label: "Own tills each" },
        { id: "tills_shared", label: "Shared cash house" },
      ],
    );
    return gaps;
  }

  ensureEntities(session);

  const untyped = session.entities.find((e) => !e.venueType);
  if (untyped) {
    const who = untyped.label && !untyped.label.startsWith("Entity") ? untyped.label : "this entity";
    add(`What is ${who} — a bar, restaurant, café, or something else?`, [
      { id: `type_bar:${untyped.id}`, label: "Bar / nightclub" },
      { id: `type_restaurant:${untyped.id}`, label: "Restaurant" },
      { id: `type_cafe:${untyped.id}`, label: "Café / counter" },
      { id: `type_retail:${untyped.id}`, label: "Retail / other" },
    ]);
    return gaps;
  }

  for (const e of session.entities) {
    const name = e.label || "this entity";
    if (isBar(e) && e.wells == null) {
      add(`How many wells does ${name} run, and do you want a hostess stand, a kiosk, or neither?`, [
        { id: `wells_1:${e.id}`, label: "1 well" },
        { id: `wells_2:${e.id}`, label: "2 wells" },
        { id: `wells_3plus:${e.id}`, label: "3+ wells" },
        { id: `front_host:${e.id}`, label: "Hostess / host stand" },
        { id: `front_kiosk:${e.id}`, label: "Self-serve kiosk" },
        { id: `front_neither:${e.id}`, label: "Neither" },
      ]);
      return gaps;
    }
    if (isBar(e) && e.wells != null && !frontResolved(e)) {
      add(`For ${name}, do you want a hostess stand, a kiosk, or neither?`, [
        { id: `front_host:${e.id}`, label: "Hostess / host stand" },
        { id: `front_kiosk:${e.id}`, label: "Self-serve kiosk" },
        { id: `front_both:${e.id}`, label: "Both" },
        { id: `front_neither:${e.id}`, label: "Neither" },
      ]);
      return gaps;
    }
    if (isRestaurant(e) && e.tables == null && e.counter == null) {
      add(`Is ${name} tables, counter, or both?`, [
        { id: `service_tables:${e.id}`, label: "Tables" },
        { id: `service_counter:${e.id}`, label: "Counter" },
        { id: `service_both:${e.id}`, label: "Both" },
      ]);
      return gaps;
    }
    if (isRestaurant(e) && !frontResolved(e)) {
      add(`Host stand or kiosk for ${name}? How many?`, [
        { id: `front_host:${e.id}`, label: "Host stand" },
        { id: `front_kiosk:${e.id}`, label: "Kiosk" },
        { id: `front_both:${e.id}`, label: "Both" },
        { id: `front_neither:${e.id}`, label: "Neither" },
      ]);
      return gaps;
    }
    if (isRestaurant(e) && e.kitchenDisplays == null) {
      add(`Kitchen printers or KDS for ${name}?`, [
        { id: `kds_1:${e.id}`, label: "1 display / printer" },
        { id: `kds_2:${e.id}`, label: "2+" },
        { id: `kds_no:${e.id}`, label: "None yet" },
      ]);
      return gaps;
    }
    if (isRestaurant(e) && e.attachedBar == null) {
      add(`Is there a bar attached to ${name}? If yes, we’ll count its wells separately.`, [
        { id: `bar_yes:${e.id}`, label: "Yes, a bar" },
        { id: `bar_no:${e.id}`, label: "No bar" },
      ]);
      return gaps;
    }
    if (isCafe(e) && e.tills == null) {
      add(`How many registers or handhelds for ${name}?`, [
        { id: `tills_1:${e.id}`, label: "1 register" },
        { id: `tills_2:${e.id}`, label: "2 registers" },
        { id: `tills_3plus:${e.id}`, label: "3+" },
      ]);
      return gaps;
    }
    if (e.cashDrawers == null) {
      add(`Does ${name} need cash drawers? (That drives till count later — not closeout setup here.)`, [
        { id: `drawers_yes:${e.id}`, label: "Yes, cash drawers" },
        { id: `drawers_no:${e.id}`, label: "Card only" },
      ]);
      return gaps;
    }
  }

  if (!f.goLive) {
    add("When do you want to go live?", [
      { id: "golive_30", label: "About 30 days" },
      { id: "golive_90", label: "This quarter" },
      { id: "golive_later", label: "Later / exploring" },
    ]);
    return gaps;
  }

  return gaps;
}

function heardSummary(session: QualifySession): string {
  const bits: string[] = [];
  const f = session.facts;
  if (f.locationCount) bits.push(`${f.locationCount} location${f.locationCount === 1 ? "" : "s"}`);
  if (f.entityCount && f.entityCount >= 2) bits.push(`${f.entityCount} operations`);
  if (f.relation === "concept") bits.push("concepts under one roof");
  if (f.relation === "legal") bits.push("separate businesses");
  if (f.separateTills) bits.push("own tills each");
  if (f.sharedCashHouse) bits.push("shared cash house");
  for (const e of session.entities) {
    if (!e.venueType && !e.label) continue;
    const parts = [e.label || "entity"];
    if (e.venueType === "bar_lounge") parts.push("bar");
    if (e.venueType === "restaurant") parts.push("restaurant");
    if (e.wells != null) parts.push(`${e.wells} well${e.wells === 1 ? "" : "s"}`);
    if (e.hostStands) parts.push(`${e.hostStands} host stand`);
    if (e.kiosks) parts.push(`${e.kiosks} kiosk`);
    if (e.frontNone) parts.push("no host/kiosk");
    bits.push(parts.join(" · "));
  }
  if (!bits.length) return "";
  return `Got it — ${bits.join("; ")}.`;
}

function composeAssistant(session: QualifySession, gaps: Gap[]): { text: string; chips: QualifyChip[] } {
  if (!gaps.length) {
    return {
      text: `${heardSummary(session)} I can price this now. I’ll list every assumption so you can adjust.`.trim(),
      chips: [{ id: "price_now", label: "Show the quote" }],
    };
  }
  const heard = heardSummary(session);
  const prompts = gaps.map((g) => g.prompt).join(" ");
  const chips = gaps.flatMap((g) => g.chips);
  const text = heard ? `${heard} ${prompts}` : prompts;
  return { text, chips };
}

export function applyChipId(session: QualifySession, chipId: string): QualifySession {
  const next = cloneSession(session);
  const [id, entId] = chipId.split(":");
  const ent = entId ? next.entities.find((e) => e.id === entId) : focusEntity(next);
  const f = next.facts;
  switch (id) {
    case "loc_1":
      f.locationCount = 1;
      break;
    case "loc_2":
      f.locationCount = 2;
      break;
    case "loc_3plus":
      f.locationCount = 3;
      break;
    case "ent_1":
      f.entityCount = 1;
      ensureEntities(next);
      break;
    case "ent_2":
      f.entityCount = 2;
      ensureEntities(next);
      break;
    case "ent_3plus":
      f.entityCount = 3;
      ensureEntities(next);
      break;
    case "rel_concepts":
      f.relation = "concept";
      f.sameBuilding = true;
      break;
    case "rel_legal":
      f.relation = "legal";
      break;
    case "rel_floors":
      f.relation = "floor";
      f.sameBuilding = true;
      break;
    case "rel_styles":
      f.relation = "service_style";
      f.sameBuilding = true;
      break;
    case "tills_separate":
      f.separateTills = true;
      f.separateReporting = true;
      f.sharedCashHouse = false;
      break;
    case "tills_shared":
      f.separateTills = false;
      f.sharedCashHouse = true;
      break;
    case "type_bar":
      if (ent) {
        ent.venueType = "bar_lounge";
        if (!ent.label || ent.label.startsWith("Entity")) ent.label = "Bar";
      }
      break;
    case "type_restaurant":
      if (ent) {
        ent.venueType = "restaurant";
        if (!ent.label || ent.label.startsWith("Entity")) ent.label = "Restaurant";
      }
      break;
    case "type_cafe":
      if (ent) {
        ent.venueType = "cafe";
        if (!ent.label || ent.label.startsWith("Entity")) ent.label = "Café";
      }
      break;
    case "type_retail":
      if (ent) {
        ent.venueType = "retail";
        if (!ent.label || ent.label.startsWith("Entity")) ent.label = "Retail";
      }
      break;
    case "wells_1":
      if (ent) ent.wells = 1;
      break;
    case "wells_2":
      if (ent) ent.wells = 2;
      break;
    case "wells_3plus":
      if (ent) ent.wells = 3;
      break;
    case "front_host":
      if (ent) {
        ent.hostStands = Math.max(1, ent.hostStands ?? 1);
        ent.frontNone = false;
      }
      break;
    case "front_kiosk":
      if (ent) {
        ent.kiosks = Math.max(1, ent.kiosks ?? 1);
        ent.frontNone = false;
      }
      break;
    case "front_both":
      if (ent) {
        ent.hostStands = Math.max(1, ent.hostStands ?? 1);
        ent.kiosks = Math.max(1, ent.kiosks ?? 1);
        ent.frontNone = false;
      }
      break;
    case "front_neither":
      if (ent) {
        ent.hostStands = 0;
        ent.kiosks = 0;
        ent.frontNone = true;
      }
      break;
    case "service_tables":
      if (ent) {
        ent.tables = true;
        ent.counter = false;
      }
      break;
    case "service_counter":
      if (ent) {
        ent.tables = false;
        ent.counter = true;
      }
      break;
    case "service_both":
      if (ent) {
        ent.tables = true;
        ent.counter = true;
      }
      break;
    case "kds_1":
      if (ent) ent.kitchenDisplays = 1;
      break;
    case "kds_2":
      if (ent) ent.kitchenDisplays = 2;
      break;
    case "kds_no":
      if (ent) ent.kitchenDisplays = 0;
      break;
    case "bar_yes":
      if (ent) ent.attachedBar = true;
      break;
    case "bar_no":
      if (ent) ent.attachedBar = false;
      break;
    case "tills_1":
      if (ent) ent.tills = 1;
      break;
    case "tills_2":
      if (ent) ent.tills = 2;
      break;
    case "tills_3plus":
      if (ent) ent.tills = 3;
      break;
    case "drawers_yes":
      if (ent) ent.cashDrawers = true;
      break;
    case "drawers_no":
      if (ent) ent.cashDrawers = false;
      break;
    case "golive_30":
      f.goLive = "30 days";
      break;
    case "golive_90":
      f.goLive = "90 days";
      break;
    case "golive_later":
      f.goLive = "later";
      break;
    case "price_now":
      next.readyToQuote = true;
      next.showQuote = true;
      break;
    default:
      break;
  }
  ensureEntities(next);
  return next;
}

export type QualifyTurnResult = {
  session: QualifySession;
  assistant: string;
  chips: QualifyChip[];
  readyToQuote: boolean;
  phase: QualifyPhase;
};

function finishTurn(session: QualifySession, userText?: string): QualifyTurnResult {
  if (userText?.trim()) {
    session.messages.push({ role: "user", text: userText.trim(), at: nowIso() });
  }
  const gaps = nextGaps(session);
  const ready = isReadyToQuote(session);
  session.readyToQuote = ready;
  const composed = composeAssistant(session, gaps);
  session.chips = composed.chips;
  session.messages.push({
    role: "assistant",
    text: composed.text,
    at: nowIso(),
    chips: composed.chips,
  });
  session.savedAt = nowIso();
  if (ready && session.showQuote === false && userText && /price|quote/i.test(userText)) {
    session.showQuote = true;
  }
  return {
    session,
    assistant: composed.text,
    chips: composed.chips,
    readyToQuote: ready,
    phase: qualifyPhase(session),
  };
}

export function openingTurn(): QualifyTurnResult {
  const session = emptyQualifySession();
  const text =
    "Tell me what you run — a bar, a restaurant, a hall, one location or several. I’ll ask only what’s missing for a price.";
  const chips: QualifyChip[] = [
    { id: "type_bar", label: "We’re a bar" },
    { id: "type_restaurant", label: "Restaurant" },
    { id: "ent_2", label: "One location, two entities" },
    { id: "loc_2", label: "Multiple locations" },
  ];
  session.chips = chips;
  session.messages.push({ role: "assistant", text, at: nowIso(), chips });
  return { session, assistant: text, chips, readyToQuote: false, phase: "location" };
}

export function applyUserText(session: QualifySession, text: string): QualifyTurnResult {
  const next = cloneSession(session);
  extractInto(next, text);
  ensureEntities(next);
  return finishTurn(next, text);
}

export function applyChip(session: QualifySession, chip: QualifyChip): QualifyTurnResult {
  const labeled = applyChipId(session, chip.id);
  return finishTurn(labeled, chip.label);
}

export function entityAssumptionLine(e: QualifyEntity): string {
  const bits: string[] = [];
  const type =
    e.venueType === "bar_lounge"
      ? "bar"
      : e.venueType === "restaurant"
        ? "restaurant"
        : e.venueType === "cafe"
          ? "café"
          : e.venueType === "retail"
            ? "retail"
            : e.venueType?.replaceAll("_", " ") || "operation";
  bits.push(type);
  if (e.wells != null) bits.push(`${e.wells} well${e.wells === 1 ? "" : "s"}`);
  if (e.tills != null) bits.push(`${e.tills} till${e.tills === 1 ? "" : "s"}`);
  if (e.hostStands) bits.push(`${e.hostStands} host stand`);
  else if (e.frontNone || e.hostStands === 0) bits.push("no host stand");
  if (e.kiosks) bits.push(`${e.kiosks} kiosk`);
  else if (e.frontNone || e.kiosks === 0) bits.push("no kiosk");
  if (e.kitchenDisplays) bits.push(`${e.kitchenDisplays} kitchen display`);
  if (e.handhelds) bits.push(`${e.handhelds} handheld`);
  if (e.tables) bits.push("tables");
  if (e.counter) bits.push("counter");
  if (e.cashDrawers === true) bits.push("cash drawers");
  if (e.cashDrawers === false) bits.push("card only");
  return `${e.label || "Entity"} ${bits.join(", ")}.`;
}

export function buildAssumptions(session: QualifySession): string[] {
  const f = session.facts;
  const lines: string[] = [];
  lines.push(
    `${f.locationCount ?? 1} location${(f.locationCount ?? 1) === 1 ? "" : "s"}` +
      (f.city || f.region ? ` · ${[f.city, f.region].filter(Boolean).join(", ")}` : "") +
      ".",
  );
  if ((f.entityCount ?? 1) >= 2) {
    const rel =
      f.relation === "concept"
        ? "two concepts under one roof"
        : f.relation === "legal"
          ? "separate businesses"
          : f.relation === "floor"
            ? "two floors"
            : "multiple operations";
    lines.push(
      `${f.entityCount} entities (${rel})` +
        (f.separateTills ? "; own tills and reporting each" : f.sharedCashHouse ? "; shared cash house" : "") +
        ".",
    );
  }
  for (const e of session.entities) lines.push(entityAssumptionLine(e));
  if (f.goLive) lines.push(`Target go-live: ${f.goLive}.`);
  lines.push("Tablets, printers, and stands are BYO. Live cards need Finix / Quantum readers we ship.");
  lines.push("End-of-shift / till features are not configured here — drawers and stations are counted only for price.");
  return lines;
}

export function sessionToIntake(session: QualifySession): IntakeAnswers {
  const a = emptyIntakeAnswers();
  const f = session.facts;
  const locs = Math.max(1, f.locationCount ?? 1);
  const entities = session.entities.length ? session.entities : [emptyQualifyEntity("ent_1", "House")];
  a.company.legalName = f.contactName || entities[0]?.label || "";
  a.company.billingEmail = f.contactEmail;
  a.company.dba = entities.map((e) => e.label).filter(Boolean).join(" / ");
  a.company.hqAddress = [f.city, f.region].filter(Boolean).join(", ");
  const typeCounts: IntakeAnswers["portfolio"]["typeCounts"] = {};
  for (const e of entities) {
    const t: LocationMode =
      e.venueType && e.venueType !== "retail" ? e.venueType : "restaurant";
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }
  a.portfolio = { locationsNow: locs, locations12mo: locs, typeCounts };
  const multi = entities.length >= 2 || (f.entityCount ?? 1) >= 2;
  a.operating = {
    model: multi ? (f.relation === "legal" && f.sameBuilding === false ? "host_operators" : "peer_venue") : "single",
    operatorsPerLocation: Math.max(1, f.entityCount ?? entities.length),
    guestPaysHostCheck: multi,
    barKitchenSplit: entities.some(isBar) && entities.some(isRestaurant),
    hostStand: entities.some((e) => (e.hostStands ?? 0) > 0),
  };
  const wells = entities.reduce((s, e) => s + (e.wells ?? 0), 0);
  const tills = entities.reduce((s, e) => s + (e.tills ?? 0), 0);
  const hosts = entities.reduce((s, e) => s + (e.hostStands ?? 0), 0);
  const kiosks = entities.reduce((s, e) => s + (e.kiosks ?? 0), 0);
  const kds = entities.reduce((s, e) => s + (e.kitchenDisplays ?? 0), 0);
  const handhelds = entities.reduce((s, e) => s + (e.handhelds ?? 0), 0);
  const order = Math.max(wells + tills + handhelds, wells || tills || 0);
  a.volume = {
    ...a.volume,
    orderStations: Math.max(1, order),
    odsStations: kds,
    kioskCount: kiosks,
    peakDevices: Math.max(1, order + kds + hosts + kiosks),
    staffSeats: entities.some(isRestaurant) ? 40 : 12,
  };
  a.modules = {
    ...a.modules,
    tableService: entities.some((e) => e.tables || (e.hostStands ?? 0) > 0),
    counterQsr: entities.some((e) => e.counter || e.venueType === "cafe" || e.venueType === "qsr"),
    kiosk: kiosks > 0,
    kds: kds > 0 || entities.some(isBar) || entities.some(isRestaurant),
    vendorPortal: multi,
    labor: true,
  };
  a.hardware = {
    ...a.hardware,
    ownsTabletsPrintersDrawers: true,
    shipReaders: true,
    readerQty: Math.max(1, order + hosts + kiosks),
    readerPay: "purchase",
  };
  a.payments.quantumPaymentsAck = true;
  a.timeline.goLiveDate = f.goLive;
  a.timeline.notes = buildAssumptions(session).join(" ");
  return a;
}

export function neverInventedCounts(before: QualifySession, after: QualifySession, userText: string): boolean {
  const mentionedWells = /\b\d+\s+wells?\b|\b(one|two|three)\s+wells?\b/i.test(userText);
  for (let i = 0; i < after.entities.length; i++) {
    const prev = before.entities[i];
    const next = after.entities[i]!;
    if (next.wells != null && prev?.wells == null && !mentionedWells && !/\bwell/i.test(userText)) {
      return false;
    }
  }
  return true;
}
