import { getSql } from "@/lib/db";
import { newId } from "./ids";
import { ForbiddenError, isPlatformAdmin, listMembersForOrg, writeAudit } from "./tenancy.server";
import type { PlanSlug } from "./types";
import { PLAN_SLUGS } from "./types";
import type { ProspectRecord, ProspectStatus } from "./prospect-types";
import {
  ACCOUNT_SOURCES,
  ACCOUNT_STAGES,
  ACTIVITY_KINDS,
  CONTACT_ROLES,
  DEAL_STAGES,
  INVOICE_STATUSES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  prospectStatusToStage,
  type AccountSource,
  type AccountStage,
  type ActivityKind,
  type ContactRole,
  type CrmAccount,
  type CrmActivity,
  type CrmContact,
  type CrmOpportunity,
  type DealStage,
  type InvoiceStatus,
  type OnboardingWorkspaceRow,
  type SaasInvoice,
  type SaasReportSnapshot,
  type SupportTicket,
  type TenantDirectoryRow,
  type TenantDrillIn,
  type TicketComment,
  type TicketPriority,
  type TicketStatus,
} from "./crm-types";
import { ONBOARDING_STEP_IDS } from "./prospect-types";

function iso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function isoOrNull(v: unknown): string | null {
  if (!v) return null;
  return iso(v);
}

function tagsOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").slice(0, 24);
}

function asStage(raw: unknown): AccountStage {
  return (ACCOUNT_STAGES as readonly string[]).includes(String(raw))
    ? (raw as AccountStage)
    : "lead";
}

function asSource(raw: unknown): AccountSource {
  return (ACCOUNT_SOURCES as readonly string[]).includes(String(raw))
    ? (raw as AccountSource)
    : "inbound";
}

async function requireAdmin(userId: string) {
  if (!(await isPlatformAdmin(userId))) throw new ForbiddenError();
}

type AccRow = {
  id: string;
  name: string;
  legal_name: string | null;
  stage: string;
  owner_user_id: string | null;
  tags: unknown;
  source: string;
  prospect_id: string | null;
  org_id: string | null;
  notes: string | null;
  created_at: unknown;
  updated_at: unknown;
  owner_name?: string | null;
  org_name?: string | null;
  contact_count?: number;
  open_tickets?: number;
  next_due_at?: unknown;
};

function mapAccount(r: AccRow): CrmAccount {
  return {
    id: r.id,
    name: r.name,
    legalName: r.legal_name,
    stage: asStage(r.stage),
    ownerUserId: r.owner_user_id,
    ownerName: r.owner_name ?? null,
    tags: tagsOf(r.tags),
    source: asSource(r.source),
    prospectId: r.prospect_id,
    orgId: r.org_id,
    orgName: r.org_name ?? null,
    notes: r.notes,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    contactCount: Number(r.contact_count ?? 0),
    openTickets: Number(r.open_tickets ?? 0),
    nextDueAt: isoOrNull(r.next_due_at),
  };
}

export async function ensureCrmFromProspect(prospect: ProspectRecord): Promise<string> {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from crm_accounts where prospect_id = ${prospect.id} limit 1
  `;
  const answers = prospect.answers;
  const name =
    answers.company.dba?.trim() ||
    answers.company.legalName?.trim() ||
    prospect.email ||
    "Untitled account";
  const stage = prospectStatusToStage(prospect.status);
  const amount = prospect.quote?.monthlyCents ?? 0;
  const plan = (prospect.quote?.planSlug as PlanSlug | undefined) ?? null;
  if (existing[0]) {
    await sql`
      update crm_accounts
      set name = ${name},
          legal_name = ${answers.company.legalName || null},
          stage = ${stage},
          org_id = ${prospect.orgId},
          updated_at = now()
      where id = ${existing[0].id}
    `;
    await sql`
      update crm_opportunities
      set amount_cents = ${amount},
          plan_slug = ${plan},
          stage = ${stage},
          updated_at = now()
      where prospect_id = ${prospect.id}
    `;
    return existing[0].id;
  }
  const accountId = newId("acct");
  await sql`
    insert into crm_accounts (
      id, name, legal_name, stage, owner_user_id, source, prospect_id, org_id
    ) values (
      ${accountId},
      ${name},
      ${answers.company.legalName || null},
      ${stage},
      ${prospect.ownerUserId},
      ${"inbound"},
      ${prospect.id},
      ${prospect.orgId}
    )
  `;
  const contactName = answers.company.legalName || prospect.email || "Primary contact";
  const email = answers.company.billingEmail || prospect.email;
  if (email || contactName) {
    await sql`
      insert into crm_contacts (id, account_id, name, email, phone, role)
      values (
        ${newId("ctc")},
        ${accountId},
        ${contactName},
        ${email || null},
        ${answers.company.phone || null},
        ${"owner"}
      )
    `;
  }
  await sql`
    insert into crm_opportunities (
      id, account_id, name, amount_cents, plan_slug, stage, probability, prospect_id
    ) values (
      ${newId("opp")},
      ${accountId},
      ${`${name} · Summex`},
      ${amount},
      ${plan},
      ${stage},
      ${stage === "live" ? 100 : stage === "onboarding" ? 80 : stage === "contract" ? 70 : 20},
      ${prospect.id}
    )
  `;
  await sql`
    insert into crm_activities (id, account_id, kind, body, actor_user_id)
    values (
      ${newId("act")},
      ${accountId},
      ${"status"},
      ${`Prospect ${prospect.status} synced into CRM.`},
      ${prospect.ownerUserId}
    )
  `;
  return accountId;
}

export async function syncAllProspectsToCrm(): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select p.id from prospects p
    left join crm_accounts a on a.prospect_id = p.id
    where a.id is null
    limit 200
  `;
  if (!rows.length) return;
  const { getProspectById } = await import("./prospects.server");
  for (const r of rows) {
    const p = await getProspectById(r.id);
    if (p) await ensureCrmFromProspect(p);
  }
}

