/** Strip PANs, PINs, and ticket dumps before any model call. */

const STOP = new Set([
  "the",
  "a",
  "an",
  "to",
  "of",
  "and",
  "or",
  "for",
  "in",
  "on",
  "how",
  "do",
  "i",
  "we",
  "my",
  "this",
  "that",
  "is",
  "it",
  "please",
  "can",
  "what",
]);

export function tokenizeHelpQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

export function scrubHelpQuestion(raw: string): string {
  let s = String(raw ?? "").slice(0, 500);
  s = s.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[card]");
  s = s.replace(/\bpin\s*[:#-]?\s*\d{4,6}\b/gi, "PIN");
  s = s.replace(/\b\d{4}\b/g, (m, offset) => {
    const around = s.slice(Math.max(0, offset - 12), offset).toLowerCase();
    if (around.includes("pin") || around.includes("code")) return "****";
    return m;
  });
  s = s.replace(/\b(?:cvv|cvc|csc)\s*[:#-]?\s*\d{3,4}\b/gi, "[cvv]");
  return s.trim();
}

export function looksLikeTicketDump(q: string): boolean {
  const n = (q.match(/\$\d/g) || []).length;
  return n >= 4 || /itemized|line items|pan\b/i.test(q);
}
