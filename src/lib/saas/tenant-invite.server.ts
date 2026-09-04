/**
 * Server-only host → tenant (operator) invites. Never import from client.
 */
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";
import { PRODUCT_NAME } from "@/lib/platform/brand";
import { sendEmail } from "./email.server";
import { appPublicUrl } from "./flags";
import { inviteToken, newId } from "./ids";
import {
  loadCommunicationsSettings,
  loadGeneral,
  loadOnboardingSettings,
  loadPaymentsSettings,
} from "./platform-settings.server";
import {
  EMPTY_TENANT_PAYLOAD,
  parseTenantKind,
  parseTenantPayload,
  type TenantInvitePeek,
  type TenantInviteRow,
  type TenantKind,
  type TenantOnboardPayload,
  type TenantOnboardStatus,
} from "./tenant-invite";
import { ForbiddenError, isPlatformAdmin, loadUser, requireActiveOrg, writeAudit } from "./tenancy.server";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function attachVendorMembership(
  userId: string,
  orgId: string,
  operatorId: string,
  invitedEmail: string | null,
): Promise<void> {
  const user = await loadUser(userId);
  const email = user?.email?.trim().toLowerCase();
  if (invitedEmail && email && email !== invitedEmail.toLowerCase()) {
    throw new ForbiddenError("Sign in with the invited email address");
  }
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from memberships
    where user_id = ${userId} and org_id = ${orgId}
    limit 1
  `;
  if (existing[0]) {
    await sql`
      update memberships
      set status = 'active', role = ${"vendor"}, operator_id = ${operatorId}
      where id = ${existing[0].id}
    `;
  } else {
    await sql`
      insert into memberships (id, user_id, org_id, role, status, operator_id)
      values (${newId("mem")}, ${userId}, ${orgId}, ${"vendor"}, ${"active"}, ${operatorId})
    `;
  }
}

function asIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function deriveStatus(row: {
  onboard_status: string;
  expires_at: unknown | null;
  revoked_at: unknown | null;
  completed_at: unknown | null;
  opened_at: unknown | null;
}): TenantOnboardStatus {
  if (row.completed_at || row.onboard_status === "complete") return "complete";
  if (row.revoked_at) return "expired";
  if (row.expires_at && new Date(asIso(row.expires_at)).getTime() < Date.now()) return "expired";
  if (row.opened_at || row.onboard_status === "in_progress") return "in_progress";
  if (row.onboard_status === "invited") return "invited";
  return "draft";
}

async function assertHostCanInvite(userId: string, orgId: string, locationId?: string | null) {
  const admin = await isPlatformAdmin(userId);
  if (!admin) {
    await requireActiveOrg(userId, orgId, ["owner", "manager"]);
  }
  const sql = await getSql();
  const org = await sql<{ host_status: string | null }>`
    select host_status from organizations where id = ${orgId} limit 1
  `;
  if (!org[0]) throw new Error("Host not found");
  const status = org[0].host_status || "onboarding";
  const liveLoc = await sql<{ n: number }>`
    select count(*)::int as n from locations where org_id = ${orgId}
  `;
  const ready = status === "host_ready" || status === "live" || Number(liveLoc[0]?.n) > 0;
  if (!ready && !admin) {
    throw new ForbiddenError("Finish host onboarding before inviting operators");
  }
  if (locationId) {
    const loc = await sql<{ operating_model: string | null }>`
      select operating_model from locations where id = ${locationId} and org_id = ${orgId} limit 1
    `;
    if (!loc[0]) throw new Error("Location not found");
    if (
      loc[0].operating_model !== "host_operators" &&
      loc[0].operating_model !== "peer_venue" &&
      !admin
    ) {
      throw new ForbiddenError("Tenant invites are for host + tenants or shared-venue locations");
    }
  }
}

export async function listTenantSlots(
  userId: string,
  orgId: string,
  locationId?: string | null,
): Promise<TenantInviteRow[]> {
  await assertHostCanInvite(userId, orgId, locationId ?? null);
  const sql = await getSql();
  const ops = await sql<{
    id: string;
    org_id: string;
    location_id: string | null;
    legal_name: string;
    dba: string | null;
    poc_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    station_kind: string;
    onboard_status: string;
  }>`
    select id, org_id, location_id, legal_name, dba, poc_name,
           contact_email, contact_phone, station_kind, onboard_status
    from operators
    where org_id = ${orgId}
      and (${locationId ?? null}::text is null or location_id = ${locationId ?? null})
    order by created_at asc
  `;
  const invites = await sql<{
    id: string;
    operator_id: string;
    expires_at: unknown | null;
    revoked_at: unknown | null;
    opened_at: unknown | null;
    completed_at: unknown | null;
    created_at: unknown;
  }>`
    select id, operator_id, expires_at, revoked_at, opened_at, completed_at, created_at
    from operator_invites where org_id = ${orgId}
    order by created_at desc
  `;
  const latest = new Map<string, (typeof invites)[0]>();
  for (const inv of invites) {
    if (!latest.has(inv.operator_id)) latest.set(inv.operator_id, inv);
  }
  const pay = new Map<string, string>();
  try {
    const accs = await sql<{ operator_id: string | null; onboarding_status: string }>`
      select operator_id, onboarding_status from payment_accounts
      where org_id = ${orgId} and kind = ${"operator"}
    `;
    for (const a of accs) {
      if (a.operator_id) pay.set(a.operator_id, a.onboarding_status);
    }
  } catch {
    /* migration may not have run in older previews */
  }
  return ops.map((r) => {
    const inv = latest.get(r.id);
    return {
      operatorId: r.id,
      orgId: r.org_id,
      locationId: r.location_id,
      displayName: r.dba || r.legal_name,
      stationKind: parseTenantKind(r.station_kind),
      pocName: r.poc_name || "",
      email: r.contact_email || "",
      phone: r.contact_phone || "",
      status: deriveStatus({
        onboard_status: r.onboard_status,
        expires_at: inv?.expires_at ?? null,
        revoked_at: inv?.revoked_at ?? null,
        completed_at: inv?.completed_at ?? null,
        opened_at: inv?.opened_at ?? null,
      }),
      expiresAt: inv?.expires_at ? asIso(inv.expires_at) : null,
      inviteId: inv?.id ?? null,
      paymentsStatus: pay.get(r.id) ?? "not_started",
    };
  });
}

export async function addTenantSlot(
  userId: string,
  input: {
    orgId: string;
    locationId: string;
    displayName: string;
    stationKind: TenantKind;
    pocName: string;
    email: string;
    phone: string;
  },
): Promise<TenantInviteRow> {
  await assertHostCanInvite(userId, input.orgId, input.locationId);
  const name = input.displayName.trim();
  if (name.length < 2) throw new Error("Tenant display name is required");
  const email = input.email.trim().toLowerCase();
  const sql = await getSql();
  const id = newId("opr");
  await sql`
    insert into operators (
      id, org_id, location_id, legal_name, dba, contact_email, contact_phone,
      station_types, station_kind, poc_name, onboard_status
    )
    values (
      ${id}, ${input.orgId}, ${input.locationId},
      ${name}, ${name}, ${email || null}, ${input.phone.trim() || null},
      ${JSON.stringify([input.stationKind === "bar" ? "bar" : input.stationKind === "kitchen" ? "kitchen" : "both"])}::jsonb,
      ${input.stationKind}, ${input.pocName.trim() || null}, ${"draft"}
    )
  `;
  await writeAudit({
    orgId: input.orgId,
    actorUserId: userId,
    action: "tenant_slot_added",
    payload: { operatorId: id, name },
  });
  const list = await listTenantSlots(userId, input.orgId, input.locationId);
  const row = list.find((t) => t.operatorId === id);
  if (!row) throw new Error("Could not create tenant slot");
  return row;
}

async function expiryDays(): Promise<number> {
  try {
    const s = await loadOnboardingSettings();
    return s.tenantInviteExpiryDays || 14;
  } catch {
    return 14;
  }
}

export async function generateTenantInvite(
  userId: string,
  operatorId: string,
  channels: { email: boolean; sms: boolean },
): Promise<{ inviteUrl: string; status: string; emailStatus: string; smsStatus: string }> {
  const sql = await getSql();
  const ops = await sql<{
    id: string;
    org_id: string;
    location_id: string | null;
    legal_name: string;
    dba: string | null;
    poc_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
  }>`
    select id, org_id, location_id, legal_name, dba, poc_name, contact_email, contact_phone
    from operators where id = ${operatorId} limit 1
  `;
  const op = ops[0];
  if (!op) throw new Error("Tenant not found");
  await assertHostCanInvite(userId, op.org_id, op.location_id);
  const days = await expiryDays();
  const raw = inviteToken();
  const tokenHash = hashToken(raw);
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  await sql`
    update operator_invites set revoked_at = now()
    where operator_id = ${operatorId} and revoked_at is null and completed_at is null
  `;
  const id = newId("tinv");
  await sql`
    insert into operator_invites (
      id, operator_id, org_id, location_id, email, phone, token_hash, expires_at, invited_by
    )
    values (
      ${id}, ${operatorId}, ${op.org_id}, ${op.location_id},
      ${op.contact_email}, ${op.contact_phone}, ${tokenHash}, ${expires}, ${userId}
    )
  `;
  await sql`
    update operators set onboard_status = ${"invited"} where id = ${operatorId}
  `;
  const origin = appPublicUrl().replace(/\/$/, "");
  const inviteUrl = `${origin}/tenant/${raw}`;
  await writeAudit({
    orgId: op.org_id,
    actorUserId: userId,
    action: "tenant_invite_sent",
    payload: { operatorId, channels },
  });
  let emailStatus = "skipped";
  let smsStatus = "skipped";
  if (channels.email && op.contact_email) {
    emailStatus = await sendTenantInviteEmail({
      to: op.contact_email,
      pocName: op.poc_name || op.dba || op.legal_name,
      tenantName: op.dba || op.legal_name,
      orgId: op.org_id,
      inviteUrl,
      days,
    });
  } else if (channels.email) {
    emailStatus = "no_email";
  }
  if (channels.sms && op.contact_phone) {
    smsStatus = await sendTenantInviteSms({
      to: op.contact_phone,
      tenantName: op.dba || op.legal_name,
      orgId: op.org_id,
      locationId: op.location_id,
      inviteUrl,
    });
  } else if (channels.sms) {
    smsStatus = "no_phone";
  }
  return { inviteUrl, status: "invited", emailStatus, smsStatus };
}

export async function revokeTenantInvite(userId: string, operatorId: string): Promise<void> {
  const sql = await getSql();
  const ops = await sql<{ org_id: string; location_id: string | null }>`
    select org_id, location_id from operators where id = ${operatorId} limit 1
  `;
  if (!ops[0]) throw new Error("Tenant not found");
  await assertHostCanInvite(userId, ops[0].org_id, ops[0].location_id);
  await sql`
    update operator_invites set revoked_at = now()
    where operator_id = ${operatorId} and revoked_at is null and completed_at is null
  `;
  await sql`
    update operators set onboard_status = ${"draft"}
    where id = ${operatorId} and onboard_status <> ${"complete"}
  `;
  await writeAudit({
    orgId: ops[0].org_id,
    actorUserId: userId,
    action: "tenant_invite_revoked",
    payload: { operatorId },
  });
}

export async function peekTenantInvite(token: string): Promise<TenantInvitePeek | null> {
  const sql = await getSql();
  const hash = hashToken(token.trim());
  const rows = await sql<{
    email: string | null;
    poc_name: string | null;
    dba: string | null;
    legal_name: string;
    station_kind: string;
    expires_at: unknown;
    revoked_at: unknown | null;
    completed_at: unknown | null;
    org_name: string;
    host_brand: string | null;
    location_id: string | null;
    operator_id: string;
  }>`
    select i.email, o.poc_name, o.dba, o.legal_name, o.station_kind,
           i.expires_at, i.revoked_at, i.completed_at,
           org.name as org_name, loc.host_brand_name as host_brand,
           i.location_id, i.operator_id
    from operator_invites i
    join operators o on o.id = i.operator_id
    join organizations org on org.id = i.org_id
    left join locations loc on loc.id = i.location_id
    where i.token_hash = ${hash}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    displayName: r.dba || r.legal_name,
    hostBrand: r.host_brand || r.org_name,
    orgName: r.org_name,
    email: r.email || "",
    pocName: r.poc_name || "",
    stationKind: parseTenantKind(r.station_kind),
    expired: new Date(asIso(r.expires_at)).getTime() < Date.now(),
    revoked: Boolean(r.revoked_at),
    completed: Boolean(r.completed_at),
    locationId: r.location_id,
    operatorId: r.operator_id,
  };
}