export async function listAccounts(
  userId: string,
  opts?: { q?: string; stage?: AccountStage | "all" },
): Promise<CrmAccount[]> {
  await requireAdmin(userId);
  await syncAllProspectsToCrm();
  const sql = await getSql();
  const q = opts?.q?.trim().toLowerCase() ?? "";
  const stage = opts?.stage && opts.stage !== "all" ? opts.stage : null;
  const rows = await sql<AccRow>`
    select a.*,
      u.name as owner_name,
      o.name as org_name,
      (select count(*)::int from crm_contacts c where c.account_id = a.id) as contact_count,
      (select count(*)::int from support_tickets t
        where t.account_id = a.id and t.status in ('open','pending')) as open_tickets,
      (select min(x.due_at) from crm_activities x
        where x.account_id = a.id and x.done_at is null and x.due_at is not null) as next_due_at
    from crm_accounts a
    left join "user" u on u.id = a.owner_user_id
    left join organizations o on o.id = a.org_id and coalesce(o.is_demo, false) = false
    where (${stage}::text is null or a.stage = ${stage})
      and (
        ${q} = ''
        or lower(a.name) like ${"%" + q + "%"}
        or lower(coalesce(a.legal_name,'')) like ${"%" + q + "%"}
      )
    order by a.updated_at desc
    limit 200
  `;
  return rows.map(mapAccount);
}

export async function getAccount(userId: string, accountId: string) {
  await requireAdmin(userId);
  const sql = await getSql();
  const rows = await sql<AccRow>`
    select a.*, u.name as owner_name, o.name as org_name,
      (select count(*)::int from crm_contacts c where c.account_id = a.id) as contact_count,
      (select count(*)::int from support_tickets t
        where t.account_id = a.id and t.status in ('open','pending')) as open_tickets,
      (select min(x.due_at) from crm_activities x
        where x.account_id = a.id and x.done_at is null and x.due_at is not null) as next_due_at
    from crm_accounts a
    left join "user" u on u.id = a.owner_user_id
    left join organizations o on o.id = a.org_id
    where a.id = ${accountId}
  `;
  if (!rows[0]) throw new Error("Account not found");
  const contacts = await sql<{
    id: string; account_id: string; name: string; email: string | null;
    phone: string | null; role: string; created_at: unknown;
  }>`select * from crm_contacts where account_id = ${accountId} order by created_at asc`;
  const opps = await sql<{
    id: string; account_id: string; name: string; amount_cents: number;
    plan_slug: string | null; stage: string; close_date: unknown;
    probability: number; prospect_id: string | null; created_at: unknown; updated_at: unknown;
  }>`select * from crm_opportunities where account_id = ${accountId} order by updated_at desc`;
  const acts = await sql<{
    id: string; account_id: string; contact_id: string | null; kind: string;
    body: string; due_at: unknown; done_at: unknown; actor_user_id: string | null;
    created_at: unknown; actor_name: string | null;
  }>`
    select x.*, u.name as actor_name
    from crm_activities x
    left join "user" u on u.id = x.actor_user_id
    where x.account_id = ${accountId}
    order by x.created_at desc
    limit 80
  `;
  return {
    account: mapAccount(rows[0]),
    contacts: contacts.map((c): CrmContact => ({
      id: c.id,
      accountId: c.account_id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: (CONTACT_ROLES as readonly string[]).includes(c.role) ? (c.role as ContactRole) : "other",
      createdAt: iso(c.created_at),
    })),
    opportunities: opps.map((o): CrmOpportunity => ({
      id: o.id,
      accountId: o.account_id,
      name: o.name,
      amountCents: Number(o.amount_cents) || 0,
      planSlug: (PLAN_SLUGS as readonly string[]).includes(String(o.plan_slug))
        ? (o.plan_slug as PlanSlug)
        : null,
      stage: asStage(o.stage),
      closeDate: o.close_date ? String(o.close_date).slice(0, 10) : null,
      probability: Number(o.probability) || 0,
      prospectId: o.prospect_id,
      createdAt: iso(o.created_at),
      updatedAt: iso(o.updated_at),
    })),
    activities: acts.map((a): CrmActivity => ({
      id: a.id,
      accountId: a.account_id,
      contactId: a.contact_id,
      kind: (ACTIVITY_KINDS as readonly string[]).includes(a.kind) ? (a.kind as ActivityKind) : "note",
      body: a.body,
      dueAt: isoOrNull(a.due_at),
      doneAt: isoOrNull(a.done_at),
      actorUserId: a.actor_user_id,
      actorName: a.actor_name ?? null,
      createdAt: iso(a.created_at),
    })),
  };
}

