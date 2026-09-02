import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { loadCommunicationsSettings, loadGeneral } from "@/lib/saas/platform-settings.server";
import { writeAudit } from "@/lib/saas/tenancy.server";
import {
  DEFAULT_SMS_INCLUDED,
  DEFAULT_SMS_OVERAGE_RATE_USD,
  decideSmsSend,
  effectiveSmsCap,
  isSmsOverageMode,
  overageUsd,
  shouldAlertThreshold,
  smsPeriodKey,
  type SmsOverageMode,
} from "./policy";

export type SmsUsageSnapshot = {
  locationId: string;
  period: string;
  used: number;
  included: number;
  cap: number;
  overageUnits: number;
  overageUsd: number;
  overageMode: SmsOverageMode;
  overageRateUsd: number;
  smsEnabled: boolean;
  smsMonthlyCap: number | null;
};

async function platformSmsPolicy(): Promise<{
  included: number;
  mode: SmsOverageMode;
  rateUsd: number;
}> {
  const comms = await loadCommunicationsSettings();
  return {
    included: Math.max(0, Math.floor(comms.smsIncludedPerLocationPerMonth ?? DEFAULT_SMS_INCLUDED)),
    mode: isSmsOverageMode(comms.smsOverageMode) ? comms.smsOverageMode : "bill_at_cost",
    rateUsd:
      typeof comms.smsOverageRateUsd === "number" && Number.isFinite(comms.smsOverageRateUsd)
        ? Math.max(0, comms.smsOverageRateUsd)
        : DEFAULT_SMS_OVERAGE_RATE_USD,
  };
}

export async function countSmsUsed(locationId: string, period = smsPeriodKey()): Promise<number> {
  const sql = await getSql();
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y || 1970, (m || 1) - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y || 1970, m || 1, 1)).toISOString();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from message_log
    where location_id = ${locationId}
      and channel = ${"sms"}
      and provider <> ${"blocked"}
      and created_at >= ${start}::timestamptz
      and created_at < ${end}::timestamptz
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function loadLocationSmsSettings(locationId: string): Promise<{
  smsEnabled: boolean;
  smsMonthlyCap: number | null;
}> {
  const sql = await getSql();
  const rows = await sql<{ sms_enabled: boolean | null; sms_monthly_cap: number | null }>`
    select sms_enabled, sms_monthly_cap from front_settings
    where location_id = ${locationId} limit 1
  `;
  const row = rows[0];
  return {
    smsEnabled: row?.sms_enabled !== false,
    smsMonthlyCap:
      row?.sms_monthly_cap == null || !Number.isFinite(Number(row.sms_monthly_cap))
        ? null
        : Math.max(0, Math.floor(Number(row.sms_monthly_cap))),
  };
}

export async function getSmsUsage(locationId: string): Promise<SmsUsageSnapshot> {
  const period = smsPeriodKey();
  const [used, loc, plat] = await Promise.all([
    countSmsUsed(locationId, period),
    loadLocationSmsSettings(locationId),
    platformSmsPolicy(),
  ]);
  const cap = effectiveSmsCap(plat.included, loc.smsMonthlyCap);
  const extra = Math.max(0, used - cap);
  return {
    locationId,
    period,
    used,
    included: plat.included,
    cap,
    overageUnits: extra,
    overageUsd: overageUsd(used, cap, plat.rateUsd),
    overageMode: plat.mode,
    overageRateUsd: plat.rateUsd,
    smsEnabled: loc.smsEnabled,
    smsMonthlyCap: loc.smsMonthlyCap,
  };
}

export async function authorizeSmsSend(opts: {
  locationId?: string | null;
  kind: string;
}): Promise<
  | { ok: true; overage: boolean; usage: SmsUsageSnapshot | null }
  | { ok: false; reason: "sms_disabled" | "cap_reached"; usage: SmsUsageSnapshot | null }
