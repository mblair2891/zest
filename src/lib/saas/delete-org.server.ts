/**
 * Platform-admin delete of one CRM lead / pipeline prospect / tenant org.
 * Never wipes Admin or other tenants. Not factory reset.
 */
import { deleteIgnoringMissing, getSql, withDbTransaction, type Sql } from "@/lib/db";
import { ForbiddenError, isPlatformAdmin, writeAudit } from "./tenancy.server";
import { classifyCrmDelete, type CrmDeleteClass } from "./delete-org";

export type DeleteTargetKind = "crm" | "pipeline";

export type DeletePreview = {
  kind: DeleteTargetKind;
  id: string;
  name: string;
  class: CrmDeleteClass;
  orgId: string | null;
  prospectId: string | null;
  accountId: string | null;
};

/** Tables that actually have org_id. Missing column used to abort the tx (25P02). */
const ORG_TABLES = [
  "payment_accounts",
  "gift_ledger",
  "gift_cards",
  "support_tickets",
  "saas_invoices",
  "operator_invites",
  "hr_tax_pii",
  "hr_eligibility",
  "hr_availability",
  "hr_writeups",
  "hr_time_off",
  "hr_packets",
  "hr_onboarding",
  "hr_applicants",
  "hr_payroll_map",
  "location_punches",
  "message_log",
  "summex_deposits",
  "summex_payments",
  "summex_payment_splits",
  "summex_merchants",
  "audit_events",
  "active_contexts",
  "invites",
  "org_subscriptions",
] as const;

const LOC_TABLES = [
  "pos_ticket_events",
  "pos_check_payments",
  "pos_check_items",
  "pos_tickets",
  "pos_table_status",
  "pos_checks",
  "waitlist_entries",
  "reservations",
  "front_settings",
  "voice_commands",
  "ops_ai_decisions",
  "offline_mutations",
  "summex_payment_splits",
  "comms_cap_alerts",
  "ai_usage_log",
  "gift_ledger",
  "gift_cards",
  "location_devices",
  "location_shifts",
  "location_staff",
] as const;

async function del(sql: Sql, table: string, where: string, params: unknown[]): Promise<void> {
  await deleteIgnoringMissing(sql, table, where, params);
}

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function loadPreview(
  kind: DeleteTargetKind,
  id: string,
): Promise<DeletePreview> {
  const sql = await getSql();
  let accountId: string | null = null;
  let prospectId: string | null = null;
  let orgId: string | null = null;
  let name = "";
  let prospectStatus: string | null = null;
  let crmStage: string | null = null;

  if (kind === "crm") {
    const acc = await sql<{
      id: string;
      name: string;
      stage: string;
      prospect_id: string | null;
      org_id: string | null;
    }>`
      select id, name, stage, prospect_id, org_id from crm_accounts where id = ${id} limit 1
    `;
    const a = acc[0];
    if (!a) throw new Error("Account not found");
    accountId = a.id;
    name = a.name;
    crmStage = a.stage;
    prospectId = a.prospect_id;
    orgId = a.org_id;
  } else {
    const pr = await sql<{
      id: string;
      status: string;
      org_id: string | null;
      answers: unknown;
    }>`
      select id, status, org_id, answers from prospects where id = ${id} limit 1
    `;
    const p = pr[0];
    if (!p) throw new Error("Prospect not found");
    prospectId = p.id;
    prospectStatus = p.status;
    orgId = p.org_id;
    const answers =
      p.answers && typeof p.answers === "object" ? (p.answers as Record<string, unknown>) : {};
    const company =
      answers.company && typeof answers.company === "object"
        ? (answers.company as Record<string, unknown>)
        : {};
    name = String(company.legalName || company.dba || "Untitled").trim() || "Untitled";
    const crm = await sql<{ id: string; name: string; stage: string; org_id: string | null }>`
      select id, name, stage, org_id from crm_accounts where prospect_id = ${p.id} limit 1
    `;
    if (crm[0]) {
      accountId = crm[0].id;
      crmStage = crm[0].stage;
      name = crm[0].name || name;
      orgId = orgId || crm[0].org_id;
    }
  }

  if (prospectId && !prospectStatus) {
    const pr = await sql<{ status: string; org_id: string | null }>`
      select status, org_id from prospects where id = ${prospectId} limit 1
    `;
    prospectStatus = pr[0]?.status ?? null;
    orgId = orgId || pr[0]?.org_id || null;
  }

  let locationCount = 0;
  const locationLifecycles: string[] = [];
  if (orgId) {
    const locs = await sql<{ id: string; setup: unknown; lifecycle_status: string | null }>`
      select id, setup, lifecycle_status from locations
      where org_id = ${orgId} and coalesce(is_demo, false) = false
    `;
    locationCount = locs.length;
    for (const l of locs) {
      const setup =
        l.setup && typeof l.setup === "object" ? (l.setup as Record<string, unknown>) : {};
      const raw = String(setup.lifecycleStatus ?? l.lifecycle_status ?? "training");
      locationLifecycles.push(raw);
    }
  }

  const cls = classifyCrmDelete({
    prospectStatus,
    crmStage,
    orgId,
    locationCount,
    locationLifecycles,
  });

  return {
    kind,
    id,
    name,
    class: cls,
    orgId,
    prospectId,
    accountId,
  };
}