export async function createLead(
  userId: string,
  input: {
    name: string;
    email?: string;
    phone?: string;
    source?: AccountSource;
    ownerUserId?: string | null;
    amountCents?: number;
    notes?: string;
  },
): Promise<CrmAccount> {
  await requireAdmin(userId);
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Account name is required");
  const sql = await getSql();
  const id = newId("acct");
  const source = input.source && ACCOUNT_SOURCES.includes(input.source) ? input.source : "inbound";
  let ownerId = input.ownerUserId ?? userId;
  if (input.ownerUserId === undefined) {
    try {
      const { loadCrmSettings } = await import("./platform-settings.server");
      const crm = await loadCrmSettings();
      if (crm.defaultDealOwnerUserId) ownerId = crm.defaultDealOwnerUserId;
    } catch {
      /* defaults */
    }
  }
  await sql`
    insert into crm_accounts (id, name, stage, owner_user_id, source, notes)
    values (${id}, ${name}, ${"lead"}, ${ownerId}, ${source}, ${input.notes ?? null})
  `;
  if (input.email || input.phone) {
    await sql`
      insert into crm_contacts (id, account_id, name, email, phone, role)
      values (
        ${newId("ctc")}, ${id}, ${name}, ${input.email ?? null}, ${input.phone ?? null}, ${"owner"}
      )
    `;
  }
  await sql`
    insert into crm_opportunities (id, account_id, name, amount_cents, stage, probability)
    values (${newId("opp")}, ${id}, ${`${name} · Summex`}, ${Math.max(0, input.amountCents ?? 0)}, ${"lead"}, 10)
  `;
  await sql`
    insert into crm_activities (id, account_id, kind, body, actor_user_id)
    values (${newId("act")}, ${id}, ${"status"}, ${"Lead created."}, ${userId})
  `;
  await writeAudit({ actorUserId: userId, action: "crm_lead_created", payload: { accountId: id } });
  const list = await listAccounts(userId, { q: name });
  return list.find((a) => a.id === id) ?? (await getAccount(userId, id)).account;
}

export async function patchAccount(
  userId: string,
  accountId: string,
  patch: Partial<{
    name: string;
    stage: AccountStage;
    ownerUserId: string | null;
    tags: string[];
    source: AccountSource;
    notes: string;
  }>,
): Promise<void> {
  await requireAdmin(userId);
  const sql = await getSql();
  const cur = await sql<AccRow>`select * from crm_accounts where id = ${accountId}`;
  if (!cur[0]) throw new Error("Account not found");
  const name = patch.name?.trim() || cur[0].name;
  const stage = patch.stage && ACCOUNT_STAGES.includes(patch.stage) ? patch.stage : asStage(cur[0].stage);
  if (patch.stage === "qualified") {
    try {
      const { loadCrmSettings } = await import("./platform-settings.server");
      const crm = await loadCrmSettings();
      if (crm.requireNextActivityWhenQualified) {
        const open = await sql<{ n: number }>`
          select count(*)::int as n from crm_activities
          where account_id = ${accountId} and done_at is null and due_at is not null
        `;
        if (!Number(open[0]?.n)) {
          throw new Error("Qualified requires a next activity with a due date. Log a follow-up first.");
        }
      }
    } catch (err) {
      if (err instanceof Error && /Qualified requires/.test(err.message)) throw err;
    }
  }
  const source = patch.source && ACCOUNT_SOURCES.includes(patch.source) ? patch.source : asSource(cur[0].source);
  const tags = patch.tags ? JSON.stringify(patch.tags.slice(0, 24)) : JSON.stringify(tagsOf(cur[0].tags));
  const owner = patch.ownerUserId === undefined ? cur[0].owner_user_id : patch.ownerUserId;
  const notes = patch.notes === undefined ? cur[0].notes : patch.notes;
  await sql`
    update crm_accounts
    set name = ${name}, stage = ${stage}, owner_user_id = ${owner},
        tags = ${tags}::jsonb, source = ${source}, notes = ${notes}, updated_at = now()
    where id = ${accountId}
  `;
  if (patch.stage && patch.stage !== cur[0].stage) {
    await sql`
      insert into crm_activities (id, account_id, kind, body, actor_user_id)
      values (
        ${newId("act")}, ${accountId}, ${"status"},
        ${`Stage ${cur[0].stage} → ${patch.stage}`}, ${userId}
      )
    `;
    await sql`
      update crm_opportunities set stage = ${patch.stage}, updated_at = now()
      where account_id = ${accountId}
    `;
  }
}

