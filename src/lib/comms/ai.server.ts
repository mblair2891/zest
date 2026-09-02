import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { loadCommunicationsSettings } from "@/lib/saas/platform-settings.server";
import {
  DEFAULT_AI_DAILY_CAP,
  aiEntitled,
  decideAiCall,
  isAiIncludedWith,
  type AiIncludedWith,
} from "./policy";

export type AiReserveResult = {
  allow: boolean;
  reason?: "not_included" | "daily_cap";
  used: number;
  cap: number;
  queued: boolean;
};

const OPS_PACK_HINT =
  "AI reports and extract are included with the Ops pack. Get-a-price interview is always allowed.";

export function aiSkipReason(reason: "not_included" | "daily_cap"): string {
  if (reason === "not_included") return OPS_PACK_HINT;
  return "AI daily cap reached for this location. Queued until tomorrow — not retried in a loop.";
}

async function platformAiPolicy(): Promise<{ cap: number; includedWith: AiIncludedWith }> {
  const comms = await loadCommunicationsSettings();
  return {
    cap: Math.max(0, Math.floor(comms.aiMaxCallsPerLocationPerDay ?? DEFAULT_AI_DAILY_CAP)),
    includedWith: isAiIncludedWith(comms.aiIncludedWith) ? comms.aiIncludedWith : "ops_pack",
  };
}

async function locationEntitlement(locationId: string): Promise<{
  packages: string[];
  planSlug: string | null;
}> {
  const sql = await getSql();
  const loc = await sql<{ org_id: string; enabled_packages: unknown }>`
    select org_id, enabled_packages from locations where id = ${locationId} limit 1
  `;
  const packages = Array.isArray(loc[0]?.enabled_packages)
    ? (loc[0]!.enabled_packages as unknown[]).map(String)
    : [];
  const orgId = loc[0]?.org_id;
  if (!orgId) return { packages, planSlug: null };
  const sub = await sql<{ slug: string }>`
    select p.slug from org_subscriptions s
    join plans p on p.id = s.plan_id
    where s.org_id = ${orgId}
    limit 1
  `;
  return { packages, planSlug: sub[0]?.slug ?? null };
}

export async function countAiUsedToday(locationId: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from ai_usage_log
    where location_id = ${locationId}
      and created_at >= date_trunc('day', now())
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function getAiUsage(locationId: string): Promise<{
  used: number;
  cap: number;
  includedWith: AiIncludedWith;
}> {
  const plat = await platformAiPolicy();
  const used = await countAiUsedToday(locationId);
  return { used, cap: plat.cap, includedWith: plat.includedWith };
}

/**
 * Reserve one AI call for a location. Get-a-price interview must pass exempt.
 * Rejected calls are not logged as usage. Daily-cap rejects are "queued" (do not retry-loop).
 */
export async function reserveAiCall(opts: {
  locationId?: string | null;
  kind: string;
  exempt?: boolean;
}): Promise<AiReserveResult> {
  if (opts.exempt) {
    return { allow: true, used: 0, cap: 0, queued: false };
  }
  const loc = (opts.locationId || "").trim();
  if (!loc) {
    return { allow: true, used: 0, cap: 0, queued: false };
  }
  const plat = await platformAiPolicy();
  const [used, ent] = await Promise.all([countAiUsedToday(loc), locationEntitlement(loc)]);
  const entitled = aiEntitled({
    includedWith: plat.includedWith,
    packages: ent.packages,
    planSlug: ent.planSlug,
  });
  const decision = decideAiCall({ entitled, used, cap: plat.cap });
  if (!decision.allow) {
    console.info("[ai-throttle]", loc, opts.kind, decision.reason, used, "/", plat.cap);
    return {
      allow: false,
      reason: decision.reason,
      used: decision.used,
      cap: decision.cap,
      queued: decision.reason === "daily_cap",
    };
  }
  const sql = await getSql();
  await sql`
    insert into ai_usage_log (id, location_id, kind)
    values (${newId("aiu")}, ${loc}, ${opts.kind.slice(0, 40)})
  `;
  return { allow: true, used: used + 1, cap: plat.cap, queued: false };
}