export async function previewCrmDelete(
  userId: string,
  opts: { kind: DeleteTargetKind; id: string },
): Promise<DeletePreview> {
  if (!(await isPlatformAdmin(userId))) {
    throw new ForbiddenError("Platform admin only");
  }
  return loadPreview(opts.kind, opts.id);
}

export async function deleteCrmOrPipeline(
  userId: string,
  opts: {
    kind: DeleteTargetKind;
    id: string;
    confirmName: string;
    extraConfirm?: boolean;
  },
): Promise<{ ok: true }> {
  if (!(await isPlatformAdmin(userId))) {
    throw new ForbiddenError("Platform admin only");
  }
  const preview = await loadPreview(opts.kind, opts.id);
  if (!namesMatch(opts.confirmName, preview.name)) {
    throw new Error(
      preview.class === "live"
        ? `Type ${preview.name} to delete this live tenant.`
        : `Confirm name does not match ${preview.name}.`,
    );
  }
  if (preview.class === "training" && !opts.extraConfirm) {
    throw new Error("Confirm that this removes the venue, entities, menus, and devices.");
  }
  if (preview.class === "live" && !opts.extraConfirm) {
    throw new Error(`Type ${preview.name} to delete this live tenant.`);
  }

  const orgId = preview.orgId;
  const prospectId = preview.prospectId;
  const accountId = preview.accountId;

  await withDbTransaction(async (sql) => {
    const locIds: string[] = [];
    if (orgId) {
      const locs = await sql<{ id: string }>`
        select id from locations where org_id = ${orgId}
      `;
      for (const l of locs) locIds.push(l.id);
    }

    for (const locId of locIds) {
      for (const table of LOC_TABLES) {
        await del(sql, table, "location_id = $1", [locId]);
      }
      await del(sql, "operators", "location_id = $1", [locId]);
    }

    if (orgId) {
      for (const table of ORG_TABLES) {
        await del(sql, table, "org_id = $1", [orgId]);
      }
      await del(sql, "operators", "org_id = $1", [orgId]);
      await del(sql, "onboarding_runs", "org_id = $1", [orgId]);
    }

    if (prospectId) {
      await del(sql, "onboarding_runs", "prospect_id = $1", [prospectId]);
      await del(sql, "email_outbox", "prospect_id = $1", [prospectId]);
    }
    if (accountId) {
      await del(
        sql,
        "support_ticket_comments",
        "ticket_id in (select id from support_tickets where account_id = $1)",
        [accountId],
      );
      await del(sql, "crm_activities", "account_id = $1", [accountId]);
      await del(sql, "crm_opportunities", "account_id = $1", [accountId]);
      await del(sql, "crm_contacts", "account_id = $1", [accountId]);
      await del(sql, "support_tickets", "account_id = $1", [accountId]);
      await del(sql, "crm_accounts", "id = $1", [accountId]);
    }
    if (prospectId) {
      await del(sql, "crm_accounts", "prospect_id = $1", [prospectId]);
      await del(sql, "crm_opportunities", "prospect_id = $1", [prospectId]);
      await del(sql, "prospects", "id = $1", [prospectId]);
    }

    if (orgId) {
      await del(
        sql,
        "memberships",
        "org_id = $1 and not (role = 'platform_admin' and org_id is null)",
        [orgId],
      );
      await del(sql, "locations", "org_id = $1", [orgId]);
      await del(sql, "organizations", "id = $1", [orgId]);
    }
  });

  await writeAudit({
    orgId: null,
    actorUserId: userId,
    action: "crm_delete",
    payload: {
      kind: preview.kind,
      id: preview.id,
      name: preview.name,
      class: preview.class,
      orgId,
      prospectId,
      accountId,
    },
  }).catch(() => undefined);

  return { ok: true };
}