export async function addContact(
  userId: string,
  input: { accountId: string; name: string; email?: string; phone?: string; role?: ContactRole },
): Promise<void> {
  await requireAdmin(userId);
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Contact name is required");
  const role = input.role && CONTACT_ROLES.includes(input.role) ? input.role : "other";
  const sql = await getSql();
  await sql`
    insert into crm_contacts (id, account_id, name, email, phone, role)
    values (${newId("ctc")}, ${input.accountId}, ${name}, ${input.email ?? null}, ${input.phone ?? null}, ${role})
  `;
}

export async function addActivity(
  userId: string,
  input: {
    accountId: string;
    kind: ActivityKind;
    body: string;
    dueAt?: string | null;
    contactId?: string | null;
  },
): Promise<void> {
  await requireAdmin(userId);
  const kind = ACTIVITY_KINDS.includes(input.kind) ? input.kind : "note";
  const body = input.body.trim();
  if (!body) throw new Error("Activity text is required");
  const sql = await getSql();
  await sql`
    insert into crm_activities (id, account_id, contact_id, kind, body, due_at, actor_user_id)
    values (
      ${newId("act")}, ${input.accountId}, ${input.contactId ?? null}, ${kind},
      ${body}, ${input.dueAt ?? null}, ${userId}
    )
  `;
}

export async function completeActivity(userId: string, activityId: string): Promise<void> {
  await requireAdmin(userId);
  const sql = await getSql();
  await sql`update crm_activities set done_at = now() where id = ${activityId}`;
}

export async function upsertOpportunity(
  userId: string,
  input: {
    id?: string;
    accountId: string;
    name: string;
    amountCents: number;
    stage?: DealStage;
    planSlug?: PlanSlug | null;
    closeDate?: string | null;
    probability?: number;
  },
): Promise<void> {
  await requireAdmin(userId);
  const sql = await getSql();
  const stage = input.stage && DEAL_STAGES.includes(input.stage) ? input.stage : "lead";
  const prob = Math.min(100, Math.max(0, Math.round(input.probability ?? 10)));
  if (input.id) {
    await sql`
      update crm_opportunities
      set name = ${input.name.trim()}, amount_cents = ${Math.max(0, input.amountCents)},
          stage = ${stage}, plan_slug = ${input.planSlug ?? null},
          close_date = ${input.closeDate ?? null}, probability = ${prob}, updated_at = now()
      where id = ${input.id}
    `;
    return;
  }
  await sql`
    insert into crm_opportunities (
      id, account_id, name, amount_cents, plan_slug, stage, close_date, probability
    ) values (
      ${newId("opp")}, ${input.accountId}, ${input.name.trim() || "Opportunity"},
      ${Math.max(0, input.amountCents)}, ${input.planSlug ?? null}, ${stage},
      ${input.closeDate ?? null}, ${prob}
    )
  `;
}

export async function startOnboardingForAccount(userId: string, accountId: string) {
  await requireAdmin(userId);
  const sql = await getSql();
  const acc = await sql<{ prospect_id: string | null; name: string }>`
    select prospect_id, name from crm_accounts where id = ${accountId}
  `;
  if (!acc[0]) throw new Error("Account not found");
  let prospectId = acc[0].prospect_id;
  if (!prospectId) {
    const { createProspect } = await import("./prospects.server");
    const contacts = await sql<{ email: string | null }>`
      select email from crm_contacts where account_id = ${accountId} and email is not null limit 1
    `;
    const p = await createProspect({ userId, email: contacts[0]?.email ?? null });
    prospectId = p.id;
    await sql`delete from crm_accounts where prospect_id = ${prospectId} and id <> ${accountId}`;
    await sql`
      update crm_accounts set prospect_id = ${prospectId}, updated_at = now() where id = ${accountId}
    `;
    await sql`
      update prospects
      set answers = jsonb_set(coalesce(answers, '{}'::jsonb), '{company,dba}', to_jsonb(${acc[0].name}::text))
      where id = ${prospectId}
    `;
  }
  const { getProspectById, markContractSigned, adminSetProspectStatus } = await import(
    "./prospects.server"
  );
  const row = await getProspectById(prospectId);
  if (!row) throw new Error("Prospect missing");
  const status = row.status;
  if (status === "prospect" || status === "quoted" || status === "accepted") {
    if (status === "prospect") {
      await adminSetProspectStatus({ userId, prospectId, status: "quoted", note: "CRM start onboarding" });
      await adminSetProspectStatus({ userId, prospectId, status: "accepted", note: "CRM start onboarding" });
    } else if (status === "quoted") {
      await adminSetProspectStatus({ userId, prospectId, status: "accepted", note: "CRM start onboarding" });
    }
    await markContractSigned({ userId, prospectId });
  } else if (status === "contracted") {
    await adminSetProspectStatus({ userId, prospectId, status: "onboarding" });
  }
  await patchAccount(userId, accountId, { stage: "onboarding" });
  return { prospectId };
}

