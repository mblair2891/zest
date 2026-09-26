/**
 * Entity menu intake. Draft rows only — the live catalog is written
 * when the entity admin taps Save / Publish.
 * Cash is the till price. Card follows the venue cash-discount rule.
 * Tax is left to the venue tax screen.
 */
import {
  cardPriceCents,
  cashFromCardCents,
  cashPolicyFromSettings,
  type CashDiscountPolicy,
} from "../pos/cash-discount.ts";

export type IntakeCourse =
  | "appetizer"
  | "salad"
  | "entree"
  | "side"
  | "dessert"
  | "drink"
  | "other";

export type IntakeSettings = {
  cashDiscountEnabled?: boolean;
  cashDiscountPercent?: number;
  cashRoundIncrement?: number;
};

export type IntakeLine = {
  group: string;
  name: string;
  description: string;
  quotedCents: number | null;
  /** cash = the menu labeled it cash. card = labeled card. none = one unlabeled price. */
  labeled: "cash" | "card" | "none";
  modifiers: string[];
  /** null = not obvious — ask. */
  alcohol: boolean | null;
};

export type MenuIntakeRow = {
  id: string;
  entityId: string;
  group: string;
  name: string;
  description: string;
  /** Quoted amount before cash vs card is settled. */
  quotedCents: number | null;
  cashCents: number | null;
  cardCents: number | null;
  priceBasis: "cash" | "card" | "ask" | "missing";
  alcohol: boolean | null;
  modifiers: string[];
  course: IntakeCourse;
  station: "kitchen" | "bar";
  status: "pending" | "accepted" | "dropped";
};

export type MenuIntakeQuestion = {
  id: string;
  rowId: string;
  kind: "price" | "group" | "alcohol" | "basis";
  prompt: string;
};

/** Paste and voice can analyze with no file. A chosen file must already be stored. */
export function menuAnalyzeSource(opts: {
  text?: string | null;
  fileId?: string | null;
}): { kind: "text"; text: string } | { kind: "file"; fileId: string } | { kind: "refuse"; error: string } {
  const fileId = String(opts.fileId ?? "").trim();
  if (fileId) return { kind: "file", fileId };
  const text = String(opts.text ?? "").trim();
  if (text) return { kind: "text", text };
  return { kind: "refuse", error: "Upload a menu first" };
}

/** Photos, PDF, and DOCX. An 8 MB camera JPEG is over this and must say so. */
export const MENU_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const MENU_FILE_MAX_LABEL = "5 MB";

export function menuFileAllowed(name: string): boolean {
  return /\.(pdf|png|jpe?g|webp|docx)$/i.test(name);
}

/** Null when the file can be kept. Otherwise the modal sentence. */
export function menuFileRejection(file: { name: string; size: number }): string | null {
  const name = String(file.name || "file").trim() || "file";
  if (!menuFileAllowed(name)) {
    return `This file is ${name}. Use a photo, PDF, or DOCX. Maximum is ${MENU_FILE_MAX_LABEL}.`;
  }
  if (file.size > MENU_FILE_MAX_BYTES) {
    return `This file is ${formatMenuFileSize(file.size)}. Maximum is ${MENU_FILE_MAX_LABEL}. Take a tighter photo or export a PDF.`;
  }
  if (file.size <= 0) {
    return `This file is empty. Maximum is ${MENU_FILE_MAX_LABEL}. Take a tighter photo or export a PDF.`;
  }
  return null;
}

