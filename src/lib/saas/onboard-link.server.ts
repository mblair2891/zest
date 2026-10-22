/**
 * Server-only venue and entity onboarding links.
 * The raw token is emailed once. The database stores the hash.
 * A missing mail key returns logged_only and does not count as sent.
 */
import { createHash, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { ForbiddenError, isPlatformAdmin, requireMembership } from "./tenancy.server";
import { sendEmail } from "./email.server";
import { plainTextHtml } from "./email-notices";
import { appPublicUrl } from "./flags";
import { inviteToken, newId } from "./ids";
import {
  entityOnboardingLinkCopy,
  finixStatusLabel,
  onboardLinkExpiresAt,
  onboardLinkStatus,
  onboardLinkStatusLabel,
  onboardLinkUrl,
  onboardSeatLabel,
  passwordRuleError,
  venueIsHostMerchant,
  venueOnboardGate,
  venueOnboardingLinkCopy,
  type LocationOnboardLinkRow,
  type OnboardLinkKind,
  type OnboardLinkPeek,
  type OnboardLinkPhase,
  type OnboardLinkScope,
  type OnboardLinkSeat,
  type OnboardLinkSteps,
} from "./onboard-link";

type Sql = Awaited<ReturnType<typeof getSql>>;

type LinkRow = {
  id: string;
  kind: string;
  prospect_id: string | null;
  org_id: string | null;
  location_id: string | null;
  operator_id: string | null;
  user_id: string | null;
  email: string;
  name: string;
  phone: string;
  scope: string;
  seat: string;
  expires_at: unknown;
  sent_at: unknown;
  opened_at: unknown;
  started_at: unknown;
  password_set_at: unknown;
  completed_at: unknown;
  revoked_at: unknown;
  email_status: string;
  steps: unknown;
  created_at: unknown;
};

export type OnboardEmailStatus = "sent" | "logged_only" | "failed";

export type IssuedOnboardLink = {
  status: OnboardEmailStatus;
  url: string;
  phase: OnboardLinkPhase;
  label: string;
};

export type ProspectOnboardStatus = {
  phase: OnboardLinkPhase;
  label: string;
  emailStatus: string | null;
  hostMerchant: boolean;
  finixState: string | null;
  finixLabel: string;
  agreementAt: string | null;
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function iso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function stepsOf(raw: unknown): OnboardLinkSteps {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const text = (key: string) => (typeof o[key] === "string" ? (o[key] as string) : undefined);
  return {
    agreementName: text("agreementName"),
    agreementAt: text("agreementAt"),
    finixStartedAt: text("finixStartedAt"),
    contactConfirmedAt: text("contactConfirmedAt"),
  };
}

function readAnswers(raw: unknown): { name: string; phone: string; model: string; legal: string } {
  const a = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const company = a.company && typeof a.company === "object" ? (a.company as Record<string, unknown>) : {};
  const operating = a.operating && typeof a.operating === "object" ? (a.operating as Record<string, unknown>) : {};
  const legal = String(company.legalName || company.dba || "").trim();
  const name = String(company.ownerContactName || company.billingContactName || legal || "").trim();
  return {
    name,
    phone: String(company.phone || "").trim(),
    model: String(operating.model || "").trim(),
    legal: legal || "your venue",
  };
}

async function upsertCredential(sql: Sql, userId: string, password: string): Promise<void> {
  const hashed = await hashPassword(password);
  const now = new Date().toISOString();
  const accounts = await sql<{ id: string }>`
    select id from "account"
    where "userId" = ${userId} and "providerId" = ${"credential"}
    limit 1
  `;
  if (accounts[0]) {
    await sql`
      update "account"
      set password = ${hashed}, "updatedAt" = ${now}
      where id = ${accounts[0].id}
    `;
    return;
  }
  await sql`
    insert into "account" (
      id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
    )
    values (
      ${randomUUID()}, ${userId}, ${"credential"}, ${userId}, ${hashed}, ${now}, ${now}
    )
  `;
}

async function minPasswordLen(): Promise<number> {
  try {
    const { getMinPasswordLength } = await import("./platform-settings.server");
    return await getMinPasswordLength();
  } catch {
    return 8;
  }
}

async function sendLinkMail(opts: {
  to: string;
  subject: string;
  text: string;
  kind: string;
  prospectId?: string | null;
}): Promise<OnboardEmailStatus> {
  try {
    const result = await sendEmail({
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: plainTextHtml(opts.text),
      kind: opts.kind,
      prospectId: opts.prospectId ?? null,
    });
    return result.status;
  } catch (err) {
    console.warn("[onboard-link-email]", err);
    return "failed";
  }
}

async function insertLink(
  sql: Sql,
  row: {
    kind: OnboardLinkKind;
    tokenHash: string;
    prospectId: string | null;
    orgId: string | null;
    locationId: string | null;
    operatorId: string | null;
    userId: string;
    email: string;
    name: string;
    phone: string;
    scope: OnboardLinkScope;
    seat: OnboardLinkSeat;
    createdBy: string | null;
  },
): Promise<string> {
  const id = newId("obk");
  const expires = onboardLinkExpiresAt();
  if (row.kind === "venue" && row.prospectId) {
    await sql`
      update onboarding_links
      set revoked_at = now()
      where kind = ${"venue"}
        and prospect_id = ${row.prospectId}
        and revoked_at is null
        and completed_at is null
    `;
  }
  if (row.kind === "entity" && row.operatorId) {
    await sql`
      update onboarding_links
      set revoked_at = now()
      where kind = ${"entity"}
        and operator_id = ${row.operatorId}
        and revoked_at is null
        and completed_at is null
    `;
  }
  await sql`
    insert into onboarding_links (
      id, kind, token_hash, prospect_id, org_id, location_id, operator_id, user_id,
      email, name, phone, scope, seat, expires_at, email_status, created_by, steps
    )
    values (
      ${id}, ${row.kind}, ${row.tokenHash}, ${row.prospectId}, ${row.orgId}, ${row.locationId},
      ${row.operatorId}, ${row.userId}, ${row.email}, ${row.name}, ${row.phone},
      ${row.scope}, ${row.seat}, ${expires}, ${"logged_only"}, ${row.createdBy}, ${"{}"}::jsonb
    )
  `;
  return id;
}

async function stampMail(sql: Sql, id: string, status: OnboardEmailStatus): Promise<void> {
  const sentAt = status === "sent" ? new Date().toISOString() : null;
  await sql`
    update onboarding_links
    set email_status = ${status}, sent_at = ${sentAt}
    where id = ${id}
  `;
}

export async function issueVenueOnboardingLink(opts: {
  prospectId: string;
  userId: string;
  email: string;
  createdBy?: string | null;
}): Promise<IssuedOnboardLink> {
  const sql = await getSql();
  const rows = await sql<{ answers: unknown; public_token: string }>`
    select answers, public_token from prospects where id = ${opts.prospectId} limit 1
  `;
  if (!rows[0]) throw new Error("Prospect not found");
  const answers = readAnswers(rows[0].answers);
  const token = inviteToken();
  const url = onboardLinkUrl(appPublicUrl(), token);
  const id = await insertLink(sql, {
    kind: "venue",
    tokenHash: hashToken(token),
    prospectId: opts.prospectId,
    orgId: null,
    locationId: null,
    operatorId: null,
    userId: opts.userId,
    email: opts.email,
    name: answers.name || opts.email,
    phone: answers.phone,
    scope: "location",
    seat: "owner",
    createdBy: opts.createdBy ?? null,
  });
  const mail = venueOnboardingLinkCopy({
    venueName: answers.legal,
    url,
    username: opts.email,
  });
  const status = await sendLinkMail({
    to: opts.email,
    subject: mail.subject,
    text: mail.text,
    kind: "venue_onboarding_link",
    prospectId: opts.prospectId,
  });
  await stampMail(sql, id, status);
  const phase: OnboardLinkPhase = status === "sent" ? "sent" : "unsent";
  return { status, url, phase, label: onboardLinkStatusLabel(phase) };
}

export async function issueEntityOnboardingLink(opts: {
  orgId: string;
  locationId: string;
  operatorId: string;
  userId: string;
  email: string;
  name: string;
  phone?: string;
  scope: OnboardLinkScope;
  seat: OnboardLinkSeat;
  createdBy?: string | null;
}): Promise<IssuedOnboardLink> {
  if (opts.scope !== "entity") {
    throw new Error("Entity onboarding links stay on one selling entity.");
  }
  const sql = await getSql();
  const ops = await sql<{ dba: string | null; legal_name: string; location_name: string | null }>`
    select o.dba, o.legal_name, l.name as location_name
    from operators o
    left join locations l on l.id = o.location_id
    where o.id = ${opts.operatorId} and o.org_id = ${opts.orgId}
    limit 1
  `;
  if (!ops[0]) throw new Error("Selling entity not found on this venue.");
  const entityName = ops[0].dba?.trim() || ops[0].legal_name;
  const venueName = ops[0].location_name?.trim() || "the venue";
  const phone = (opts.phone || "").trim();
  const token = inviteToken();
  const url = onboardLinkUrl(appPublicUrl(), token);
  const id = await insertLink(sql, {
    kind: "entity",
    tokenHash: hashToken(token),
    prospectId: null,
    orgId: opts.orgId,
    locationId: opts.locationId,
    operatorId: opts.operatorId,
    userId: opts.userId,
    email: opts.email,
    name: opts.name.trim() || opts.email,
    phone,
    scope: "entity",
    seat: opts.seat,
    createdBy: opts.createdBy ?? null,
  });
  await sql`
    update operators
    set poc_name = ${opts.name.trim() || opts.email},
        contact_email = ${opts.email},
        contact_phone = ${phone || null}
    where id = ${opts.operatorId}
  `;
  const mail = entityOnboardingLinkCopy({
    entityName,
    venueName,
    url,
    username: opts.email,
    seatLabel: onboardSeatLabel("entity", opts.seat),
  });
  const status = await sendLinkMail({
    to: opts.email,
    subject: mail.subject,
    text: mail.text,
    kind: "entity_onboarding_link",
  });
  await stampMail(sql, id, status);
  const phase: OnboardLinkPhase = status === "sent" ? "sent" : "unsent";
  return { status, url, phase, label: onboardLinkStatusLabel(phase) };
}

async function loadByToken(token: string): Promise<LinkRow | null> {
  const raw = token.trim();
  if (raw.length < 16) return null;
  const sql = await getSql();
  const rows = await sql<LinkRow>`
    select * from onboarding_links where token_hash = ${hashToken(raw)} limit 1
  `;
  return rows[0] ?? null;
}

async function attachVenueLocation(sql: Sql, row: LinkRow): Promise<LinkRow> {
  if (row.kind !== "venue" || !row.prospect_id || row.location_id) return row;
  const found = await sql<{ org_id: string | null; location_id: string | null }>`
    select p.org_id, l.id as location_id
    from prospects p
    left join locations l on l.org_id = p.org_id
    where p.id = ${row.prospect_id}
    order by l.created_at asc nulls last
    limit 1
  `;
  const hit = found[0];
  if (!hit?.location_id && !hit?.org_id) return row;
  await sql`
    update onboarding_links
    set org_id = coalesce(org_id, ${hit.org_id}),
        location_id = coalesce(location_id, ${hit.location_id})
    where id = ${row.id}
  `;
  return { ...row, org_id: row.org_id || hit.org_id, location_id: row.location_id || hit.location_id };
}

async function hostContext(sql: Sql, row: LinkRow): Promise<{
  hostMerchant: boolean;
  venueName: string;
  entityName: string;
  setupToken: string | null;
  finixState: string | null;
  finixLinkUrl: string | null;
}> {
  let model = "";
  let venueName = "";
  let entityName = "";
  let setupToken: string | null = null;
  if (row.prospect_id) {
    const prospects = await sql<{ answers: unknown; public_token: string }>`
      select answers, public_token from prospects where id = ${row.prospect_id} limit 1
    `;
    if (prospects[0]) {
      const answers = readAnswers(prospects[0].answers);
      model = answers.model;
      venueName = answers.legal;
      setupToken = prospects[0].public_token;
    }
  }
  if (row.location_id) {
    const locs = await sql<{ name: string; operating_model: string | null }>`
      select name, operating_model from locations where id = ${row.location_id} limit 1
    `;
    if (locs[0]) {
      venueName = locs[0].name || venueName;
      model = locs[0].operating_model || model;
    }
  }
  if (row.operator_id) {
    const ops = await sql<{ dba: string | null; legal_name: string; location_name: string | null; operating_model: string | null }>`
      select o.dba, o.legal_name, l.name as location_name, l.operating_model
      from operators o
      left join locations l on l.id = o.location_id
      where o.id = ${row.operator_id}
      limit 1
    `;
    if (ops[0]) {
      entityName = ops[0].dba?.trim() || ops[0].legal_name;
      venueName = ops[0].location_name || venueName;
      if (row.kind === "venue") model = ops[0].operating_model || model;
    }
  }
  let finixState: string | null = null;
  let finixLinkUrl: string | null = null;
  if (row.location_id && row.kind === "venue") {
    const pay = await sql<{ finix_onboarding_state: string | null; onboarding_link: string | null; onboarding_form_id: string | null }>`
      select finix_onboarding_state, onboarding_link, onboarding_form_id
      from payment_accounts
      where location_id = ${row.location_id} and kind = ${"host"}
      limit 1
    `;
    finixState = pay[0]?.finix_onboarding_state ?? null;
    finixLinkUrl = pay[0]?.onboarding_link ?? null;
    if (!finixState && pay[0]?.onboarding_form_id) finixState = "PROVISIONING";
  }
  const hostMerchant = row.kind === "venue" ? venueIsHostMerchant(model) : false;
  return { hostMerchant, venueName: venueName || "your venue", entityName, setupToken, finixState, finixLinkUrl };
}

function peekFrom(row: LinkRow, ctx: Awaited<ReturnType<typeof hostContext>>): OnboardLinkPeek {
  const steps = stepsOf(row.steps);
  const phase = onboardLinkStatus({
    sentAt: iso(row.sent_at),
    openedAt: iso(row.opened_at),
    startedAt: iso(row.started_at),
    passwordSetAt: iso(row.password_set_at),
    completedAt: iso(row.completed_at),
    revokedAt: iso(row.revoked_at),
    expiresAt: iso(row.expires_at),
  });
  const finixStarted = Boolean(steps.finixStartedAt || ctx.finixLinkUrl || ctx.finixState);
  const gate = venueOnboardGate({
    hostMerchant: ctx.hostMerchant,
    agreementAt: steps.agreementAt,
    finixStarted,
    hasLocation: Boolean(row.location_id),
  });
  const kind: OnboardLinkKind = row.kind === "entity" ? "entity" : "venue";
  const scope: OnboardLinkScope = row.scope === "entity" ? "entity" : "location";
  const seat: OnboardLinkSeat =
    row.seat === "manager" || row.seat === "accountant" ? row.seat : "owner";
  const canComplete = kind === "entity" ? Boolean(row.password_set_at) && phase !== "expired" : gate.ok && phase !== "expired";
  return {
    kind,
    email: row.email,
    name: row.name,
    phone: row.phone,
    venueName: ctx.venueName,
    entityName: ctx.entityName,
    scope,
    seat,
    seatLabel: onboardSeatLabel(scope, seat),
    hostMerchant: ctx.hostMerchant,
    phase,
    label: onboardLinkStatusLabel(phase),
    expired: phase === "expired",
    revoked: Boolean(row.revoked_at),
    completed: Boolean(row.completed_at),
    passwordSet: Boolean(row.password_set_at),
    agreementAt: steps.agreementAt ?? null,
    agreementName: steps.agreementName ?? null,
    finixStarted,
    finixState: ctx.finixState,
    finixLabel: finixStatusLabel(ctx.finixState, ctx.hostMerchant),
    finixLinkUrl: ctx.finixLinkUrl,
    hasLocation: Boolean(row.location_id),
    setupToken: ctx.setupToken,
    expiresAt: iso(row.expires_at) || "",
    missing: kind === "venue" ? gate.missing : [],
    canComplete: canComplete && !row.completed_at,
  };
}

export async function peekOnboardLink(token: string): Promise<OnboardLinkPeek> {
  const sql = await getSql();
  const found = await loadByToken(token);
  if (!found) throw new Error("This onboarding link is invalid.");
  const row = await attachVenueLocation(sql, found);
  if (!row.opened_at && !row.revoked_at) {
    await sql`update onboarding_links set opened_at = now(), started_at = coalesce(started_at, now()) where id = ${row.id}`;
    row.opened_at = new Date().toISOString();
    row.started_at = row.started_at || row.opened_at;
  }
  const ctx = await hostContext(sql, row);
  return peekFrom(row, ctx);
}

export async function acceptOnboardLink(opts: { token: string; password: string }): Promise<{ email: string }> {
  const sql = await getSql();
  const found = await loadByToken(opts.token);
  if (!found) throw new Error("This onboarding link is invalid.");
  const row = await attachVenueLocation(sql, found);
  const phase = onboardLinkStatus({
    completedAt: iso(row.completed_at),
    revokedAt: iso(row.revoked_at),
    expiresAt: iso(row.expires_at),
    passwordSetAt: iso(row.password_set_at),
    openedAt: iso(row.opened_at),
    sentAt: iso(row.sent_at),
  });
  if (phase === "expired") throw new Error("This onboarding link has expired. Ask for a new link.");
  if (row.completed_at) throw new Error("This onboarding link is already complete. Sign in.");
  if (!row.user_id) throw new Error("This onboarding link has no account yet.");
  const minLen = await minPasswordLen();
  const problem = passwordRuleError(opts.password, minLen);
  if (problem) throw new Error(problem);
  await upsertCredential(sql, row.user_id, opts.password);
  const now = new Date().toISOString();
  await sql`
    update onboarding_links
    set password_set_at = ${now},
        started_at = coalesce(started_at, ${now}),
        opened_at = coalesce(opened_at, ${now})
    where id = ${row.id}
  `;
  await sql`
    update subscriber_logins
    set must_change_password = false, updated_at = ${now}
    where user_id = ${row.user_id}
  `;
  return { email: row.email };
}

async function mutableLink(token: string): Promise<{ sql: Sql; row: LinkRow }> {
  const sql = await getSql();
  const found = await loadByToken(token);
  if (!found) throw new Error("This onboarding link is invalid.");
  const row = await attachVenueLocation(sql, found);
  const phase = onboardLinkStatus({
    completedAt: iso(row.completed_at),
    revokedAt: iso(row.revoked_at),
    expiresAt: iso(row.expires_at),
  });
  if (phase === "expired") throw new Error("This onboarding link has expired. Ask for a new link.");
  if (!row.password_set_at) throw new Error("Set a password on this link first.");
  return { sql, row };
}

export async function saveOnboardAgreement(opts: { token: string; name: string }): Promise<OnboardLinkPeek> {
  const { sql, row } = await mutableLink(opts.token);
  if (row.kind !== "venue") throw new Error("The Summex merchant agreement is a venue step.");
  const ctx = await hostContext(sql, row);
  if (!ctx.hostMerchant) throw new Error("A peer venue does not sign the host merchant agreement.");
  const name = opts.name.trim().slice(0, 80);
  if (name.length < 2) throw new Error("Type your name to accept the Summex merchant agreement.");
  const steps = { ...stepsOf(row.steps), agreementName: name, agreementAt: new Date().toISOString() };
  await sql`
    update onboarding_links set steps = ${JSON.stringify(steps)}::jsonb where id = ${row.id}
  `;
  if (row.location_id) {
    await sql`
      update locations
      set summex_agreement_at = ${steps.agreementAt},
          summex_agreement_name = ${name}
      where id = ${row.location_id}
    `;
  }
  row.steps = steps;
  return peekFrom(row, ctx);
}

export async function startOnboardFinix(token: string): Promise<OnboardLinkPeek> {
  const { sql, row } = await mutableLink(token);
  if (row.kind !== "venue") throw new Error("Finix for the host merchant is a venue step.");
  const ctx = await hostContext(sql, row);
  if (!ctx.hostMerchant) throw new Error("A peer venue does not start host Finix.");
  if (!row.location_id || !row.user_id) {
    throw new Error("Save the building in venue setup, then start Finix from this link.");
  }
  const { generateLocationOnboardingForm } = await import("@/lib/payments/location-finix-form.server");
  const view = await generateLocationOnboardingForm(row.user_id, { locationId: row.location_id });
  const steps = { ...stepsOf(row.steps), finixStartedAt: new Date().toISOString() };
  await sql`
    update onboarding_links set steps = ${JSON.stringify(steps)}::jsonb where id = ${row.id}
  `;
  row.steps = steps;
  const next = await hostContext(sql, row);
  next.finixState = view.merchantState || next.finixState || "PROVISIONING";
  next.finixLinkUrl = view.linkUrl || next.finixLinkUrl;
  return peekFrom(row, next);
}

export async function emailOnboardFinix(token: string): Promise<{ notice: string; peek: OnboardLinkPeek }> {
  const { row } = await mutableLink(token);
  if (row.kind !== "venue" || !row.location_id || !row.user_id) {
    throw new Error("Start Finix after the building is saved.");
  }
  const { emailLocationOnboardingLink } = await import("@/lib/payments/location-finix-form.server");
  const view = await emailLocationOnboardingLink(row.user_id, { locationId: row.location_id, to: row.email });
  const peek = await peekOnboardLink(token);
  return { notice: view.emailNotice || "Email not sent.", peek };
}

export async function confirmEntityContact(opts: {
  token: string;
  name: string;
  phone: string;
}): Promise<OnboardLinkPeek> {
  const { sql, row } = await mutableLink(opts.token);
  if (row.kind !== "entity") throw new Error("This confirmation is for an entity contact.");
  const name = opts.name.trim().slice(0, 80) || row.name;
  const phone = opts.phone.trim().slice(0, 40);
  const steps = { ...stepsOf(row.steps), contactConfirmedAt: new Date().toISOString() };
  await sql`
    update onboarding_links
    set name = ${name}, phone = ${phone}, steps = ${JSON.stringify(steps)}::jsonb
    where id = ${row.id}
  `;
  if (row.operator_id) {
    await sql`
      update operators
      set poc_name = ${name}, contact_phone = ${phone || null}
      where id = ${row.operator_id}
    `;
  }
  row.name = name;
  row.phone = phone;
  row.steps = steps;
  const ctx = await hostContext(sql, row);
  return peekFrom(row, ctx);
}

export async function completeOnboardLink(token: string): Promise<{ to: "dashboard" | "setup"; setupToken: string | null }> {
  const { sql, row } = await mutableLink(token);
  const ctx = await hostContext(sql, row);
  const steps = stepsOf(row.steps);
  if (row.kind === "venue") {
    const gate = venueOnboardGate({
      hostMerchant: ctx.hostMerchant,
      agreementAt: steps.agreementAt,
      finixStarted: Boolean(steps.finixStartedAt || ctx.finixLinkUrl || ctx.finixState),
      hasLocation: Boolean(row.location_id),
    });
    if (!gate.ok) throw new Error(`Finish ${gate.missing.join(" and ")} before the dashboard.`);
    if (row.location_id && steps.agreementAt) {
      await sql`
        update locations
        set summex_agreement_at = coalesce(summex_agreement_at, ${steps.agreementAt}),
            summex_agreement_name = coalesce(summex_agreement_name, ${steps.agreementName || null})
        where id = ${row.location_id}
      `;
    }
  }
  await sql`update onboarding_links set completed_at = now() where id = ${row.id}`;
  if (row.kind === "entity") return { to: "dashboard", setupToken: null };
  if (!row.location_id && ctx.setupToken) return { to: "setup", setupToken: ctx.setupToken };
  return { to: "dashboard", setupToken: null };
}

export async function prospectOnboardingStatus(prospectId: string): Promise<ProspectOnboardStatus | null> {
  const sql = await getSql();
  const rows = await sql<LinkRow>`
    select * from onboarding_links
    where kind = ${"venue"} and prospect_id = ${prospectId}
    order by created_at desc
    limit 1
  `;
  if (!rows[0]) return null;
  const row = await attachVenueLocation(sql, rows[0]);
  const ctx = await hostContext(sql, row);
  const phase = onboardLinkStatus({
    sentAt: iso(row.sent_at),
    openedAt: iso(row.opened_at),
    startedAt: iso(row.started_at),
    passwordSetAt: iso(row.password_set_at),
    completedAt: iso(row.completed_at),
    revokedAt: iso(row.revoked_at),
    expiresAt: iso(row.expires_at),
  });
  return {
    phase,
    label: onboardLinkStatusLabel(phase),
    emailStatus: row.email_status,
    hostMerchant: ctx.hostMerchant,
    finixState: ctx.finixState,
    finixLabel: finixStatusLabel(ctx.finixState, ctx.hostMerchant),
    agreementAt: stepsOf(row.steps).agreementAt ?? null,
  };
}

async function assertVenueWriter(userId: string, orgId: string): Promise<void> {
  if (await isPlatformAdmin(userId)) return;
  const access = await requireMembership(userId, orgId, ["owner", "manager"]);
  if (access.operatorId) {
    throw new ForbiddenError("Entity admins cannot manage venue onboarding links");
  }
}

export async function listLocationOnboardLinks(
  userId: string,
  orgId: string,
  locationId: string,
): Promise<LocationOnboardLinkRow[]> {
  await assertVenueWriter(userId, orgId);
  const sql = await getSql();
  const rows = await sql<LinkRow>`
    select distinct on (operator_id) *
    from onboarding_links
    where kind = ${"entity"} and location_id = ${locationId} and org_id = ${orgId}
    order by operator_id, created_at desc
  `;
  return rows.map((row) => {
    const phase = onboardLinkStatus({
      sentAt: iso(row.sent_at),
      openedAt: iso(row.opened_at),
      startedAt: iso(row.started_at),
      passwordSetAt: iso(row.password_set_at),
      completedAt: iso(row.completed_at),
      revokedAt: iso(row.revoked_at),
      expiresAt: iso(row.expires_at),
    });
    const scope = row.scope === "entity" ? "entity" : "location";
    return {
      operatorId: row.operator_id || "",
      email: row.email,
      name: row.name,
      phase,
      label: onboardLinkStatusLabel(phase),
      seat: row.seat,
      seatLabel: onboardSeatLabel(scope, row.seat),
      scope,
      emailStatus: row.email_status,
    };
  });
}

export async function resendEntityOnboardLink(
  userId: string,
  opts: { orgId: string; operatorId: string },
): Promise<IssuedOnboardLink> {
  await assertVenueWriter(userId, opts.orgId);
  const sql = await getSql();
  const rows = await sql<LinkRow>`
    select * from onboarding_links
    where kind = ${"entity"} and operator_id = ${opts.operatorId} and org_id = ${opts.orgId}
    order by created_at desc
    limit 1
  `;
  const prev = rows[0];
  if (!prev?.user_id || !prev.location_id) throw new Error("Send the entity contact link first.");
  return issueEntityOnboardingLink({
    orgId: opts.orgId,
    locationId: prev.location_id,
    operatorId: opts.operatorId,
    userId: prev.user_id,
    email: prev.email,
    name: prev.name,
    phone: prev.phone,
    scope: "entity",
    seat: prev.seat === "manager" || prev.seat === "accountant" ? prev.seat : "owner",
    createdBy: userId,
  });
}