export async function goLiveForAccount(userId: string, accountId: string) {
  await requireAdmin(userId);
  const sql = await getSql();
  const acc = await sql<{ prospect_id: string | null; org_id: string | null }>`
    select prospect_id, org_id from crm_accounts where id = ${accountId}
  `;
  if (!acc[0]?.prospect_id) throw new Error("No linked prospect — complete intake or start onboarding first");
  const { maybePromoteLive, adminSetProspectStatus, getProspectDetail } = await import(
    "./prospects.server"
  );
  const promoted = await maybePromoteLive({ prospectId: acc[0].prospect_id, actorUserId: userId });
  if (promoted.status !== "live") {
    const detail = await getProspectDetail({ userId, prospectId: acc[0].prospect_id });
    if (detail.orgId) {
      await adminSetProspectStatus({
        userId,
        prospectId: acc[0].prospect_id,
        status: "live",
        note: "Admin go-live",
      });
    } else {
      throw new Error(
        `Not ready to go live: ${detail.liveChecklist.ready ? "complete onboarding acks" : "org, location, and owner invite required"}`,
      );
    }
  }
  await patchAccount(userId, accountId, { stage: "live" });
  return { ok: true as const };
}

export async function listFollowUps(userId: string): Promise<CrmActivity[]> {
  await requireAdmin(userId);
  const sql = await getSql();
  const rows = await sql<{
    id: string; account_id: string; contact_id: string | null; kind: string;
    body: string; due_at: unknown; done_at: unknown; actor_user_id: string | null;
    created_at: unknown; actor_name: string | null;
  }>`
    select x.*, u.name as actor_name
    from crm_activities x
    left join "user" u on u.id = x.actor_user_id
    where x.done_at is null and x.due_at is not null
    order by x.due_at asc
    limit 40
  `;
  return rows.map((a) => ({
    id: a.id,
    accountId: a.account_id,
    contactId: a.contact_id,
    kind: (ACTIVITY_KINDS as readonly string[]).includes(a.kind) ? (a.kind as ActivityKind) : "task",
    body: a.body,
    dueAt: isoOrNull(a.due_at),
    doneAt: isoOrNull(a.done_at),
    actorUserId: a.actor_user_id,
    actorName: a.actor_name ?? null,
    createdAt: iso(a.created_at),
  }));
}

