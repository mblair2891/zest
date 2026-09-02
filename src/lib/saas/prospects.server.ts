import { getSql } from "@/lib/db";
import { inviteToken, newId } from "./ids";
import {
  parseIntakeAnswers,
  parsePricingRules,
  retotalQuote,
  emptyIntakeAnswers,
} from "./pricing";
import { buildIntakeQuote, quoteDraftInputSchema } from "./quote-builder";
import { quoteHasSoftwarePackage, quoteIsSetupOnly } from "./pricing";
import { payloadFromAnswers } from "./onboarding-defaults";
import { parseMessages, parseRecommendation } from "./interview";
import type { InterviewSource, InterviewStatus } from "./prospect-types";
import type {
  IntakeAnswers,
  OnboardingPayload,
  OnboardingRunRecord,
  OnboardingStepId,
  OnboardingStepState,
  OperatorRecord,
  PricingRules,
  ProspectDetail,
  ProspectListItem,
  ProspectRecord,
  ProspectStatus,
  QuoteLineItem,
  QuoteSnapshot,
  StationType,
} from "./prospect-types";
import { ONBOARDING_STEP_IDS, PROSPECT_STATUSES } from "./prospect-types";
import {
  parseNetworkChecklist,
  parseNetworkReadyStatus,
} from "./network-readiness";
import {
  ForbiddenError,
  isPlatformAdmin,
  loadUser,
  writeAudit,
} from "./tenancy.server";
import type { PlanSlug } from "./types";
import {
  canTransition,
  gateBlockReason,
  quoteIsSent,
  OVERRIDE_PHRASE,
} from "./pipeline-gates";
export { canTransition } from "./pipeline-gates";

type ProspectRow = {
  id: string;
  status: string;
  owner_user_id: string | null;
  email: string | null;
  answers: unknown;
  quote: unknown;
  quote_issued_at: unknown;
  accepted_at: unknown;
  contracted_at: unknown;
  contract_signed_by: string | null;
  org_id: string | null;
  public_token: string;
  created_at: unknown;
  updated_at: unknown;
  interview_free_text?: string | null;
  interview_messages?: unknown;
  interview_recommendation?: unknown;
  interview_source?: string | null;
  interview_status?: string | null;
};