export function formatMenuFileSize(bytes: number): string {
  const n = Math.max(0, Math.round(bytes));
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${n < 10 * 1024 ? (n / 1024).toFixed(1) : Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function menuFileIsImage(name: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}

export type MenuIntakeDraft = {
  entityId: string;
  rows: MenuIntakeRow[];
  questions: MenuIntakeQuestion[];
  source: "ai" | "heuristic";
  note?: string;
};

const ALCOHOL = /\b(beer|wine|cocktail|margarita|whiskey|whisky|bourbon|ipa|lager|spirit|vodka|gin|rum|tequila|sangria|mimosa)\b/i;
const NOT_ALCOHOL = /\b(burger|fries|salad|soup|steak|pasta|pizza|sandwich|coffee|tea|soda|water|cake|dessert|chicken|taco)\b/i;

function dollarsToCents(raw: string): number | null {
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function uid(i: number): string {
  return `row_${i}`;
}

function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function guessStation(name: string, group: string, alcohol: boolean | null): {
  station: "kitchen" | "bar";
  course: IntakeCourse;
} {
  const blob = `${group} ${name}`;
  if (alcohol === true || /\b(drink|cocktail|beer|wine|bar)\b/i.test(blob)) {
    return { station: "bar", course: "drink" };
  }
  if (/dessert|cake|pie/i.test(blob)) return { station: "kitchen", course: "dessert" };
  if (/salad/i.test(blob)) return { station: "kitchen", course: "salad" };
  if (/appetizer|starter/i.test(blob)) return { station: "kitchen", course: "appetizer" };
  if (/side|fries/i.test(blob)) return { station: "kitchen", course: "side" };
  return { station: "kitchen", course: "entree" };
}

function alcoholFlag(name: string, group: string): boolean | null {
  if (ALCOHOL.test(name) || ALCOHOL.test(group)) return true;
  if (NOT_ALCOHOL.test(name)) return false;
  return null;
}

function modifiersFromName(name: string): string[] {
  return [...name.matchAll(/\(([^)]+)\)/g)]
    .flatMap((m) => m[1]!.split(/[,/]| and /i))
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 40);
}

export function heuristicMenuLines(text: string): IntakeLine[] {
  let group = "";
  const out: IntakeLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("%PDF") || line.startsWith("<<")) continue;
    if (/^[A-Z][A-Z0-9 &'/-]{2,40}$/.test(line) && !/\d/.test(line)) {
      group = titleCase(line);
      continue;
    }
    const price = line.match(/^(.*?)(?:\s+[-–—|]\s*|\s+)\$?\s*(\d{1,4}(?:\.\d{1,2})?)\s*$/);
    if (!price) continue;
    const rawName = price[1]!.replace(/\s+/g, " ").trim();
    if (rawName.length < 2) continue;
    const labeled: IntakeLine["labeled"] =
      /\bcash\b/i.test(line) && !/\bcard\b/i.test(line)
        ? "cash"
        : /\bcard\b/i.test(line) && !/\bcash\b/i.test(line)
          ? "card"
          : "none";
    const clean = rawName
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/\b(cash|card)\s*(price)?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (clean.length < 2) continue;
    out.push({
      group,
      name: clean,
      description: "",
      quotedCents: dollarsToCents(price[2]!),
      labeled,
      modifiers: modifiersFromName(rawName),
      alcohol: alcoholFlag(clean, group),
    });
  }
  return out.slice(0, 80);
}

function centsFromUnknown(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    if (v >= 1000) return Math.round(v);
    return Math.round(v * 100);
  }
  if (typeof v === "string") return dollarsToCents(v);
  return null;
}

function asBool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (/^(y|yes|true|alcohol)$/.test(s)) return true;
    if (/^(n|no|false)$/.test(s)) return false;
  }
  return null;
}

/** Model JSON → lines. Unknown shapes return null so the text parser stays in charge. */
export function linesFromModelJson(raw: unknown): IntakeLine[] | null {
  if (!raw || typeof raw !== "object") return null;
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const lines: IntakeLine[] = [];
  for (const item of items) {
    const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const name = String(r.name ?? "").trim().slice(0, 80);
    if (name.length < 2) continue;
    const group = titleCase(String(r.group ?? r.category ?? "").trim()).slice(0, 40);
    const kind = String(r.priceKind ?? r.labeled ?? "unknown").toLowerCase();
    const labeled: IntakeLine["labeled"] = kind.includes("card")
      ? "card"
      : kind.includes("cash")
        ? "cash"
        : "none";
    const mods = Array.isArray(r.modifiers)
      ? r.modifiers.map((m) => String(m ?? "").trim()).filter((m) => m.length > 1).slice(0, 8)
      : modifiersFromName(name);
    const alcohol = r.alcohol === undefined ? alcoholFlag(name, group) : asBool(r.alcohol);
    lines.push({
      group,
      name: name.replace(/\s*\([^)]*\)/g, "").trim() || name,
      description: String(r.description ?? "").trim().slice(0, 240),
      quotedCents: centsFromUnknown(r.price ?? r.cashPrice ?? r.priceCents),
      labeled,
      modifiers: mods,
      alcohol,
    });
  }
  return lines.length ? lines.slice(0, 80) : null;
}

