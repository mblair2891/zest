import type { OpsJobRow, OpsJobRowType, OpsJobSeverity } from "./types";

const BANNED =
  /\b(thief|thieves|stole|stolen|stealing|theft|embezzl\w*|crook|criminal|fraudster|pilfer)\b/gi;

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bthief\b/gi, "review"],
  [/\bthieves\b/gi, "review"],
  [/\bstole\b/gi, "variance"],
  [/\bstolen\b/gi, "variance"],
  [/\bstealing\b/gi, "variance"],
  [/\btheft\b/gi, "exception"],
  [/\bembezzl\w*\b/gi, "exception"],
  [/\bcrook\b/gi, "review"],
  [/\bcriminal\b/gi, "exception"],
  [/\bfraudster\b/gi, "review"],
  [/\bpilfer\w*\b/gi, "variance"],
];

export function sanitizeOpsText(raw: string, max = 480): string {
  let s = String(raw ?? "");
  for (const [re, to] of REPLACEMENTS) s = s.replace(re, to);
  s = s.replace(BANNED, "review");
  s = s.replace(/\s+/g, " ").trim();
  return s.slice(0, max);
}

const ROW_TYPES: OpsJobRowType[] = [
  "floor_integrity",
  "labor_pulse",
  "gate_feed",
  "gift_burst",
  "printer",
  "exception_pack",
  "blind_count",
  "tips",
  "tender_mix",
  "void_comp",
  "capture_split",
  "cost_flash",
  "staffing_postmortem",
  "house_close",
  "peer_compare",
  "schedule_vs_sales",
  "drawer_trend",
  "menu_recipe",
  "gift_liability",
  "training_leftover",
  "pay_period",
  "risk_digest",
  "baseline",
  "vendor_cost",
  "processor_fees",
  "menu_engineering",
  "hr_packet",
  "device_unseen",
];

const SEV: OpsJobSeverity[] = ["info", "watch", "urgent"];

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseOpsJobRows(raw: unknown, max = 40): OpsJobRow[] {
  if (!Array.isArray(raw)) return [];
  const out: OpsJobRow[] = [];
  for (const item of raw.slice(0, max)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const type = ROW_TYPES.includes(o.type as OpsJobRowType)
      ? (o.type as OpsJobRowType)
      : "exception_pack";
    const severity = SEV.includes(o.severity as OpsJobSeverity)
      ? (o.severity as OpsJobSeverity)
      : "info";
    const subject = sanitizeOpsText(String(o.subject ?? ""), 160);
    const suggestedAction = sanitizeOpsText(String(o.suggestedAction ?? "Review."), 240);
    if (!subject) continue;
    out.push({
      type,
      severity,
      subject,
      amountCents: numOrNull(o.amountCents),
      pct: o.pct == null || o.pct === "" ? null : Number.isFinite(Number(o.pct)) ? Number(o.pct) : null,
      suggestedAction: suggestedAction || "Review.",
      entityId: o.entityId ? String(o.entityId).slice(0, 80) : null,
      entityName: o.entityName ? String(o.entityName).slice(0, 80) : null,
    });
  }
  return out;
}

export function parseDataGaps(raw: unknown, max = 8): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => sanitizeOpsText(String(x ?? ""), 240))
    .filter(Boolean)
    .slice(0, max);
}