async function loadInviteByToken(token: string) {
  const sql = await getSql();
  const hash = hashToken(token.trim());
  const rows = await sql<{
    id: string;
    operator_id: string;
    org_id: string;
    location_id: string | null;
    email: string | null;
    expires_at: unknown;
    revoked_at: unknown | null;
    completed_at: unknown | null;
    opened_at: unknown | null;
  }>`
    select id, operator_id, org_id, location_id, email, expires_at, revoked_at, completed_at, opened_at
    from operator_invites where token_hash = ${hash} limit 1
  `;
  const inv = rows[0];
  if (!inv) throw new Error("Invite not found");
  if (inv.revoked_at) throw new Error("Invite was revoked");
  if (inv.completed_at) throw new Error("Invite already completed");
  if (new Date(asIso(inv.expires_at)).getTime() < Date.now()) throw new Error("Invite expired");
  return inv;
}

export async function openTenantInvite(userId: string | null, token: string): Promise<{
  operatorId: string;
  payload: TenantOnboardPayload;
  peek: TenantInvitePeek;
}> {
  const inv = await loadInviteByToken(token);
  const peek = await peekTenantInvite(token);
  if (!peek) throw new Error("Invite not found");
  const sql = await getSql();
  if (!inv.opened_at) {
    await sql`update operator_invites set opened_at = now() where id = ${inv.id}`;
    await sql`
      update operators set onboard_status = ${"in_progress"}
      where id = ${inv.operator_id} and onboard_status <> ${"complete"}
    `;
    await writeAudit({
      orgId: inv.org_id,
      actorUserId: userId,
      action: "tenant_invite_opened",
      payload: { operatorId: inv.operator_id },
    });
  }
  if (userId) {
    await attachVendorMembership(userId, inv.org_id, inv.operator_id, inv.email);
  }
  const ops = await sql<{ onboard_payload: unknown }>`
    select onboard_payload from operators where id = ${inv.operator_id} limit 1
  `;
  const payload = parseTenantPayload(ops[0]?.onboard_payload);
  if (!payload.pocEmail) payload.pocEmail = peek.email;
  if (!payload.pocName) payload.pocName = peek.pocName;
  if (!payload.dba) payload.dba = peek.displayName;
  if (!payload.legalName) payload.legalName = peek.displayName;
  if (!payload.stationKind) payload.stationKind = peek.stationKind;
  return { operatorId: inv.operator_id, payload, peek };
}