/** Prefer the model when it kept every text row. A shorter model list yields to the page text. */
export function pickIntakeLines(
  textLines: IntakeLine[],
  aiLines: IntakeLine[] | null,
): { lines: IntakeLine[]; source: "ai" | "heuristic" } {
  if (aiLines && (textLines.length === 0 || aiLines.length >= textLines.length)) {
    return { lines: aiLines, source: "ai" };
  }
  return { lines: textLines, source: "heuristic" };
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function buildMenuDraftFromLines(opts: {
  lines: IntakeLine[];
  entityId: string;
  settings: IntakeSettings;
  source?: "ai" | "heuristic";
  note?: string;
}): MenuIntakeDraft {
  const policy = cashPolicyFromSettings(opts.settings);
  const rows: MenuIntakeRow[] = [];
  const questions: MenuIntakeQuestion[] = [];
  opts.lines.forEach((line, i) => {
    const row = rowFromLine(line, i, opts.entityId, policy);
    rows.push(row);
    questions.push(...questionsFor(row, policy));
  });
  const draft: MenuIntakeDraft = {
    entityId: opts.entityId,
    rows,
    questions,
    source: opts.source ?? "heuristic",
  };
  if (opts.note) draft.note = opts.note;
  else if (rows.length === 0) {
    draft.note = "No priced items were found. Paste a line like Smash Burger 14 under a group name.";
  }
  return draft;
}

export function buildMenuDraft(opts: {
  text: string;
  entityId: string;
  settings: IntakeSettings;
  source?: "ai" | "heuristic";
  note?: string;
}): MenuIntakeDraft {
  return buildMenuDraftFromLines({
    lines: heuristicMenuLines(opts.text),
    entityId: opts.entityId,
    settings: opts.settings,
    source: opts.source,
    note: opts.note,
  });
}

function rowFromLine(
  line: IntakeLine,
  i: number,
  entityId: string,
  policy: CashDiscountPolicy | null,
): MenuIntakeRow {
  const id = uid(i);
  const route = guessStation(line.name, line.group, line.alcohol);
  let cashCents: number | null = null;
  let cardCents: number | null = null;
  let priceBasis: MenuIntakeRow["priceBasis"] = "missing";
  if (line.quotedCents == null) {
    priceBasis = "missing";
  } else if (line.labeled === "card") {
    priceBasis = "card";
    const cash = policy ? cashFromCardCents(line.quotedCents, policy.percent) : line.quotedCents;
    cashCents = cash;
    cardCents = policy && cash ? cardPriceCents(cash, policy) : line.quotedCents;
  } else if (line.labeled === "cash" || !policy) {
    priceBasis = "cash";
    cashCents = line.quotedCents;
    cardCents = policy ? cardPriceCents(line.quotedCents, policy) : line.quotedCents;
  } else {
    priceBasis = "ask";
    cashCents = line.quotedCents;
    cardCents = cardPriceCents(line.quotedCents, policy);
  }
  return {
    id,
    entityId,
    group: line.group,
    name: line.name,
    description: line.description,
    quotedCents: line.quotedCents,
    cashCents,
    cardCents,
    priceBasis,
    alcohol: line.alcohol,
    modifiers: line.modifiers,
    course: route.course,
    station: route.station,
    status: "pending",
  };
}

function questionsFor(row: MenuIntakeRow, policy: CashDiscountPolicy | null): MenuIntakeQuestion[] {
  if (row.status === "dropped") return [];
  const q: MenuIntakeQuestion[] = [];
  if (row.priceBasis === "missing" || row.quotedCents == null) {
    q.push({
      id: `price:${row.id}`,
      rowId: row.id,
      kind: "price",
      prompt: `What is the cash price for ${row.name}?`,
    });
  } else if (row.priceBasis === "ask" && policy) {
    q.push({
      id: `basis:${row.id}`,
      rowId: row.id,
      kind: "basis",
      prompt: `${row.name} shows ${money(row.quotedCents)}. Is that the cash price or the card price?`,
    });
  }
  if (!row.group.trim()) {
    q.push({
      id: `group:${row.id}`,
      rowId: row.id,
      kind: "group",
      prompt: `Which menu group is ${row.name} in?`,
    });
  }
  if (row.alcohol == null) {
    q.push({
      id: `alcohol:${row.id}`,
      rowId: row.id,
      kind: "alcohol",
      prompt: `Does ${row.name} contain alcohol?`,
    });
  }
  return q;
}

function routeRow(row: MenuIntakeRow): MenuIntakeRow {
  const route = guessStation(row.name, row.group, row.alcohol);
  const next = { ...row, station: route.station, course: route.course };
  if (next.alcohol === true) {
    next.station = "bar";
    next.course = "drink";
  }
  return next;
}

export function applyIntakeAnswers(
  draft: MenuIntakeDraft,
  answers: Record<string, string>,
  settings: IntakeSettings,
): MenuIntakeDraft {
  const policy = cashPolicyFromSettings(settings);
  const rows = draft.rows.map((row) => {
    let next = { ...row, modifiers: [...row.modifiers] };
    const basis = (answers[`basis:${row.id}`] ?? "").trim().toLowerCase();
    const price = (answers[`price:${row.id}`] ?? "").trim();
    const group = (answers[`group:${row.id}`] ?? "").trim();
    const alcohol = (answers[`alcohol:${row.id}`] ?? "").trim().toLowerCase();
    if (price) {
      const cents = dollarsToCents(price);
      if (cents) {
        next.quotedCents = cents;
        next.priceBasis = "cash";
        next.cashCents = cents;
        next.cardCents = policy ? cardPriceCents(cents, policy) : cents;
      }
    }
    if (/\bcash\b/.test(basis) && !/\bcard\b/.test(basis) && next.quotedCents) {
      next.priceBasis = "cash";
      next.cashCents = next.quotedCents;
      next.cardCents = policy ? cardPriceCents(next.quotedCents, policy) : next.quotedCents;
    } else if (/\bcard\b/.test(basis) && next.quotedCents) {
      next.priceBasis = "card";
      const cash = policy ? cashFromCardCents(next.quotedCents, policy.percent) : next.quotedCents;
      next.cashCents = cash;
      next.cardCents = policy && cash ? cardPriceCents(cash, policy) : next.quotedCents;
    }
    if (group) next.group = group.slice(0, 40);
    if (/^(y|yes|yeah|true|alcohol)\b/.test(alcohol)) next.alcohol = true;
    else if (/^(n|no|nope|false)\b/.test(alcohol)) next.alcohol = false;
    next = routeRow(next);
    return next;
  });
  const questions = rows.flatMap((row) => questionsFor(row, policy));
  return { ...draft, rows, questions };
}

export function editIntakeRow(
  draft: MenuIntakeDraft,
  rowId: string,
  edit: Partial<{
    name: string;
    group: string;
    description: string;
    cashCents: number | null;
    alcohol: boolean | null;
    modifiers: string[];
    status: MenuIntakeRow["status"];
  }>,
  settings: IntakeSettings,
): MenuIntakeDraft {
  const policy = cashPolicyFromSettings(settings);
  const rows = draft.rows.map((row) => {
    if (row.id !== rowId) return row;
    let next: MenuIntakeRow = { ...row, modifiers: edit.modifiers ?? row.modifiers };
    if (edit.name != null) next.name = edit.name.slice(0, 80);
    if (edit.group != null) next.group = edit.group.slice(0, 40);
    if (edit.description != null) next.description = edit.description.slice(0, 240);
    if ("alcohol" in edit) next.alcohol = edit.alcohol ?? null;
    if (edit.status) next.status = edit.status;
    if ("cashCents" in edit) {
      if (edit.cashCents && edit.cashCents > 0) {
        next.quotedCents = edit.cashCents;
        next.priceBasis = "cash";
        next.cashCents = edit.cashCents;
        next.cardCents = policy ? cardPriceCents(edit.cashCents, policy) : edit.cashCents;
      } else {
        next.quotedCents = null;
        next.cashCents = null;
        next.cardCents = null;
        next.priceBasis = "missing";
      }
    }
    next = routeRow(next);
    return next;
  });
  return { ...draft, rows, questions: rows.flatMap((row) => questionsFor(row, policy)) };
}

export function bulkAcceptRows(draft: MenuIntakeDraft): MenuIntakeDraft {
  return {
    ...draft,
    rows: draft.rows.map((r) => (r.status === "dropped" ? r : { ...r, status: "accepted" })),
  };
}

/** Accepted rows only, forced onto this entity. Dropped rows and other entities stay out. */
export function rowsToCommit(rows: MenuIntakeRow[], entityId: string): MenuIntakeRow[] {
  return rows
    .filter((r) => r.status === "accepted" && r.entityId === entityId && r.name.trim() && r.cashCents != null)
    .map((r) => ({ ...r, entityId }));
}