type RunRow = {
  id: string;
  prospect_id: string;
  org_id: string | null;
  status: string;
  steps: unknown;
  payload: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type OperatorRow = {
  id: string;
  org_id: string;
  location_id: string | null;
  legal_name: string;
  dba: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  station_types: unknown;
  payout_bank_last4: string | null;
  payout_routing_token: string | null;
};

function asIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

function asIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  return asIso(v);
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

function parseQuote(raw: unknown): QuoteSnapshot | null {
  if (raw == null) return null;
  const v = parseJson<QuoteSnapshot | null>(raw, null);
  if (!v || typeof v !== "object") return null;
  if (!Array.isArray(v.lineItems)) return null;
  return v;
}

function parseSteps(raw: unknown): OnboardingRunRecord["steps"] {
  const o = parseJson<Record<string, OnboardingStepState>>(raw, {});
  const out: OnboardingRunRecord["steps"] = {};
  for (const id of ONBOARDING_STEP_IDS) {
    const s = o[id];
    if (s && typeof s === "object") out[id] = { done: Boolean(s.done), completedAt: s.completedAt };
  }
  return out;
}

export function parseOnboardingPayload(raw: unknown): OnboardingPayload {
  const o = parseJson<Record<string, unknown>>(raw, {});
  const orgIn = (o.org && typeof o.org === "object" ? o.org : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown, d = 0) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const locationsRaw = Array.isArray(o.locations) ? o.locations : [];
  const invitesRaw = Array.isArray(o.invites) ? o.invites : [];
  const settlementIn =
    o.settlement && typeof o.settlement === "object"
      ? (o.settlement as Record<string, unknown>)
      : {};
  const checkIn =
    o.checklist && typeof o.checklist === "object" ? (o.checklist as Record<string, unknown>) : {};
  const period = str(settlementIn.periodType) || "weekly";
  return {
    org: {
      legalName: str(orgIn.legalName),
      dba: str(orgIn.dba),
      billingEmail: str(orgIn.billingEmail).trim().toLowerCase(),
      phone: str(orgIn.phone),
      hqAddress: str(orgIn.hqAddress),
      taxId: str(orgIn.taxId),
      ownerContactName: str(orgIn.ownerContactName),
      billingContactName: str(orgIn.billingContactName),
      opsContactName: str(orgIn.opsContactName),
      opsContactEmail: str(orgIn.opsContactEmail).trim().toLowerCase(),
      currency: str(orgIn.currency) || "USD",
    },
    locations: locationsRaw.map((loc, i) => {
      const l = loc && typeof loc === "object" ? (loc as Record<string, unknown>) : {};
      const ops = Array.isArray(l.operators) ? l.operators : [];
      const devices =
        l.devices && typeof l.devices === "object" ? (l.devices as Record<string, unknown>) : {};
      const model = str(l.operatingModel);
      const menu = str(l.menuMode);
      return {
        clientId: str(l.clientId) || `loc_${i}`,
        serverId: str(l.serverId) || undefined,
        name: str(l.name),
        address: str(l.address),
        timezone: str(l.timezone) || "America/Los_Angeles",
        venueType: (str(l.venueType) || "restaurant") as OnboardingPayload["locations"][0]["venueType"],
        hostBrandName: str(l.hostBrandName),
        operatingModel: model === "host_operators" ? "host_operators" : "single",
        operators: ops.map((op) => {
          const p = op && typeof op === "object" ? (op as Record<string, unknown>) : {};
          const stations = Array.isArray(p.stationTypes)
            ? (p.stationTypes.filter((x) => x === "bar" || x === "kitchen" || x === "both") as StationType[])
            : (["both"] as StationType[]);
          return {
            legalName: str(p.legalName),
            dba: str(p.dba),
            contactEmail: str(p.contactEmail),
            contactPhone: str(p.contactPhone),
            stationTypes: stations.length ? stations : (["both"] as StationType[]),
            payoutBankLast4: str(p.payoutBankLast4).replace(/\D/g, "").slice(-4),
            payoutRoutingToken: str(p.payoutRoutingToken),
          };
        }),
        tableCount: Math.max(0, Math.floor(num(l.tableCount, 0))),
        sectionNames: str(l.sectionNames),
        floorLater: Boolean(l.floorLater),
        menuMode: menu === "categories" || menu === "csv_later" || menu === "empty" ? menu : "empty",
        devices: {
          pos: Math.max(0, Math.floor(num(devices.pos, 0))),
          kds: Math.max(0, Math.floor(num(devices.kds, 0))),
          handhelds: Math.max(0, Math.floor(num(devices.handhelds, 0))),
        },
        networkReadyStatus: parseNetworkReadyStatus(l.networkReadyStatus),
        networkCheckedAt: str(l.networkCheckedAt) || undefined,
        networkNotes: str(l.networkNotes),
        networkChecklist: parseNetworkChecklist(l.networkChecklist),
      };
    }),
    invites: invitesRaw
      .map((inv) => {
        const x = inv && typeof inv === "object" ? (inv as Record<string, unknown>) : {};
        const role = str(x.role) || "staff";
        const allowed = ["owner", "manager", "cashier", "staff", "vendor"] as const;
        return {
          email: str(x.email).trim().toLowerCase(),
          role: (allowed.includes(role as (typeof allowed)[number])
            ? role
            : "staff") as OnboardingPayload["invites"][0]["role"],
        };
      })
      .filter((i) => i.email.includes("@")),
    settlement: {
      periodType:
        period === "daily" || period === "biweekly" || period === "monthly" || period === "weekly"
          ? period
          : "weekly",
      hostCutPercent: Math.min(100, Math.max(0, num(settlementIn.hostCutPercent, 0))),
    },
    checklist: {
      trainingAck: Boolean(checkIn.trainingAck),
      hardwareAck: Boolean(checkIn.hardwareAck),
      paymentsAck: Boolean(checkIn.paymentsAck),
    },
    partnerHardware: parsePartnerHardware(o.partnerHardware, {
      name: str(orgIn.legalName) || str(orgIn.dba),
      address: str(orgIn.hqAddress),
      phone: str(orgIn.phone),
    }),
  };
}

function parsePartnerHardware(
  raw: unknown,
  fallback: { name: string; address: string; phone: string },
): OnboardingPayload["partnerHardware"] {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  return {
    shipToName: str(o.shipToName) || fallback.name,
    shipToAddress: str(o.shipToAddress) || fallback.address,
    shipToPhone: str(o.shipToPhone) || fallback.phone,
    note:
      str(o.note) ||
      "Partner hardware ships from the payments partner to this address. Summex does not take possession.",
    items: itemsRaw.map((it) => {
      const x = it && typeof it === "object" ? (it as Record<string, unknown>) : {};
      const status = String(x.status ?? "requested");
      return {
        skuId: str(x.skuId).slice(0, 40),
        name: str(x.name).slice(0, 80) || str(x.skuId),
        qty: Math.max(0, Math.floor(Number(x.qty) || 0)),
        status:
          status === "shipped" || status === "delivered" ? status : ("requested" as const),
      };
    }),
  };
}

function mapOperator(r: OperatorRow): OperatorRecord {
  const stations = parseJson<unknown[]>(r.station_types, []);
  return {
    id: r.id,
    orgId: r.org_id,
    locationId: r.location_id,
    legalName: r.legal_name,
    dba: r.dba,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    stationTypes: stations.filter(
      (x): x is StationType => x === "bar" || x === "kitchen" || x === "both",
    ),
    payoutBankLast4: r.payout_bank_last4,
    payoutRoutingToken: r.payout_routing_token,
  };
}

function mapProspect(r: ProspectRow): ProspectRecord {
  return {
    id: r.id,
    status: (PROSPECT_STATUSES as readonly string[]).includes(r.status)
      ? (r.status as ProspectStatus)
      : "prospect",
    ownerUserId: r.owner_user_id,
    email: r.email,
    answers: parseIntakeAnswers(r.answers),
    quote: parseQuote(r.quote),
    quoteIssuedAt: asIsoOrNull(r.quote_issued_at),
    acceptedAt: asIsoOrNull(r.accepted_at),
    contractedAt: asIsoOrNull(r.contracted_at),
    contractSignedBy: r.contract_signed_by,
    orgId: r.org_id,
    publicToken: r.public_token,
    createdAt: asIso(r.created_at),
    updatedAt: asIso(r.updated_at),
    interviewFreeText: r.interview_free_text ?? "",
    interviewMessages: parseMessages(r.interview_messages),
    interviewRecommendation: parseRecommendation(r.interview_recommendation),
    interviewSource:
      r.interview_source === "ai" || r.interview_source === "heuristic"
        ? (r.interview_source as InterviewSource)
        : null,
    interviewStatus: ((): InterviewStatus => {
      const s = r.interview_status;
      if (s === "in_progress" || s === "accepted" || s === "skipped") return s;
      return "none";
    })(),
  };
}

function mapRun(r: RunRow): OnboardingRunRecord {
  return {
    id: r.id,
    prospectId: r.prospect_id,
    orgId: r.org_id,
    status: r.status === "complete" ? "complete" : "in_progress",
    steps: parseSteps(r.steps),
    payload: parseOnboardingPayload(r.payload),
    createdAt: asIso(r.created_at),
    updatedAt: asIso(r.updated_at),
  };
}



async function getRow(id: string): Promise<ProspectRow | null> {
  const sql = await getSql();
  const rows = await sql<ProspectRow>`select * from prospects where id = ${id} limit 1`;
  return rows[0] ?? null;
}

async function getRowByToken(token: string): Promise<ProspectRow | null> {
  const sql = await getSql();
  const rows = await sql<ProspectRow>`
    select * from prospects where public_token = ${token} limit 1
  `;
  return rows[0] ?? null;
}

export async function loadPricingRules(): Promise<{
  version: number;
  rules: PricingRules;
}> {
  try {
    const { pricingRulesFromStore } = await import("./platform-settings.server");
    return await pricingRulesFromStore();
  } catch {
    const sql = await getSql();
    const rows = await sql<{ version: number; rules: unknown }>`
      select version, rules from pricing_rules where id = 'default' limit 1
    `;
    if (!rows[0]) return { version: 1, rules: parsePricingRules(null) };
    return { version: Number(rows[0].version) || 1, rules: parsePricingRules(rows[0].rules) };
  }
}

export async function savePricingRules(
  userId: string,
  rulesRaw: unknown,
): Promise<{ version: number; rules: PricingRules }> {
  if (!(await isPlatformAdmin(userId))) throw new ForbiddenError();
  const rules = parsePricingRules(rulesRaw);
  const sql = await getSql();
  const existing = await sql<{ version: number }>`
    select version from pricing_rules where id = 'default' limit 1
  `;
  const version = (existing[0]?.version ?? 0) + 1;
  if (existing[0]) {
    await sql`
      update pricing_rules
      set version = ${version}, rules = ${JSON.stringify(rules)}::jsonb,
          updated_at = now(), updated_by = ${userId}
      where id = 'default'
    `;
  } else {
    await sql`
      insert into pricing_rules (id, version, rules, updated_by)
      values ('default', ${version}, ${JSON.stringify(rules)}::jsonb, ${userId})
    `;
  }
  await writeAudit({
    actorUserId: userId,
    action: "pricing_rules_updated",
    payload: { version },
  });
  return { version, rules };
}

export async function createProspect(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<ProspectRecord> {
  const sql = await getSql();
  const id = newId("prsp");
  const token = inviteToken();
  const answers = emptyIntakeAnswers();
  if (opts.email) answers.company.billingEmail = opts.email;
  const user = opts.userId ? await loadUser(opts.userId) : null;
  if (user?.email && !answers.company.billingEmail) {
    answers.company.billingEmail = user.email;
  }
  const email = answers.company.billingEmail || opts.email || user?.email || null;
  await sql`
    insert into prospects (id, status, owner_user_id, email, answers, public_token)
    values (
      ${id}, 'prospect', ${opts.userId ?? null}, ${email},
      ${JSON.stringify(answers)}::jsonb, ${token}
    )
  `;
  await writeAudit({
    actorUserId: opts.userId ?? null,
    action: "prospect_created",
    payload: { prospectId: id },
  });
  const row = await getRow(id);
  const created = mapProspect(row!);
  await syncCrm(created);
  return created;
}

export async function getProspectByToken(token: string): Promise<ProspectRecord | null> {
  const row = await getRowByToken(token.trim());
  return row ? mapProspect(row) : null;
}

export async function getProspectById(id: string): Promise<ProspectRecord | null> {
  const row = await getRow(id);
  return row ? mapProspect(row) : null;
}

async function syncCrm(prospect: ProspectRecord) {
  try {
    const { ensureCrmFromProspect } = await import("./crm.server");
    await ensureCrmFromProspect(prospect);
  } catch {
    /* CRM tables may not exist yet during migrate */
  }
}

export async function assertCanAccessProspect(opts: {
  userId: string | null;
  prospect: ProspectRecord;
  token?: string | null;
  write?: boolean;
}): Promise<{ admin: boolean }> {
  const admin = opts.userId ? await isPlatformAdmin(opts.userId) : false;
  if (admin) return { admin: true };
  if (opts.token && opts.token === opts.prospect.publicToken) return { admin: false };
  if (opts.userId && opts.prospect.ownerUserId === opts.userId) return { admin: false };
  if (opts.userId && opts.prospect.email) {
    const user = await loadUser(opts.userId);
    if (user?.email && user.email.toLowerCase() === opts.prospect.email.toLowerCase()) {
      return { admin: false };
    }
  }
  throw new ForbiddenError();
}

export async function claimProspect(
  userId: string,
  token: string,
): Promise<ProspectRecord> {
  const row = await getRowByToken(token.trim());
  if (!row) throw new Error("Prospect not found");
  const user = await loadUser(userId);
  const sql = await getSql();
  if (row.owner_user_id && row.owner_user_id !== userId) {
    const admin = await isPlatformAdmin(userId);
    if (!admin) throw new ForbiddenError("This quote belongs to another account");
  }
  const email = user?.email?.toLowerCase() ?? row.email;
  await sql`
    update prospects
    set owner_user_id = ${userId},
        email = coalesce(${email}, email),
        updated_at = now()
    where id = ${row.id}
  `;
  const next = await getRow(row.id);
  return mapProspect(next!);
}

export async function listMyProspects(userId: string): Promise<ProspectListItem[]> {
  const user = await loadUser(userId);
  const sql = await getSql();
  const email = user?.email?.toLowerCase() ?? null;
  const rows = await sql<
    ProspectRow & { org_name: string | null }
  >`
    select p.*, o.name as org_name
    from prospects p
    left join organizations o on o.id = p.org_id
    where p.owner_user_id = ${userId}
       or (${email}::text is not null and lower(p.email) = ${email})
    order by p.updated_at desc
  `;
  return rows.map(toListItem);
}

/** Demote houses that skipped a sent quote (e.g. Force into Onboarding). */
export async function repairOrphanPipelineStages(): Promise<number> {
  const sql = await getSql();
  const rows = await sql<ProspectRow>`
    select * from prospects
    where status in ('accepted','contracted','onboarding','live')
  `;
  let n = 0;
  for (const row of rows) {
    const p = mapProspect(row);
    let next: ProspectStatus | null = null;
    if (p.status === "live" && p.orgId) continue;
    if (!quoteIsSent(p.quote)) next = "prospect";
    else if (!p.acceptedAt && (p.status === "contracted" || p.status === "onboarding")) {
      next = "quoted";
    } else if (!p.contractedAt && p.status === "onboarding") {
      next = "accepted";
    }
    if (!next || next === p.status) continue;
    await sql`
      update prospects set status = ${next}, updated_at = now() where id = ${p.id}
    `;
    await writeAudit({
      actorUserId: null,
      orgId: p.orgId,
      action: "status_changed",
      payload: {
        prospectId: p.id,
        from: p.status,
        to: next,
        note: "auto-repaired: pipeline missing sent quote or contract",
        forced: false,
      },
    });
    n += 1;
  }
  return n;
}

export async function listAllProspects(userId: string): Promise<ProspectListItem[]> {
  if (!(await isPlatformAdmin(userId))) throw new ForbiddenError();
  await repairOrphanPipelineStages().catch(() => 0);
  const sql = await getSql();
  const rows = await sql<ProspectRow & { org_name: string | null }>`
    select p.*, o.name as org_name
    from prospects p
    left join organizations o on o.id = p.org_id
    order by
      case p.status
        when 'prospect' then 0
        when 'quoted' then 1
        when 'accepted' then 2
        when 'contracted' then 3
        when 'onboarding' then 4
        when 'live' then 5
        else 6
      end,
      p.updated_at desc
  `;
  return rows.map(toListItem);
}

function toListItem(r: ProspectRow & { org_name?: string | null }): ProspectListItem {
  const p = mapProspect(r);
  return {
    id: p.id,
    status: p.status,
    email: p.email,
    legalName: p.answers.company.legalName || "Untitled company",
    dba: p.answers.company.dba,
    orgId: p.orgId,
    orgName: r.org_name ?? null,
    monthlyCents: p.quote?.monthlyCents ?? null,
    publicToken: p.publicToken,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    locationCount: p.quote?.locationCount ?? p.answers.portfolio.locationsNow ?? 0,
    operatingModel: p.answers.operating.model,
    quoteSent: quoteIsSent(p.quote),
  };
}

export async function saveProspectAnswers(opts: {
  userId: string | null;
  token: string;
  answers: unknown;
}): Promise<ProspectRecord> {
  const row = await getRowByToken(opts.token.trim());
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  await assertCanAccessProspect({
    userId: opts.userId,
    prospect,
    token: opts.token,
    write: true,
  });
  if (["live", "churned", "rejected", "onboarding", "contracted"].includes(prospect.status)) {
    const admin = opts.userId ? await isPlatformAdmin(opts.userId) : false;
    if (!admin) throw new ForbiddenError("Intake is locked after contract");
  }
  const answers = parseIntakeAnswers(opts.answers);
  const email = answers.company.billingEmail || prospect.email;
  const sql = await getSql();
  let owner = prospect.ownerUserId;
  if (!owner && opts.userId) owner = opts.userId;
  await sql`
    update prospects
    set answers = ${JSON.stringify(answers)}::jsonb,
        email = ${email},
        owner_user_id = ${owner},
        updated_at = now()
    where id = ${prospect.id}
  `;
  const next = await getRow(prospect.id);
  return mapProspect(next!);
}

async function suggestedQuote(prospect: ProspectRecord) {
  const { loadBillingSettings } = await import("./platform-settings.server");
  const { version, rules } = await loadPricingRules();
  const billing = await loadBillingSettings();
  return buildIntakeQuote({
    answers: prospect.answers,
    rules,
    interview: prospect.interviewRecommendation,
    trialDays: billing.trialDays,
    rulesVersion: version,
    expireDays: billing.quoteExpireDays ?? rules.quoteExpireDays,
    draft: true,
  });
}

export async function submitQuoteRequest(opts: {
  userId: string | null;
  token: string;
}): Promise<ProspectRecord> {
  const row = await getRowByToken(opts.token.trim());
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  await assertCanAccessProspect({ userId: opts.userId, prospect, token: opts.token, write: true });
  if (!prospect.answers.payments.quantumPaymentsAck && !prospect.answers.payments.zestPaymentsAck) {
    throw new Error("Acknowledge Quantum Payments as the only guest card processor to continue");
  }
  if (!prospect.answers.company.legalName.trim() || !prospect.answers.company.billingEmail.includes("@")) {
    throw new Error("Company legal name and billing email are required");
  }
  const firstRequest = prospect.status === "prospect" && !prospect.quote;
  const quote = prospect.quote ?? (await suggestedQuote(prospect));
  const sql = await getSql();
  await sql`
    update prospects
    set quote = ${JSON.stringify({ ...quote, draft: true, sentAt: null })}::jsonb,
        updated_at = now()
    where id = ${prospect.id}
  `;
  await writeAudit({
    actorUserId: opts.userId,
    action: "quote_requested",
    payload: { prospectId: prospect.id },
    orgId: prospect.orgId,
  });
  const next = mapProspect((await getRow(prospect.id))!);
  await syncCrm(next);
  if (firstRequest) {
    try {
      const mail = await import("./quote-emails.server");
      await mail.emailQuoteRequestReceived(next);
      await mail.emailNewQuoteRequestInternal(next);
    } catch (err) {
      console.warn("[quote-request-email]", err);
    }
  }
  return next;
}

/** @deprecated Intake uses submitQuoteRequest. Kept as a draft rebuild for admins. */
export async function issueQuote(opts: {
  userId: string | null;
  token: string;
}): Promise<ProspectRecord> {
  return submitQuoteRequest(opts);
}

export async function saveQuoteDraft(opts: {
  userId: string;
  prospectId: string;
  input: unknown;
}): Promise<ProspectRecord> {
  if (!(await isPlatformAdmin(opts.userId))) throw new ForbiddenError();
  const row = await getRow(opts.prospectId);
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  if (["live", "churned", "rejected"].includes(prospect.status)) {
    throw new Error("Quote is frozen");
  }
  const parsed = quoteDraftInputSchema.parse(opts.input);
  const { loadPlanRows, loadBillingSettings } = await import("./platform-settings.server");
  const { version, rules } = await loadPricingRules();
  const plans = await loadPlanRows();
  const billing = await loadBillingSettings();
  const plan = plans.find((p) => p.slug === parsed.planSlug);
  if (!plan) throw new Error("Unknown plan");
  if (!plan.active && prospect.quote?.planSlug !== plan.slug) {
    throw new Error("That plan is not active");
  }
  const quote = buildIntakeQuote({
    answers: prospect.answers,
    rules,
    interview: prospect.interviewRecommendation,
    planSlug: parsed.planSlug,
    locationCount: parsed.locationCount,
    setupFeeCents: parsed.setupFeeCents,
    addOns: parsed.addOns,
    terminalQty: parsed.terminalQty,
    trialDays: billing.trialDays,
    rulesVersion: version,
    expireDays: billing.quoteExpireDays ?? rules.quoteExpireDays,
    draft: prospect.status !== "quoted",
    sentAt: prospect.status === "quoted" ? prospect.quote?.sentAt ?? new Date().toISOString() : null,
  });
  if (quoteIsSetupOnly(quote) || !quoteHasSoftwarePackage(quote)) {
    throw new Error("Quote must include a monthly software package from intake — setup fee cannot be the only line.");
  }
  const sql = await getSql();
  await sql`
    update prospects
    set quote = ${JSON.stringify(quote)}::jsonb, updated_at = now()
    where id = ${prospect.id}
  `;
  await writeAudit({
    actorUserId: opts.userId,
    action: "quote_draft_saved",
    payload: { prospectId: prospect.id, monthlyCents: quote.monthlyCents, plan: quote.planSlug },
    orgId: prospect.orgId,
  });
  const next = mapProspect((await getRow(prospect.id))!);
  await syncCrm(next);
  return next;
}

export async function sendQuote(opts: {
  userId: string;
  prospectId: string;
}): Promise<ProspectRecord> {
  if (!(await isPlatformAdmin(opts.userId))) throw new ForbiddenError();
  const row = await getRow(opts.prospectId);
  if (!row) throw new Error("Prospect not found");
  let prospect = mapProspect(row);
  if (["live", "churned", "rejected", "contracted", "onboarding"].includes(prospect.status)) {
    throw new Error("Quote cannot be sent from this status");
  }
  if (!prospect.quote) throw new Error("Save a draft quote first (monthly package from intake)");
  const locN = Number(prospect.quote.locationCount ?? prospect.quote.maxLocations ?? 0);
  if (!prospect.quote.planSlug || locN < 1) {
    throw new Error("Quote needs a package and at least one location before send");
  }
  if (quoteIsSetupOnly(prospect.quote) || !quoteHasSoftwarePackage(prospect.quote)) {
    throw new Error("Cannot send a setup-only quote. Rebuild from intake so monthly software is on the proposal.");
  }
  const now = new Date().toISOString();
  const quote = { ...prospect.quote, draft: false, sentAt: now, generatedAt: now };
  const sql = await getSql();
  await sql`
    update prospects
    set quote = ${JSON.stringify(quote)}::jsonb,
        quote_issued_at = now(),
        accepted_at = null,
        status = ${"quoted"},
        updated_at = now()
    where id = ${prospect.id}
  `;
  await writeAudit({
    actorUserId: opts.userId,
    action: "quote_sent",
    payload: { prospectId: prospect.id, monthlyCents: quote.monthlyCents, plan: quote.planSlug },
    orgId: prospect.orgId,
  });
  const next = mapProspect((await getRow(prospect.id))!);
  await syncCrm(next);
  try {
    const mail = await import("./quote-emails.server");
    await mail.emailQuoteSent(next, quote);
  } catch (err) {
    console.warn("[quote-sent-email]", err);
  }
  return next;
}

export async function requestQuoteChanges(opts: {
  userId: string | null;
  token: string;
  message: string;
}): Promise<ProspectRecord> {
  const row = await getRowByToken(opts.token.trim());
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  await assertCanAccessProspect({ userId: opts.userId, prospect, token: opts.token, write: true });
  if (prospect.status !== "quoted") throw new Error("Request changes after the proposal is sent");
  const message = opts.message.trim().slice(0, 2000);
  if (message.length < 4) throw new Error("Say what you need changed");
  const quote = {
    ...prospect.quote!,
    changeRequest: { at: new Date().toISOString(), message },
  };
  const sql = await getSql();
  await sql`
    update prospects
    set quote = ${JSON.stringify(quote)}::jsonb, updated_at = now()
    where id = ${prospect.id}
  `;
  await writeAudit({
    actorUserId: opts.userId,
    action: "quote_changes_requested",
    payload: { prospectId: prospect.id, message: message.slice(0, 240) },
    orgId: prospect.orgId,
  });
  const next = mapProspect((await getRow(prospect.id))!);
  await syncCrm(next);
  try {
    const mail = await import("./quote-emails.server");
    await mail.emailQuoteChangesRequested(next, message);
  } catch (err) {
    console.warn("[quote-changes-email]", err);
  }
  return next;
}

export async function listQuoteCatalog(userId: string) {
  if (!(await isPlatformAdmin(userId))) throw new ForbiddenError();
  const { loadPlanRows, loadBillingSettings } = await import("./platform-settings.server");
  const [plans, billing] = await Promise.all([loadPlanRows(), loadBillingSettings()]);
  return {
    plans: plans.filter((p) => p.active),
    trialDays: billing.trialDays,
  };
}

export async function acceptQuote(opts: {
  userId: string | null;
  token: string;
}): Promise<ProspectRecord> {
  const row = await getRowByToken(opts.token.trim());
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  await assertCanAccessProspect({ userId: opts.userId, prospect, token: opts.token, write: true });
  if (prospect.status !== "quoted") {
    throw new Error("This proposal has not been sent yet");
  }
  if (!prospect.quote || prospect.quote.draft) throw new Error("No sent quote on file");
  if (quoteIsSetupOnly(prospect.quote) || !quoteHasSoftwarePackage(prospect.quote)) {
    throw new Error("This proposal is setup-only. Ask Summex to rebuild a monthly package from intake.");
  }
  if (opts.userId) await claimProspect(opts.userId, opts.token);
  const owner = opts.userId ?? prospect.ownerUserId;
  const sql = await getSql();
  await sql`
    update prospects
    set status = 'accepted', accepted_at = now(), owner_user_id = ${owner}, updated_at = now()
    where id = ${prospect.id}
  `;
  await writeAudit({
    actorUserId: opts.userId,
    action: "quote_accepted",
    payload: { prospectId: prospect.id },
    orgId: prospect.orgId,
  });
  const next = mapProspect((await getRow(prospect.id))!);
  await syncCrm(next);
  try {
    const mail = await import("./quote-emails.server");
    await mail.emailQuoteAccepted(next);
  } catch (err) {
    console.warn("[quote-accepted-email]", err);
  }
  return next;
}

export async function adminMarkQuoteAccepted(opts: {
  userId: string;
  prospectId: string;
}): Promise<ProspectRecord> {
  if (!(await isPlatformAdmin(opts.userId))) throw new ForbiddenError();
  const row = await getRow(opts.prospectId);
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  if (prospect.status !== "quoted") throw new Error("Send the quote before marking it accepted");
  return acceptQuote({ userId: opts.userId, token: prospect.publicToken });
}

export async function markContractSigned(opts: {
  userId: string;
  prospectId: string;
  signedOn?: string;
}): Promise<ProspectRecord> {
  if (!(await isPlatformAdmin(opts.userId))) throw new ForbiddenError();
  const row = await getRow(opts.prospectId);
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  if (prospect.status !== "accepted") {
    throw new Error("Accept the quote before recording the contract");
  }
  const when = opts.signedOn && /^\d{4}-\d{2}-\d{2}/.test(opts.signedOn)
    ? new Date(opts.signedOn).toISOString()
    : new Date().toISOString();
  const sql = await getSql();
  await sql`
    update prospects
    set status = 'contracted',
        contracted_at = ${when},
        contract_signed_by = ${opts.userId},
        updated_at = now()
    where id = ${prospect.id}
  `;
  await writeAudit({
    actorUserId: opts.userId,
    action: "contract_signed",
    payload: { prospectId: prospect.id, signedOn: when },
    orgId: prospect.orgId,
  });
  const next = await getRow(prospect.id);
  const mapped = mapProspect(next!);
  await syncCrm(mapped);
  return mapped;
}

export async function startOnboardingProspect(opts: {
  userId: string;
  prospectId: string;
}): Promise<ProspectRecord> {
  if (!(await isPlatformAdmin(opts.userId))) throw new ForbiddenError();
  const row = await getRow(opts.prospectId);
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  const blocked = gateBlockReason(
    {
      status: prospect.status,
      quote: prospect.quote,
      acceptedAt: prospect.acceptedAt,
      contractedAt: prospect.contractedAt,
    },
    "onboarding",
  );
  if (blocked) throw new Error(blocked);
  await ensureOnboardingRun(prospect.id);
  const sql = await getSql();
  await sql`
    update prospects set status = 'onboarding', updated_at = now()
    where id = ${prospect.id} and status = 'contracted'
  `;
  await writeAudit({
    actorUserId: opts.userId,
    action: "status_changed",
    payload: { prospectId: prospect.id, from: "contracted", to: "onboarding" },
    orgId: prospect.orgId,
  });
  const next = await getRow(prospect.id);
  const mapped = mapProspect(next!);
  await syncCrm(mapped);
  return mapped;
}

export async function adminSetProspectStatus(opts: {
  userId: string;
  prospectId: string;
  status: ProspectStatus;
  note?: string;
  overridePhrase?: string;
  reason?: string;
}): Promise<ProspectRecord> {
  if (!(await isPlatformAdmin(opts.userId))) throw new ForbiddenError();
  if (!(PROSPECT_STATUSES as readonly string[]).includes(opts.status)) {
    throw new Error("Unknown status");
  }
  const row = await getRow(opts.prospectId);
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  const blocked = gateBlockReason(
    {
      status: prospect.status,
      quote: prospect.quote,
      acceptedAt: prospect.acceptedAt,
      contractedAt: prospect.contractedAt,
    },
    opts.status,
  );
  const skipping = blocked || !canTransition(prospect.status, opts.status);
  if (skipping && prospect.status !== opts.status) {
    const phrase = (opts.overridePhrase ?? "").trim().toUpperCase();
    const reason = (opts.reason ?? opts.note ?? "").trim();
    if (phrase !== OVERRIDE_PHRASE || reason.length < 8) {
      throw new Error(
        `${blocked || `Cannot move ${prospect.status} → ${opts.status}`}. Force requires typing OVERRIDE and a reason.`,
      );
    }
  }
  const sql = await getSql();
  await sql`
    update prospects set status = ${opts.status}, updated_at = now()
    where id = ${prospect.id}
  `;
  if (opts.status === "onboarding" || opts.status === "contracted") {
    await ensureOnboardingRun(prospect.id);
  }
  await writeAudit({
    actorUserId: opts.userId,
    orgId: prospect.orgId,
    action: "status_changed",
    payload: {
      prospectId: prospect.id,
      from: prospect.status,
      to: opts.status,
      note: opts.note ?? opts.reason ?? "",
      forced: skipping && prospect.status !== opts.status,
      override: skipping && prospect.status !== opts.status,
    },
  });
  const next = await getRow(prospect.id);
  const mapped = mapProspect(next!);
  await syncCrm(mapped);
  return mapped;
}

export async function adminPatchQuote(opts: {
  userId: string;
  prospectId: string;
  lineItems: QuoteLineItem[];
  reissue?: boolean;
}): Promise<ProspectRecord> {
  if (!(await isPlatformAdmin(opts.userId))) throw new ForbiddenError();
  const row = await getRow(opts.prospectId);
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  if (!prospect.quote) throw new Error("No quote to edit");
  if (["live", "churned", "rejected"].includes(prospect.status)) {
    throw new Error("Quote is frozen");
  }
  const nextQuote = retotalQuote({
    ...prospect.quote,
    lineItems: opts.lineItems.map((i) => ({
      ...i,
      qty: Math.max(0, Number(i.qty) || 0),
      unitCents: Math.round(Number(i.unitCents) || 0),
      totalCents: 0,
    })),
    generatedAt: new Date().toISOString(),
  });
  if (quoteIsSetupOnly(nextQuote) || !quoteHasSoftwarePackage(nextQuote)) {
    throw new Error("Quote must keep a monthly software package — setup cannot be the only line.");
  }
  let status = prospect.status;
  if (opts.reissue && (status === "quoted" || status === "accepted")) {
    status = "quoted";
  }
  const sql = await getSql();
  await sql`
    update prospects
    set quote = ${JSON.stringify(nextQuote)}::jsonb,
        quote_issued_at = now(),
        accepted_at = case when ${status} = 'quoted' then null else accepted_at end,
        status = ${status},
        updated_at = now()
    where id = ${prospect.id}
  `;
  await writeAudit({
    actorUserId: opts.userId,
    orgId: prospect.orgId,
    action: opts.reissue ? "quote_reissued" : "quote_adjusted",
    payload: { prospectId: prospect.id, monthlyCents: nextQuote.monthlyCents },
  });
  const next = await getRow(prospect.id);
  return mapProspect(next!);
}

export async function ensureOnboardingRun(prospectId: string): Promise<OnboardingRunRecord> {
  const sql = await getSql();
  const existing = await sql<RunRow>`
    select * from onboarding_runs where prospect_id = ${prospectId} limit 1
  `;
  if (existing[0]) return mapRun(existing[0]);
  const prospect = await getRow(prospectId);
  if (!prospect) throw new Error("Prospect not found");
  const answers = parseIntakeAnswers(prospect.answers);
  const payload = payloadFromAnswers(answers);
  const id = newId("onb");
  await sql`
    insert into onboarding_runs (id, prospect_id, org_id, status, steps, payload)
    values (
      ${id}, ${prospectId}, ${prospect.org_id}, 'in_progress',
      '{}'::jsonb, ${JSON.stringify(payload)}::jsonb
    )
  `;
  const rows = await sql<RunRow>`select * from onboarding_runs where id = ${id}`;
  return mapRun(rows[0]!);
}

export async function listAuditForProspect(
  userId: string,
  prospectId: string,
): Promise<
  Array<{
    id: string;
    action: string;
    payload: Record<string, string>;
    createdAt: string;
    actorUserId: string | null;
  }>
> {
  if (!(await isPlatformAdmin(userId))) throw new ForbiddenError();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    action: string;
    payload: unknown;
    created_at: unknown;
    actor_user_id: string | null;
  }>`
    select id, action, payload, created_at, actor_user_id
    from audit_events
    where payload->>'prospectId' = ${prospectId}
    order by created_at desc
    limit 80
  `;
  return rows.map((r) => {
    const raw = parseJson<Record<string, unknown>>(r.payload, {});
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      payload[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    return {
      id: r.id,
      action: r.action,
      payload,
      createdAt: asIso(r.created_at),
      actorUserId: r.actor_user_id,
    };
  });
}

export async function getProspectDetail(opts: {
  userId: string | null;
  token?: string;
  prospectId?: string;
}): Promise<ProspectDetail> {
  const row = opts.prospectId
    ? await getRow(opts.prospectId)
    : opts.token
      ? await getRowByToken(opts.token.trim())
      : null;
  if (!row) throw new Error("Prospect not found");
  const prospect = mapProspect(row);
  await assertCanAccessProspect({
    userId: opts.userId,
    prospect,
    token: opts.token,
  });
  const sql = await getSql();
  const runs = await sql<RunRow>`
    select * from onboarding_runs where prospect_id = ${prospect.id} limit 1
  `;
  const onboarding = runs[0] ? mapRun(runs[0]) : null;
  let operators: OperatorRecord[] = [];
  if (prospect.orgId) {
    const ops = await sql<OperatorRow>`
      select * from operators where org_id = ${prospect.orgId} order by created_at asc
    `;
    operators = ops.map(mapOperator);
  }
  const liveChecklist = await evaluateLiveChecklist(prospect.orgId, operators);
  const orgName = prospect.orgId
    ? (
        await sql<{ name: string }>`
          select name from organizations where id = ${prospect.orgId} limit 1
        `
      )[0]?.name ?? null
    : null;
  const admin = opts.userId ? await isPlatformAdmin(opts.userId) : false;
  const hideDraft =
    !admin &&
    (prospect.status === "prospect" || Boolean(prospect.quote?.draft));
  return {
    ...prospect,
    quote: hideDraft ? null : prospect.quote,
    onboarding,
    orgName,
    operators,
    liveChecklist,
  };
}

export async function evaluateLiveChecklist(
  orgId: string | null,
  operators?: OperatorRecord[],
): Promise<ProspectDetail["liveChecklist"]> {
  const empty = {
    hasOrg: false,
    hasLocation: false,
    hasOwner: false,
    hasPlan: false,
    hasOperatorIfNeeded: true,
    ready: false,
  };
  if (!orgId) return empty;
  const sql = await getSql();
  const org = await sql<{ id: string }>`select id from organizations where id = ${orgId} limit 1`;
  const locs = await sql<{ id: string; operating_model: string | null }>`
    select id, operating_model from locations where org_id = ${orgId}
  `;
  const owners = await sql<{ n: number }>`
    select count(*)::int as n from memberships
    where org_id = ${orgId} and role = 'owner' and status = 'active'
  `;
  const plan = await sql<{ plan_id: string }>`
    select plan_id from org_subscriptions where org_id = ${orgId} limit 1
  `;
  const ops =
    operators ??
    (
      await sql<OperatorRow>`select * from operators where org_id = ${orgId}`
    ).map(mapOperator);
  const hasOrg = Boolean(org[0]);
  const hasLocation = locs.length >= 1;
  const hasOwner = (owners[0]?.n ?? 0) >= 1;
  const hasPlan = Boolean(plan[0]?.plan_id);
  return {
    hasOrg,
    hasLocation,
    hasOwner,
    hasPlan,
    hasOperatorIfNeeded: true,
    ready: hasOrg && hasLocation && hasOwner && hasPlan,
  };
}

export async function listOperatorsForOrg(orgId: string): Promise<OperatorRecord[]> {
  const sql = await getSql();
  const rows = await sql<OperatorRow>`
    select * from operators where org_id = ${orgId} order by created_at asc
  `;
  return rows.map(mapOperator);
}

export async function listOperatorsForLocation(locationId: string): Promise<OperatorRecord[]> {
  const sql = await getSql();
  const rows = await sql<OperatorRow>`
    select * from operators where location_id = ${locationId} order by created_at asc
  `;
  return rows.map(mapOperator);
}

export async function maybePromoteLive(opts: {
  prospectId: string;
  actorUserId: string | null;
}): Promise<ProspectRecord> {
  const detail = await getProspectDetail({
    userId: opts.actorUserId,
    prospectId: opts.prospectId,
  });
  if (detail.status !== "onboarding") return detail;
  const run = detail.onboarding;
  const acks = run?.payload.checklist;
  const acksOk = Boolean(acks?.trainingAck && acks?.hardwareAck && acks?.paymentsAck);
  if (!detail.liveChecklist.ready || !acksOk) return detail;
  const sql = await getSql();
  await sql`
    update prospects set status = 'live', updated_at = now() where id = ${detail.id}
  `;
  if (run) {
    await sql`
      update onboarding_runs set status = 'complete', updated_at = now() where id = ${run.id}
    `;
  }
  await writeAudit({
    actorUserId: opts.actorUserId,
    orgId: detail.orgId,
    action: "status_changed",
    payload: { prospectId: detail.id, from: "onboarding", to: "live" },
  });
  if (detail.orgId) {
    try {
      const { markOrgHostReady, emailHostReady } = await import("./tenant-invite.server");
      await markOrgHostReady(detail.orgId);
      await emailHostReady(detail.orgId);
    } catch (err) {
      console.warn("[host-ready]", err);
    }
  }
  const next = await getRow(detail.id);
  const mapped = mapProspect(next!);
  await syncCrm(mapped);
  return mapped;
}

export type { PlanSlug };