export async function saveTenantOnboard(
  userId: string | null,
  token: string,
  payloadRaw: unknown,
): Promise<TenantOnboardPayload> {
  const inv = await loadInviteByToken(token);
  const payload = parseTenantPayload(payloadRaw);
  const sql = await getSql();
  await sql`
    update operators
    set onboard_payload = ${JSON.stringify(payload)}::jsonb,
        poc_name = ${payload.pocName || null},
        contact_email = ${payload.pocEmail || inv.email},
        contact_phone = ${payload.pocPhone || null}
    where id = ${inv.operator_id}
  `;
  if (userId) await openTenantInvite(userId, token);
  return payload;
}

export async function completeTenantOnboard(
  userId: string | null,
  token: string,
  payloadRaw: unknown,
): Promise<{ ok: true }> {
  const inv = await loadInviteByToken(token);
  const payload = parseTenantPayload({ ...EMPTY_TENANT_PAYLOAD, ...parseTenantPayload(payloadRaw) });
  if (payload.legalName.trim().length < 2 && payload.dba.trim().length < 2) {
    throw new Error("Legal name or DBA is required");
  }
  const sql = await getSql();
  const name = payload.legalName.trim() || payload.dba.trim();
  const dba = payload.dba.trim() || name;
  const stations =
    payload.stationKind === "bar"
      ? ["bar"]
      : payload.stationKind === "kitchen"
        ? ["kitchen"]
        : ["both"];
  await sql`
    update operators
    set legal_name = ${name},
        dba = ${dba},
        poc_name = ${payload.pocName || null},
        contact_email = ${payload.pocEmail || inv.email},
        contact_phone = ${payload.pocPhone || null},
        station_kind = ${payload.stationKind},
        station_types = ${JSON.stringify(stations)}::jsonb,
        menu_notes = ${payload.menuNotes || null},
        staff_notes = ${payload.staffNotes || null},
        payout_bank_last4 = ${payload.payoutBankLast4 || null},
        onboard_payload = ${JSON.stringify(payload)}::jsonb,
        onboard_status = ${"complete"}
    where id = ${inv.operator_id}
  `;
  await sql`
    update operator_invites set completed_at = now() where id = ${inv.id}
  `;
  if (userId) {
    try {
      await attachVendorMembership(userId, inv.org_id, inv.operator_id, inv.email);
    } catch {
      /* membership optional if email mismatch already thrown earlier */
    }
  }
  await writeAudit({
    orgId: inv.org_id,
    actorUserId: userId,
    action: "tenant_onboard_complete",
    payload: { operatorId: inv.operator_id },
  });
  await notifyHostTenantComplete(inv.org_id, dba);
  return { ok: true };
}

