export const SMS_OVERAGE_MODES = ["bill_at_cost", "block_when_cap", "warn_only"] as const;
export type SmsOverageMode = (typeof SMS_OVERAGE_MODES)[number];

export const AI_INCLUDED_WITH = ["ops_pack", "all_paid", "all_plans"] as const;
export type AiIncludedWith = (typeof AI_INCLUDED_WITH)[number];

export const DEFAULT_SMS_INCLUDED = 500;
export const DEFAULT_SMS_OVERAGE_RATE_USD = 0.0079;
export const DEFAULT_AI_DAILY_CAP = 200;

/** Guest waitlist + tenant-invite SMS. Location sms_enabled gates these. */
export const LOCATION_SMS_KINDS = new Set([
  "waitlist_join",
  "waitlist_ready",
  "waitlist_opt_out",
  "tenant_invite",
]);

export const OPS_PACK_PACKAGES = [
  "inventory",
  "labor",
  "drink_ai",
  "ai_inventory",
  "advanced_ops",
] as const;

export function isSmsOverageMode(v: unknown): v is SmsOverageMode {
  return v === "bill_at_cost" || v === "block_when_cap" || v === "warn_only";
}

export function isAiIncludedWith(v: unknown): v is AiIncludedWith {
  return v === "ops_pack" || v === "all_paid" || v === "all_plans";
}

/** Location may only lower the platform included allotment. */
export function effectiveSmsCap(
  platformIncluded: number,
  locationCap: number | null | undefined,
): number {
  const included = Math.max(0, Math.floor(platformIncluded));
  if (locationCap == null || !Number.isFinite(locationCap)) return included;
  return Math.max(0, Math.min(included, Math.floor(locationCap)));
}

export function smsPeriodKey(at = new Date()): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function overageUnits(used: number, cap: number): number {
  return Math.max(0, Math.floor(used) - Math.max(0, Math.floor(cap)));
}

export function overageUsd(used: number, cap: number, rateUsd: number): number {
  return Math.round(overageUnits(used, cap) * Math.max(0, rateUsd) * 10000) / 10000;
}

export function commsIncludedNote(smsIncluded = DEFAULT_SMS_INCLUDED): string {
  return `Email included. SMS: ${Math.max(0, Math.floor(smsIncluded))}/mo included, extra at cost. AI reports in Ops pack.`;
}

export type SmsDecision =
  | { allow: true; overage: boolean; used: number; cap: number }
  | { allow: false; reason: "sms_disabled" | "cap_reached"; used: number; cap: number };

export function decideSmsSend(opts: {
  kind: string;
  smsEnabled: boolean;
  used: number;
  cap: number;
  mode: SmsOverageMode;
}): SmsDecision {
  const used = Math.max(0, Math.floor(opts.used));
  const cap = Math.max(0, Math.floor(opts.cap));
  if (!opts.smsEnabled && LOCATION_SMS_KINDS.has(opts.kind)) {
    return { allow: false, reason: "sms_disabled", used, cap };
  }
  if (used >= cap && opts.mode === "block_when_cap") {
    return { allow: false, reason: "cap_reached", used, cap };
  }
  return { allow: true, overage: used >= cap, used, cap };
}

export function shouldAlertThreshold(usedAfter: number, cap: number, threshold: 80 | 100): boolean {
  if (cap <= 0) return threshold === 100 && usedAfter >= 0;
  const pct = (usedAfter / cap) * 100;
  return pct >= threshold;
}

export function aiEntitled(opts: {
  includedWith: AiIncludedWith;
  packages: readonly string[];
  planSlug?: string | null;
}): boolean {
  if (opts.includedWith === "all_plans") return true;
  if (opts.includedWith === "all_paid") {
    const slug = opts.planSlug ?? "";
    return slug !== "" && slug !== "starter" && slug !== "platform_internal";
  }
  return OPS_PACK_PACKAGES.some((p) => opts.packages.includes(p));
}

export type AiDecision =
  | { allow: true; used: number; cap: number }
  | { allow: false; reason: "not_included" | "daily_cap"; used: number; cap: number };

export function decideAiCall(opts: {
  entitled: boolean;
  used: number;
  cap: number;
}): AiDecision {
  const used = Math.max(0, Math.floor(opts.used));
  const cap = Math.max(0, Math.floor(opts.cap));
  if (!opts.entitled) return { allow: false, reason: "not_included", used, cap };
  if (used >= cap) return { allow: false, reason: "daily_cap", used, cap };
  return { allow: true, used, cap };
}