> {
  if (!opts.locationId) return { ok: true, overage: false, usage: null };
  const usage = await getSmsUsage(opts.locationId);
  const plat = { mode: usage.overageMode };
  const decision = decideSmsSend({
    kind: opts.kind,
    smsEnabled: usage.smsEnabled,
    used: usage.used,
    cap: usage.cap,
    mode: plat.mode,
  });
  if (!decision.allow) {
    await maybeAlertCap(opts.locationId, usage, usage.used, 100);
    return { ok: false, reason: decision.reason, usage };
  }
  const after = usage.used + 1;
  if (shouldAlertThreshold(after, usage.cap, 80)) {
    await maybeAlertCap(opts.locationId, usage, after, 80);
  }
  if (shouldAlertThreshold(after, usage.cap, 100)) {
    await maybeAlertCap(opts.locationId, usage, after, 100);
  }
  return { ok: true, overage: decision.overage, usage };
}

async function maybeAlertCap(
  locationId: string,
  usage: SmsUsageSnapshot,
  usedAfter: number,
  threshold: 80 | 100,
): Promise<void> {
  if (!shouldAlertThreshold(usedAfter, usage.cap, threshold)) return;
  const sql = await getSql();
  const id = newId("calert");
  try {
    await sql`
      insert into comms_cap_alerts (id, location_id, period, threshold)
      values (${id}, ${locationId}, ${usage.period}, ${threshold})
    `;
  } catch {
    return;
  }
  const loc = await sql<{ org_id: string; name: string }>`
    select org_id, name from locations where id = ${locationId} limit 1
  `;
  const orgId = loc[0]?.org_id ?? null;
  const locName = loc[0]?.name ?? locationId;
  const subject =
    threshold === 100
      ? `SMS cap reached at ${locName} (${usage.used}/${usage.cap} this month)`
      : `SMS at 80% of cap at ${locName} (${usedAfter}/${usage.cap} this month)`;
  const text = [
    `${locName} SMS this period (${usage.period}): ${usedAfter} used of ${usage.cap} cap (platform included ${usage.included}).`,
    `Overage mode: ${usage.overageMode.replaceAll("_", " ")}.`,
    usage.overageMode === "block_when_cap"
      ? "Further waitlist and invite texts will be blocked until next month unless the cap is raised."
      : usage.overageMode === "bill_at_cost"
        ? `Extra texts bill at about $${usage.overageRateUsd.toFixed(4)} each.`
        : "Warn only — texts still send. Email is never counted.",
    "Email (quotes, invites, receipts) stays included and does not use this counter.",
  ].join("\n");
  try {
    const { sendEmail } = await import("@/lib/saas/email.server");
    const general = await loadGeneral();
    const managerEmails = orgId
      ? await sql<{ email: string }>`
          select u.email from memberships m
          join "user" u on u.id = m.user_id
          where m.org_id = ${orgId}
            and m.status = ${"active"}
            and m.role in (${"owner"}, ${"manager"})
            and u.email is not null
        `
      : [];
    const seen = new Set<string>();
    for (const row of managerEmails) {
      const to = String(row.email ?? "").trim();
      if (!to || !to.includes("@") || seen.has(to)) continue;
      seen.add(to);
      await sendEmail({
        to,
        subject,
        text,
        kind: threshold === 100 ? "sms_cap_100" : "sms_cap_80",
      });
    }
    const platform = (general.supportEmail || "").trim();
    if (platform && platform.includes("@") && !seen.has(platform)) {
      await sendEmail({
        to: platform,
        subject: `[platform] ${subject}`,
        text,
        kind: threshold === 100 ? "sms_cap_100_platform" : "sms_cap_80_platform",
      });
    }
    if (orgId) {
      await writeAudit({
        orgId,
        action: threshold === 100 ? "sms_cap_100" : "sms_cap_80",
        payload: { locationId, used: usedAfter, cap: usage.cap, period: usage.period },
      });
    }
  } catch (err) {
    console.warn("[sms-cap-alert]", err);
  }
}