async function applyVars(template: string, vars: Record<string, string>): Promise<string> {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v);
  return out;
}

async function brandVars(orgId: string): Promise<Record<string, string>> {
  const sql = await getSql();
  const org = await sql<{ name: string; dba: string | null; billing_email: string | null; owner_contact_name: string | null }>`
    select name, dba, billing_email, owner_contact_name from organizations where id = ${orgId} limit 1
  `;
  const [comms, general] = await Promise.all([loadCommunicationsSettings(), loadGeneral()]);
  return {
    platformName: general.displayName || PRODUCT_NAME,
    fromName: comms.fromName || PRODUCT_NAME,
    supportEmail: general.supportEmail || "support@summex.app",
    hostBrand: org[0]?.dba || org[0]?.name || "Host",
    ownerName: org[0]?.owner_contact_name || org[0]?.name || "there",
    hostEmail: org[0]?.billing_email || "",
  };
}

async function sendTenantInviteEmail(opts: {
  to: string;
  pocName: string;
  tenantName: string;
  orgId: string;
  inviteUrl: string;
  days: number;
}): Promise<string> {
  const comms = await loadCommunicationsSettings();
  const vars = {
    ...(await brandVars(opts.orgId)),
    pocName: opts.pocName,
    tenantName: opts.tenantName,
    inviteUrl: opts.inviteUrl,
    expiryDays: String(opts.days),
  };
  const subject = await applyVars(comms.tenantInviteSubject, vars);
  const text = await applyVars(comms.tenantInviteBody, vars);
  const res = await sendEmail({
    to: opts.to,
    subject,
    text,
    kind: "tenant_invite",
  });
  return res.status;
}