export async function listTenantDirectory(userId: string): Promise<TenantDirectoryRow[]> {
  await requireAdmin(userId);
  const sql = await getSql();
  const rows = await sql<{
    id: string; name: string; status: string; created_at: unknown;
    plan_id: string | null; plan_status: string | null;
    loc_count: number; op_count: number; mem_count: number;
    open_tickets: number; account_id: string | null; stage: string | null;
    mrr_cents: number | null;
  }>`
    select o.id, o.name, o.status, o.created_at,
      s.plan_id, s.status as plan_status,
      (select count(*)::int from locations l
        where l.org_id = o.id and coalesce(l.is_demo, false) = false) as loc_count,
      (select count(*)::int from operators op where op.org_id = o.id) as op_count,
      (select count(*)::int from memberships m
        where m.org_id = o.id and m.status = 'active') as mem_count,
      (select count(*)::int from support_tickets t
        where t.org_id = o.id and t.status in ('open','pending')) as open_tickets,
      a.id as account_id, a.stage,
      coalesce((
        select o2.amount_cents from crm_opportunities o2
        where o2.account_id = a.id order by o2.updated_at desc limit 1
      ), 0) as mrr_cents
    from organizations o
    left join org_subscriptions s on s.org_id = o.id
    left join crm_accounts a on a.org_id = o.id
    where coalesce(o.is_demo, false) = false
    order by o.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status === "suspended" ? "suspended" : "active",
    planId: (PLAN_SLUGS as readonly string[]).includes(String(r.plan_id))
      ? (r.plan_id as PlanSlug)
      : null,
    planStatus: r.plan_status,
    locationCount: Number(r.loc_count) || 0,
    operatorCount: Number(r.op_count) || 0,
    memberCount: Number(r.mem_count) || 0,
    mrrCents: Number(r.mrr_cents) || 0,
    pastDue: r.plan_status === "past_due",
    openTickets: Number(r.open_tickets) || 0,
    accountId: r.account_id,
    stage: r.stage ? asStage(r.stage) : null,
    createdAt: iso(r.created_at),
  }));
}

export async function getTenantDrillIn(userId: string, orgId: string): Promise<TenantDrillIn> {
  await requireAdmin(userId);
  const dir = await listTenantDirectory(userId);
  const org = dir.find((t) => t.id === orgId);
  if (!org) throw new Error("Tenant not found");
  const sql = await getSql();
  const locations = await sql<{
    id: string;
    name: string;
    venue_type: string;
    status: string;
    setup: unknown;
    lifecycle_status: string | null;
  }>`
    select id, name, venue_type, status, setup, lifecycle_status from locations
    where org_id = ${orgId} and coalesce(is_demo, false) = false
    order by name
  `;
  const members = await listMembersForOrg(userId, orgId);
  const operators = await sql<{
    id: string;
    dba: string | null;
    legal_name: string;
    location_id: string | null;
    onboard_status: string | null;
  }>`
    select id, dba, legal_name, location_id, onboard_status from operators where org_id = ${orgId}
  `;
  return {
    org,
    locations: locations.map((l) => {
      const setup =
        l.setup && typeof l.setup === "object" ? (l.setup as Record<string, unknown>) : {};
      const life = String(setup.lifecycleStatus ?? l.lifecycle_status ?? "training");
      return {
        id: l.id,
        name: l.name,
        venueType: l.venue_type,
        status: l.status,
        lifecycleStatus:
          life === "training" || life === "scheduled_live" || life === "live" || life === "onboarding"
            ? life
            : undefined,
      };
    }),
    members: members.map((m) => ({
      id: m.id,
      name: m.name ?? "Member",
      email: m.email ?? "",
      role: m.role,
    })),
    operators: operators.map((o) => ({
      id: o.id,
      dba: o.dba || o.legal_name,
      locationId: o.location_id,
      onboardStatus: o.onboard_status ?? "draft",
    })),
  };
}

export async function listOnboardingWorkspace(userId: string): Promise<OnboardingWorkspaceRow[]> {
  await requireAdmin(userId);
  const sql = await getSql();
  const rows = await sql<{
    run_id: string; prospect_id: string; org_id: string | null;
    run_status: string; steps: unknown; updated_at: unknown;
    prospect_status: string; public_token: string;
    account_id: string | null; account_name: string | null; org_name: string | null;
    payload: unknown;
  }>`
    select r.id as run_id, r.prospect_id, r.org_id, r.status as run_status, r.steps, r.updated_at, r.payload,
      p.status as prospect_status, p.public_token,
      a.id as account_id, a.name as account_name, o.name as org_name
    from onboarding_runs r
    join prospects p on p.id = r.prospect_id
    left join crm_accounts a on a.prospect_id = p.id
    left join organizations o on o.id = r.org_id and coalesce(o.is_demo, false) = false
    order by r.updated_at desc
    limit 100
  `;
  const { evaluateLiveChecklist } = await import("./prospects.server");
  const out: OnboardingWorkspaceRow[] = [];
  for (const r of rows) {
    const steps = (r.steps ?? {}) as Record<string, { done?: boolean }>;
    const done = ONBOARDING_STEP_IDS.filter((id) => steps[id]?.done).length;
    const progressPct = Math.round((done / ONBOARDING_STEP_IDS.length) * 100);
    const payload = (r.payload ?? {}) as { checklist?: { trainingAck?: boolean; hardwareAck?: boolean; paymentsAck?: boolean } };
    const blockers: string[] = [];
    for (const id of ONBOARDING_STEP_IDS) {
      if (!steps[id]?.done) blockers.push(id);
    }
    if (!payload.checklist?.trainingAck) blockers.push("training ack");
    if (!payload.checklist?.hardwareAck) blockers.push("hardware ack");
    if (!payload.checklist?.paymentsAck) blockers.push("payments ack");
    if (r.org_id) {
      const live = await evaluateLiveChecklist(r.org_id);
      if (!live.hasLocation) blockers.push("location");
      if (!live.hasOwner) blockers.push("owner invite");
    } else {
      blockers.push("organization");
    }
    out.push({
      runId: r.run_id,
      prospectId: r.prospect_id,
      accountId: r.account_id,
      accountName: r.account_name || "Prospect",
      orgId: r.org_id,
      orgName: r.org_name,
      status: r.run_status === "complete" ? "complete" : "in_progress",
      prospectStatus: r.prospect_status as ProspectStatus,
      progressPct,
      blockers: [...new Set(blockers)].slice(0, 8),
      updatedAt: iso(r.updated_at),
      publicToken: r.public_token,
    });
  }
  return out;
}

export async function listTickets(userId: string, status?: TicketStatus | "all"): Promise<SupportTicket[]> {
  await requireAdmin(userId);
  const sql = await getSql();
  const st = status && status !== "all" ? status : null;
  const rows = await sql<{
    id: string; account_id: string | null; org_id: string | null;
    subject: string; priority: string; status: string;
    created_by: string | null; created_at: unknown; updated_at: unknown;
    account_name: string | null; org_name: string | null; comment_count: number;
  }>`
    select t.*, a.name as account_name, o.name as org_name,
      (select count(*)::int from support_ticket_comments c where c.ticket_id = t.id) as comment_count
    from support_tickets t
    left join crm_accounts a on a.id = t.account_id
    left join organizations o on o.id = t.org_id
    where (${st}::text is null or t.status = ${st})
    order by t.updated_at desc
    limit 100
  `;
  return rows.map((t) => ({
    id: t.id,
    accountId: t.account_id,
    accountName: t.account_name,
    orgId: t.org_id,
    orgName: t.org_name,
    subject: t.subject,
    priority: (TICKET_PRIORITIES as readonly string[]).includes(t.priority)
      ? (t.priority as TicketPriority)
      : "normal",
    status: (TICKET_STATUSES as readonly string[]).includes(t.status)
      ? (t.status as TicketStatus)
      : "open",
    createdBy: t.created_by,
    createdAt: iso(t.created_at),
    updatedAt: iso(t.updated_at),
    commentCount: Number(t.comment_count) || 0,
  }));
}

export async function createTicket(
  userId: string,
  input: { subject: string; accountId?: string | null; orgId?: string | null; priority?: TicketPriority; body?: string },
): Promise<SupportTicket> {
  await requireAdmin(userId);
  const subject = input.subject.trim();
  if (subject.length < 3) throw new Error("Subject is required");
  const sql = await getSql();
  const id = newId("tkt");
  const priority = input.priority && TICKET_PRIORITIES.includes(input.priority) ? input.priority : "normal";
  await sql`
    insert into support_tickets (id, account_id, org_id, subject, priority, created_by)
    values (${id}, ${input.accountId ?? null}, ${input.orgId ?? null}, ${subject}, ${priority}, ${userId})
  `;
  if (input.body?.trim()) {
    await sql`
      insert into support_ticket_comments (id, ticket_id, body, author_user_id)
      values (${newId("tcm")}, ${id}, ${input.body.trim()}, ${userId})
    `;
  }
  const list = await listTickets(userId);
  return list.find((t) => t.id === id)!;
}

export async function patchTicket(
  userId: string,
  ticketId: string,
  patch: { status?: TicketStatus; priority?: TicketPriority },
): Promise<void> {
  await requireAdmin(userId);
  const sql = await getSql();
  const status = patch.status && TICKET_STATUSES.includes(patch.status) ? patch.status : null;
  const priority = patch.priority && TICKET_PRIORITIES.includes(patch.priority) ? patch.priority : null;
  await sql`
    update support_tickets
    set status = coalesce(${status}, status),
        priority = coalesce(${priority}, priority),
        updated_at = now()
    where id = ${ticketId}
  `;
}

export async function listTicketComments(userId: string, ticketId: string): Promise<TicketComment[]> {
  await requireAdmin(userId);
  const sql = await getSql();
  const rows = await sql<{
    id: string; ticket_id: string; body: string; author_user_id: string | null;
    created_at: unknown; author_name: string | null;
  }>`
    select c.*, u.name as author_name
    from support_ticket_comments c
    left join "user" u on u.id = c.author_user_id
    where c.ticket_id = ${ticketId}
    order by c.created_at asc
  `;
  return rows.map((c) => ({
    id: c.id,
    ticketId: c.ticket_id,
    body: c.body,
    authorUserId: c.author_user_id,
    authorName: c.author_name,
    createdAt: iso(c.created_at),
  }));
}

export async function addTicketComment(userId: string, ticketId: string, body: string): Promise<void> {
  await requireAdmin(userId);
  const text = body.trim();
  if (!text) throw new Error("Comment is required");
  const sql = await getSql();
  await sql`
    insert into support_ticket_comments (id, ticket_id, body, author_user_id)
    values (${newId("tcm")}, ${ticketId}, ${text}, ${userId})
  `;
  await sql`update support_tickets set updated_at = now() where id = ${ticketId}`;
}

export async function listInvoices(userId: string): Promise<SaasInvoice[]> {
  await requireAdmin(userId);
  const sql = await getSql();
  const rows = await sql<{
    id: string; org_id: string; amount_cents: number; status: string;
    due_at: unknown; paid_at: unknown; stripe_invoice_id: string | null;
    note: string | null; created_at: unknown; org_name: string;
  }>`
    select i.*, o.name as org_name
    from saas_invoices i
    join organizations o on o.id = i.org_id
    where coalesce(o.is_demo, false) = false
    order by i.created_at desc
    limit 100
  `;
  return rows.map((i) => ({
    id: i.id,
    orgId: i.org_id,
    orgName: i.org_name,
    amountCents: Number(i.amount_cents) || 0,
    status: (INVOICE_STATUSES as readonly string[]).includes(i.status)
      ? (i.status as InvoiceStatus)
      : "open",
    dueAt: isoOrNull(i.due_at),
    paidAt: isoOrNull(i.paid_at),
    stripeInvoiceId: i.stripe_invoice_id,
    note: i.note,
    createdAt: iso(i.created_at),
  }));
}

export async function issueInvoice(
  userId: string,
  input: { orgId: string; amountCents: number; note?: string },
): Promise<void> {
  await requireAdmin(userId);
  if (input.amountCents <= 0) throw new Error("Amount required");
  const sql = await getSql();
  const org = await sql<{ id: string }>`
    select id from organizations where id = ${input.orgId} and coalesce(is_demo, false) = false
  `;
  if (!org[0]) throw new Error("Tenant not found");
  await sql`
    insert into saas_invoices (id, org_id, amount_cents, status, due_at, note)
    values (
      ${newId("inv")}, ${input.orgId}, ${input.amountCents}, ${"open"},
      ${new Date(Date.now() + 14 * 86400000).toISOString()}, ${input.note ?? "Software subscription"}
    )
  `;
}

export async function setInvoiceStatus(
  userId: string,
  invoiceId: string,
  status: InvoiceStatus,
): Promise<void> {
  await requireAdmin(userId);
  if (!INVOICE_STATUSES.includes(status)) throw new Error("Unknown invoice status");
  const sql = await getSql();
  await sql`
    update saas_invoices
    set status = ${status},
        paid_at = case when ${status} = 'paid' then now() else paid_at end
    where id = ${invoiceId}
  `;
}

export async function saasReport(userId: string): Promise<SaasReportSnapshot> {
  await requireAdmin(userId);
  await syncAllProspectsToCrm();
  const sql = await getSql();
  const funnel = await sql<{ stage: string; count: number }>`
    select stage, count(*)::int as count from crm_accounts group by stage
  `;
  const pipeline = await sql<{ stage: string; amount_cents: number }>`
    select stage, coalesce(sum(amount_cents),0)::int as amount_cents
    from crm_opportunities group by stage
  `;
  const counts = await sql<{
    new_accts: number; live_locs: number; live_orgs: number; churned: number;
    open_tix: number; past_due: number; failed_inv: number;
  }>`
    select
      (select count(*)::int from crm_accounts where created_at > ${new Date(Date.now() - 30 * 86400000).toISOString()}::timestamptz) as new_accts,
      (select count(*)::int from locations l
        join organizations o on o.id = l.org_id
        where coalesce(l.is_demo,false)=false and coalesce(o.is_demo,false)=false
          and o.status = 'active') as live_locs,
      (select count(*)::int from organizations
        where coalesce(is_demo,false)=false and status = 'active') as live_orgs,
      (select count(*)::int from crm_accounts where stage = 'churned') as churned,
      (select count(*)::int from support_tickets where status in ('open','pending')) as open_tix,
      (select count(*)::int from org_subscriptions s
        join organizations o on o.id = s.org_id
        where s.status = 'past_due' and coalesce(o.is_demo,false)=false) as past_due,
      (select count(*)::int from saas_invoices where status = 'failed') as failed_inv
  `;
  const c = counts[0];
  return {
    funnel: ACCOUNT_STAGES.map((stage) => ({
      stage,
      count: funnel.find((f) => f.stage === stage)?.count ?? 0,
    })),
    pipelineValueByStage: ACCOUNT_STAGES.map((stage) => ({
      stage,
      amountCents: pipeline.find((p) => p.stage === stage)?.amount_cents ?? 0,
    })),
    newAccounts30d: Number(c?.new_accts) || 0,
    liveLocations: Number(c?.live_locs) || 0,
    liveOrgs: Number(c?.live_orgs) || 0,
    churnedAccounts: Number(c?.churned) || 0,
    openTickets: Number(c?.open_tix) || 0,
    pastDueOrgs: Number(c?.past_due) || 0,
    failedInvoices: Number(c?.failed_inv) || 0,
  };
}

export async function listPlans(userId: string) {
  await requireAdmin(userId);
  const sql = await getSql();
  return sql<{ id: string; slug: string; name: string; max_locations: number; max_seats: number }>`
    select id, slug, name, max_locations, max_seats from plans order by name
  `;
}


