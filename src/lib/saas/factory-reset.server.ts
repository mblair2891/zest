/**
 * Server-only factory reset. Platform admin wipes all business data and
 * reseeds the Admin bootstrap login. Never import from client bundles.
 */
import { verifyPassword } from "better-auth/crypto";
import { getDatabaseUrl, isServerlessRuntime, readServerEnv } from "@/lib/database-url";
import { getSql, withDbTransaction, type Sql } from "@/lib/db";
import { reseedPlatformAdminBootstrap } from "@/lib/auth/bootstrap-admin.server";
import { ForbiddenError, isPlatformAdmin } from "./tenancy.server";

/** App tables wiped on factory reset. Auth + plans + pricing catalog + migrations stay. */
const WIPE_TABLES = [
  "finix_webhook_events",
  "payment_accounts",
  "gift_ledger",
  "gift_cards",
  "support_ticket_comments",
  "support_tickets",
  "crm_activities",
  "crm_opportunities",
  "crm_contacts",
  "crm_accounts",
  "saas_invoices",
  "operator_invites",
  "onboarding_runs",
  "operators",
  "prospects",
  "location_shifts",
  "location_staff",
  "hr_tax_pii",
  "hr_eligibility",
  "hr_availability",
  "hr_writeups",
  "hr_time_off",
  "hr_packets",
  "hr_onboarding",
  "hr_applicants",
  "location_punches",
  "message_log",
  "email_outbox",
  "waitlist_entries",
  "reservations",
  "front_settings",
  "voice_commands",
  "ops_ai_decisions",
  "pos_ticket_events",
  "pos_check_payments",
  "pos_check_items",
  "pos_tickets",
  "pos_table_status",
  "pos_checks",
  "offline_mutations",
  "location_devices",
  "summex_deposits",
  "summex_payments",
  "summex_merchants",
  "audit_events",
  "active_contexts",
  "invites",
  "org_subscriptions",
  "locations",
] as const;

export function factoryResetEnabled(): boolean {
  const flag = readServerEnv("FACTORY_RESET_ENABLED")?.toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return readServerEnv("VERCEL_ENV") !== "production";
}

export function factoryResetStatus(): { enabled: boolean; reason?: string } {
  if (!factoryResetEnabled()) {
    return {
      enabled: false,
      reason: "Factory reset is disabled. Set FACTORY_RESET_ENABLED=true to allow it.",
    };
  }
  if (isServerlessRuntime() && !getDatabaseUrl()) {
    return {
      enabled: false,
      reason: "Database not configured (DATABASE_URL missing).",
    };
  }
  return { enabled: true };
}

export async function factoryResetStatusForAdmin(): Promise<{ enabled: boolean; reason?: string }> {
  const gate = factoryResetStatus();
  if (!gate.enabled) return gate;
  try {
    const { isFactoryResetAllowedBySettings } = await import("./platform-settings.server");
    if (!(await isFactoryResetAllowedBySettings())) {
      return {
        enabled: false,
        reason: "Factory reset is turned off in Security & auth.",
      };
    }
  } catch {
    /* settings table may not exist yet */
  }
  return gate;
}

function normalizePhrase(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

async function deleteIfExists(sql: Sql, table: string): Promise<void> {
  try {
    await sql.query(`delete from ${table}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/does not exist|undefined table/i.test(msg)) return;
    throw err;
  }
}

export async function factoryReset(opts: {
  userId: string;
  confirmPhrase: string;
  password: string;
}): Promise<{ ok: true }> {
  const gate = await factoryResetStatusForAdmin();
  if (!gate.enabled) throw new Error(gate.reason || "Factory reset is disabled");
  if (!(await isPlatformAdmin(opts.userId))) {
    throw new ForbiddenError("Only platform admin can factory reset");
  }
  const phrase = normalizePhrase(opts.confirmPhrase);
  if (phrase !== "RESET" && phrase !== "FACTORY RESET") {
    throw new Error("Type RESET to confirm");
  }
  if (!opts.password) throw new Error("Admin password is required");

  const sql = await getSql();
  const accounts = await sql<{ password: string | null }>`
    select password from "account"
    where "userId" = ${opts.userId} and "providerId" = ${"credential"}
    limit 1
  `;
  const hash = accounts[0]?.password;
  if (!hash) throw new Error("No password is set on this account.");
  const matches = await verifyPassword({ hash, password: opts.password });
  if (!matches) throw new Error("Current password is incorrect.");

  await withDbTransaction(async (tx) => {
    for (const table of WIPE_TABLES) {
      await deleteIfExists(tx, table);
    }
    await tx.query(
      `delete from memberships
       where not (user_id = $1 and role = 'platform_admin' and org_id is null)`,
      [opts.userId],
    );
    await deleteIfExists(tx, "organizations");
    await tx.query(`delete from "session"`);
    await tx.query(`delete from "verification"`);
    await tx.query(
      `delete from "user" where id <> $1 and id not in (select user_id from platform_admin)`,
      [opts.userId],
    );
  });

  await reseedPlatformAdminBootstrap({ mustChangePassword: true });
  const after = await getSql();
  await after.query(`delete from "session"`);
  return { ok: true };
}