async function sendTenantInviteSms(opts: {
  to: string;
  tenantName: string;
  orgId: string;
  locationId: string | null;
  inviteUrl: string;
}): Promise<string> {
  try {
    const { sendSms } = await import("@/lib/front/messaging.server");
    const vars = await brandVars(opts.orgId);
    const r = await sendSms({
      to: opts.to,
      body: `You're invited to complete onboarding for ${opts.tenantName} at ${vars.hostBrand}. ${opts.inviteUrl}`,
      kind: "tenant_invite",
      locationId: opts.locationId,
    });
    if (!r.ok) return "blocked";
    return r.provider === "sandbox" ? "logged_only" : "sent";
  } catch (err) {
    console.warn("[tenant-sms]", err);
    return "failed";
  }
}

async function notifyHostTenantComplete(orgId: string, tenantName: string): Promise<void> {
  const comms = await loadCommunicationsSettings();
  const vars: Record<string, string> = { ...(await brandVars(orgId)), tenantName };
  const to = vars.hostEmail ?? "";
  if (!to || !to.includes("@")) return;
  const subject = await applyVars(comms.tenantCompleteSubject, vars);
  const text = await applyVars(comms.tenantCompleteBody, vars);
  await sendEmail({ to, subject, text, kind: "tenant_complete_host" });
}

export async function emailHostReady(orgId: string): Promise<void> {
  const sql = await getSql();
  const multi = await sql<{ n: number }>`
    select count(*)::int as n from locations
    where org_id = ${orgId} and operating_model in ('host_operators', 'peer_venue')
  `;
  if (!Number(multi[0]?.n)) return;
  const settings = await loadOnboardingSettings();
  if (!settings.autoEmailOwnerInviteOnGoLive) return;
  const comms = await loadCommunicationsSettings();
  const vars = await brandVars(orgId);
  const to = vars.hostEmail;
  if (!to || !to.includes("@")) return;
  const subject = await applyVars(comms.hostReadySubject, vars);
  const text = await applyVars(comms.hostReadyBody, vars);
  await sendEmail({ to, subject, text, kind: "host_ready" });
}

export async function markOrgHostReady(orgId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update organizations set host_status = ${"host_ready"}
    where id = ${orgId} and host_status = ${"onboarding"}
  `;
  try {
    const payments = await loadPaymentsSettings();
    await sql`
      update organizations
      set payments_mode = coalesce(payments_mode, ${payments.quantumPaymentsMode}),
          chargeback_fee_cents = coalesce(chargeback_fee_cents, ${payments.chargebackFeeCents})
      where id = ${orgId}
    `;
  } catch {
    /* settings optional */
  }
}

export { hashToken };
