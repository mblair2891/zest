import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { sendEmail } from "@/lib/saas/email.server";
import { ForbiddenError } from "@/lib/saas/tenancy.server";
import type { EntityWriteContext } from "@/lib/access/assert-entity.server";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { assertEmployerScope, canViewHrField, configOf, employerOf, featureOn } from "./access";
import { esignConfigured, sendEsignEnvelope } from "./esign";
import { packSsn, piiReady } from "./pii";
import { packetTemplateById, packetsForState, renderPacketBody } from "./packets";
import {
  parseHrConfig,
  type ApplicantStage,
  type EntityHrConfig,
  type HrApplicant,
  type HrAvailability,
  type HrEligibility,
  type HrOnboarding,
  type HrPacket,
  type HrPiiView,
  type HrTimeOff,
  type HrWriteup,
  type I9Status,
  type PacketStatus,
} from "./types";

function iso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s || null;
}

export function assertFeature(ctx: EntityWriteContext, employerId: string, key: Parameters<typeof featureOn>[2]) {
  assertEmployerScope(ctx, employerId);
  if (key === "scheduling" || key === "timeClock") return;
  if (!featureOn(ctx.setup, employerId, key)) {
    throw new ForbiddenError("This HR feature is off for the employer entity");
  }
}

export async function listApplicants(ctx: EntityWriteContext, employerId: string): Promise<HrApplicant[]> {
  assertFeature(ctx, employerId, "applicants");
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    employer_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    stage: string;
    notes: string | null;
    created_at: unknown;
  }>`
    select id, employer_id, name, email, phone, role, stage, notes, created_at
    from hr_applicants
    where location_id = ${ctx.locationId} and employer_id = ${employerId}
    order by created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    employerId: r.employer_id,
    name: r.name,
    email: r.email ?? "",
    phone: r.phone ?? "",
    role: r.role ?? "",
    stage: r.stage as ApplicantStage,
    notes: r.notes ?? "",
    createdAt: iso(r.created_at) ?? "",
  }));
}

export async function upsertApplicant(
  ctx: EntityWriteContext,
  data: {
    employerId: string;
    id?: string;
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    stage?: string;
    notes?: string;
  },
): Promise<{ id: string }> {
  assertFeature(ctx, data.employerId, "applicants");
  const sql = await getSql();
  const id = data.id || newId("hap");
  await sql`
    insert into hr_applicants (
      id, org_id, location_id, employer_id, name, email, phone, role, stage, notes, updated_at
    ) values (
      ${id}, ${ctx.orgId}, ${ctx.locationId}, ${data.employerId},
      ${data.name.trim().slice(0, 120)}, ${data.email?.trim().slice(0, 160) ?? null},
      ${data.phone?.trim().slice(0, 40) ?? null}, ${data.role?.trim().slice(0, 80) ?? null},
      ${data.stage || "applied"}, ${data.notes?.slice(0, 2000) ?? null}, now()
    )
    on conflict (id) do update set
      name = excluded.name,
      email = excluded.email,
      phone = excluded.phone,
      role = excluded.role,
      stage = excluded.stage,
      notes = excluded.notes,
      updated_at = now()
  `;
  return { id };
}

const DEFAULT_CHECKLIST = [
  { id: "offer", label: "Offer accepted" },
  { id: "i9", label: "I-9 in progress (sections dated)" },
  { id: "w4", label: "Federal W-4 collected" },
  { id: "state", label: "State withholding packet collected" },
  { id: "policies", label: "Handbook / policies acknowledged" },
  { id: "direct_deposit", label: "Direct deposit (optional)" },
];

export async function listOnboarding(ctx: EntityWriteContext, employerId: string): Promise<HrOnboarding[]> {
  assertFeature(ctx, employerId, "onboardingPackets");
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    employer_id: string;
    employee_id: string;
    employee_name: string;
    checklist: unknown;
    i9_status: string;
    i9_section1_at: unknown;
    i9_section2_at: unknown;
    i9_section3_at: unknown;
    completed_at: unknown;
  }>`
    select id, employer_id, employee_id, employee_name, checklist, i9_status,
      i9_section1_at, i9_section2_at, i9_section3_at, completed_at
    from hr_onboarding
    where location_id = ${ctx.locationId} and employer_id = ${employerId}
    order by started_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    employerId: r.employer_id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    checklist: Array.isArray(r.checklist)
      ? (r.checklist as HrOnboarding["checklist"])
      : DEFAULT_CHECKLIST.map((c) => ({ ...c, done: false })),
    i9Status: r.i9_status as I9Status,
    i9Section1At: iso(r.i9_section1_at),
    i9Section2At: iso(r.i9_section2_at),
    i9Section3At: iso(r.i9_section3_at),
    completedAt: iso(r.completed_at),
  }));
}

export async function startOnboarding(
  ctx: EntityWriteContext,
  data: { employerId: string; employeeId: string; employeeName: string },
): Promise<{ id: string }> {
  assertFeature(ctx, data.employerId, "onboardingPackets");
  const sql = await getSql();
  const id = newId("hob");
  const checklist = DEFAULT_CHECKLIST.map((c) => ({ ...c, done: false }));
  await sql`
    insert into hr_onboarding (
      id, org_id, location_id, employer_id, employee_id, employee_name, checklist
    ) values (
      ${id}, ${ctx.orgId}, ${ctx.locationId}, ${data.employerId},
      ${data.employeeId}, ${data.employeeName.slice(0, 120)}, ${JSON.stringify(checklist)}::jsonb
    )
  `;
  return { id };
}

export async function patchOnboarding(
  ctx: EntityWriteContext,
  data: {
    employerId: string;
    id: string;
    checklist?: HrOnboarding["checklist"];
    i9Status?: I9Status;
    markI9Section?: 1 | 2 | 3;
    complete?: boolean;
  },
): Promise<void> {
  assertFeature(ctx, data.employerId, "onboardingPackets");
  const sql = await getSql();
  const rows = await sql<{ i9_status: string }>`
    select i9_status from hr_onboarding
    where id = ${data.id} and location_id = ${ctx.locationId} and employer_id = ${data.employerId}
    limit 1
  `;
  if (!rows[0]) throw new ForbiddenError("Onboarding row not found");
  let i9 = (data.i9Status ?? rows[0].i9_status) as I9Status;
  const s1 = data.markI9Section === 1;
  const s2 = data.markI9Section === 2;
  const s3 = data.markI9Section === 3;
  if (s1) i9 = "section1";
  if (s2) {
    if (rows[0].i9_status === "not_started" && !s1) {
      throw new ForbiddenError("I-9 Section 1 must be completed before Section 2");
    }
    i9 = "section2";
  }
  if (s3) i9 = "reverification";
  if (data.complete && (i9 === "section2" || i9 === "complete")) i9 = "complete";
  const checklistJson = data.checklist ? JSON.stringify(data.checklist) : null;
  await sql`
    update hr_onboarding set
      checklist = case when ${checklistJson}::text is null then checklist else ${checklistJson}::jsonb end,
      i9_status = ${i9},
      i9_section1_at = case when ${s1} then now() else i9_section1_at end,
      i9_section2_at = case when ${s2} then now() else i9_section2_at end,
      i9_section3_at = case when ${s3} then now() else i9_section3_at end,
      completed_at = case when ${Boolean(data.complete)} then now() else completed_at end
    where id = ${data.id} and location_id = ${ctx.locationId}
  `;
}

export async function listPackets(ctx: EntityWriteContext, employerId: string): Promise<HrPacket[]> {
  assertFeature(ctx, employerId, "onboardingPackets");
  const hideDocs = !canViewHrField(ctx, employerId, "documents") && !ctx.isPlatformAdmin;
  if (hideDocs && ctx.role !== "owner" && ctx.role !== "manager" && ctx.operatorId !== employerId) {
    return [];
  }
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    employer_id: string;
    employee_id: string | null;
    employee_name: string;
    employee_email: string | null;
    template_id: string;
    state: string;
    title: string;
    status: string;
    provider: string | null;
    sent_at: unknown;
    signed_at: unknown;
    counter_signed_at: unknown;
    expires_at: unknown;
    file_name: string | null;
  }>`
    select id, employer_id, employee_id, employee_name, employee_email, template_id, state, title,
      status, provider, sent_at, signed_at, counter_signed_at, expires_at, file_name
    from hr_packets
    where location_id = ${ctx.locationId} and employer_id = ${employerId}
    order by created_at desc
  `;
  const esign = esignConfigured();
  return rows.map((r) => ({
    id: r.id,
    employerId: r.employer_id,
    employeeId: r.employee_id ?? "",
    employeeName: r.employee_name,
    employeeEmail: ctx.isPlatformAdmin ? "" : r.employee_email ?? "",
    templateId: r.template_id,
    state: r.state,
    title: r.title,
    status: r.status as PacketStatus,
    provider: r.provider,
    sentAt: iso(r.sent_at),
    signedAt: iso(r.signed_at),
    counterSignedAt: iso(r.counter_signed_at),
    expiresAt: iso(r.expires_at),
    fileName: r.file_name,
    esignConfigured: esign.ok,
  }));
}

export async function sendPacket(
  ctx: EntityWriteContext,
  data: {
    employerId: string;
    employeeId?: string;
    employeeName: string;
    employeeEmail: string;
    templateId: string;
    state: string;
    employerName: string;
    locationName: string;
  },
): Promise<{ id: string; status: PacketStatus; message: string }> {
  assertFeature(ctx, data.employerId, "onboardingPackets");
  const tmpl = packetTemplateById(data.templateId, data.state);
  if (!tmpl) throw new Error("Unknown packet template");
  const body = renderPacketBody({
    template: tmpl,
    employeeName: data.employeeName,
    employerName: data.employerName,
    locationName: data.locationName,
    state: data.state,
  });
  const esign = await sendEsignEnvelope({
    title: tmpl.title,
    body,
    signerName: data.employeeName,
    signerEmail: data.employeeEmail,
  });
  const sql = await getSql();
  const id = newId("hpk");
  const expires = new Date(Date.now() + 14 * 86400000).toISOString();
  await sql`
    insert into hr_packets (
      id, org_id, location_id, employer_id, employee_id, employee_name, employee_email,
      template_id, state, title, body, status, provider, provider_envelope_id,
      sent_at, expires_at
    ) values (
      ${id}, ${ctx.orgId}, ${ctx.locationId}, ${data.employerId},
      ${data.employeeId ?? null}, ${data.employeeName.slice(0, 120)},
      ${data.employeeEmail.slice(0, 160)}, ${tmpl.id}, ${data.state.toUpperCase().slice(0, 2)},
      ${tmpl.title}, ${body}, ${esign.status}, ${esign.provider}, ${esign.envelopeId},
      now(), ${expires}
    )
  `;
  if (data.employeeEmail.includes("@")) {
    await sendEmail({
      to: data.employeeEmail,
      subject: `${tmpl.title} — ${data.employerName}`,
      text: `${body}\n\n${esign.message}`,
      kind: "hr_packet",
    });
  }
  return { id, status: esign.status, message: esign.message };
}

export async function packetOutbox(
  ctx: EntityWriteContext,
  data: { employerId: string; id: string },
): Promise<{ title: string; body: string; status: PacketStatus; fileName: string | null }> {
  assertFeature(ctx, data.employerId, "onboardingPackets");
  if (ctx.isPlatformAdmin) {
    throw new ForbiddenError("Platform support cannot download tax or identity packets");
  }
  if (!canViewHrField(ctx, data.employerId, "documents")) {
    throw new ForbiddenError("Not allowed to view employment documents");
  }
  const sql = await getSql();
  const rows = await sql<{
    title: string;
    body: string | null;
    status: string;
    file_name: string | null;
  }>`
    select title, body, status, file_name from hr_packets
    where id = ${data.id} and location_id = ${ctx.locationId} and employer_id = ${data.employerId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Packet not found");
  return {
    title: row.title,
    body: row.body ?? "",
    status: row.status as PacketStatus,
    fileName: row.file_name,
  };
}

export async function markPacket(
  ctx: EntityWriteContext,
  data: {
    employerId: string;
    id: string;
    action: "viewed" | "signed" | "counter_sign" | "upload";
    fileName?: string;
  },
): Promise<void> {
  assertFeature(ctx, data.employerId, "onboardingPackets");
  const sql = await getSql();
  if (data.action === "viewed") {
    await sql`update hr_packets set status = 'viewed', viewed_at = now() where id = ${data.id} and location_id = ${ctx.locationId} and status in ('sent','viewed')`;
  } else if (data.action === "signed") {
    await sql`update hr_packets set status = 'signed', signed_at = now() where id = ${data.id} and location_id = ${ctx.locationId}`;
  } else if (data.action === "counter_sign") {
    await sql`update hr_packets set counter_signed_at = now(), status = 'signed' where id = ${data.id} and location_id = ${ctx.locationId}`;
  } else if (data.action === "upload") {
    await sql`
      update hr_packets
      set status = 'signed', signed_at = now(), file_name = ${data.fileName?.slice(0, 180) ?? "signed.pdf"}, file_kind = 'application/pdf'
      where id = ${data.id} and location_id = ${ctx.locationId}
    `;
  }
}

export async function listTimeOff(ctx: EntityWriteContext, employerId: string): Promise<HrTimeOff[]> {
  assertFeature(ctx, employerId, "timeOff");
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    employer_id: string;
    employee_id: string;
    employee_name: string;
    kind: string;
    start_at: unknown;
    end_at: unknown;
    status: string;
    notes: string | null;
  }>`
    select id, employer_id, employee_id, employee_name, kind, start_at, end_at, status, notes
    from hr_time_off
    where location_id = ${ctx.locationId} and employer_id = ${employerId}
    order by start_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    employerId: r.employer_id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    kind: r.kind,
    startAt: iso(r.start_at) ?? "",
    endAt: iso(r.end_at) ?? "",
    status: r.status as HrTimeOff["status"],
    notes: r.notes ?? "",
  }));
}

export async function upsertTimeOff(
  ctx: EntityWriteContext,
  data: {
    employerId: string;
    id?: string;
    employeeId: string;
    employeeName: string;
    kind: string;
    startAt: string;
    endAt: string;
    status?: HrTimeOff["status"];
    notes?: string;
  },
): Promise<{ id: string }> {
  assertFeature(ctx, data.employerId, "timeOff");
  const sql = await getSql();
  const id = data.id || newId("hto");
  await sql`
    insert into hr_time_off (
      id, org_id, location_id, employer_id, employee_id, employee_name, kind, start_at, end_at, status, notes
    ) values (
      ${id}, ${ctx.orgId}, ${ctx.locationId}, ${data.employerId}, ${data.employeeId},
      ${data.employeeName.slice(0, 120)}, ${data.kind.slice(0, 40)},
      ${data.startAt}, ${data.endAt}, ${data.status ?? "requested"}, ${data.notes?.slice(0, 500) ?? null}
    )
    on conflict (id) do update set
      status = excluded.status,
      notes = excluded.notes,
      start_at = excluded.start_at,
      end_at = excluded.end_at
  `;
  return { id };
}

export async function listWriteups(ctx: EntityWriteContext, employerId: string): Promise<HrWriteup[]> {
  assertFeature(ctx, employerId, "writeUps");
  if (!canViewHrField(ctx, employerId, "writeUps") && ctx.role !== "owner") return [];
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    employer_id: string;
    employee_id: string;
    employee_name: string;
    title: string;
    body: string;
    severity: string;
    created_at: unknown;
    created_by: string | null;
  }>`
    select id, employer_id, employee_id, employee_name, title, body, severity, created_at, created_by
    from hr_writeups
    where location_id = ${ctx.locationId} and employer_id = ${employerId}
    order by created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    employerId: r.employer_id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    title: r.title,
    body: ctx.isPlatformAdmin ? "[redacted]" : r.body,
    severity: r.severity as HrWriteup["severity"],
    createdAt: iso(r.created_at) ?? "",
    createdBy: r.created_by ?? "",
  }));
}

export async function addWriteup(
  ctx: EntityWriteContext,
  data: {
    employerId: string;
    employeeId: string;
    employeeName: string;
    title: string;
    body: string;
    severity: HrWriteup["severity"];
  },
): Promise<{ id: string }> {
  assertFeature(ctx, data.employerId, "writeUps");
  const sql = await getSql();
  const id = newId("hwu");
  await sql`
    insert into hr_writeups (
      id, org_id, location_id, employer_id, employee_id, employee_name, title, body, severity, created_by
    ) values (
      ${id}, ${ctx.orgId}, ${ctx.locationId}, ${data.employerId}, ${data.employeeId},
      ${data.employeeName.slice(0, 120)}, ${data.title.slice(0, 160)}, ${data.body.slice(0, 4000)},
      ${data.severity}, ${ctx.userId}
    )
  `;
  return { id };
}

export async function listAvailability(
  ctx: EntityWriteContext,
  employerId: string,
  employeeId: string,
): Promise<HrAvailability[]> {
  assertFeature(ctx, employerId, "availability");
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    employee_id: string;
    weekday: number;
    start_min: number;
    end_min: number;
  }>`
    select id, employee_id, weekday, start_min, end_min
    from hr_availability
    where location_id = ${ctx.locationId} and employer_id = ${employerId} and employee_id = ${employeeId}
    order by weekday, start_min
  `;
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    weekday: r.weekday,
    startMin: r.start_min,
    endMin: r.end_min,
  }));
}

export async function setAvailability(
  ctx: EntityWriteContext,
  data: { employerId: string; employeeId: string; rows: { weekday: number; startMin: number; endMin: number }[] },
): Promise<void> {
  assertFeature(ctx, data.employerId, "availability");
  const sql = await getSql();
  await sql`
    delete from hr_availability
    where location_id = ${ctx.locationId} and employee_id = ${data.employeeId}
  `;
  for (const r of data.rows.slice(0, 21)) {
    await sql`
      insert into hr_availability (
        id, org_id, location_id, employer_id, employee_id, weekday, start_min, end_min
      ) values (
        ${newId("hav")}, ${ctx.orgId}, ${ctx.locationId}, ${data.employerId}, ${data.employeeId},
        ${Math.max(0, Math.min(6, r.weekday))}, ${r.startMin}, ${r.endMin}
      )
    `;
  }
}

export async function listEligibility(ctx: EntityWriteContext, employerId: string): Promise<HrEligibility[]> {
  assertFeature(ctx, employerId, "eligibility");
  const sql = await getSql();
  const rows = await sql<{
    employee_id: string;
    minor: boolean;
    alcohol: boolean;
    notes: string | null;
  }>`
    select employee_id, minor, alcohol, notes
    from hr_eligibility
    where location_id = ${ctx.locationId} and employer_id = ${employerId}
  `;
  return rows.map((r) => ({
    employeeId: r.employee_id,
    minor: r.minor,
    alcohol: r.alcohol,
    notes: r.notes ?? "",
  }));
}

export async function setEligibility(
  ctx: EntityWriteContext,
  data: { employerId: string; employeeId: string; minor: boolean; alcohol: boolean; notes?: string },
): Promise<void> {
  assertFeature(ctx, data.employerId, "eligibility");
  const sql = await getSql();
  await sql`
    insert into hr_eligibility (location_id, employer_id, employee_id, minor, alcohol, notes, updated_at)
    values (${ctx.locationId}, ${data.employerId}, ${data.employeeId}, ${data.minor}, ${data.alcohol}, ${data.notes ?? null}, now())
    on conflict (location_id, employee_id) do update set
      minor = excluded.minor,
      alcohol = excluded.alcohol,
      notes = excluded.notes,
      updated_at = now()
  `;
}

export async function savePii(
  ctx: EntityWriteContext,
  data: { employerId: string; employeeId: string; ssn?: string; taxJson?: string },
): Promise<{ last4: string | null; error?: string }> {
  assertEmployerScope(ctx, data.employerId);
  if (ctx.isPlatformAdmin) throw new ForbiddenError("Platform support cannot write tax packets");
  if (!canViewHrField(ctx, data.employerId, "documents")) {
    throw new ForbiddenError("Not allowed to store employment documents");
  }
  const packed = packSsn(data.ssn ?? "");
  const sql = await getSql();
  const taxCipher = data.taxJson ? (await import("./pii")).encryptPii(data.taxJson) : null;
  await sql`
    insert into hr_tax_pii (location_id, employee_id, ssn_last4, ssn_cipher, tax_cipher, updated_at)
    values (${ctx.locationId}, ${data.employeeId}, ${packed.last4}, ${packed.cipher}, ${taxCipher}, now())
    on conflict (location_id, employee_id) do update set
      ssn_last4 = coalesce(excluded.ssn_last4, hr_tax_pii.ssn_last4),
      ssn_cipher = coalesce(excluded.ssn_cipher, hr_tax_pii.ssn_cipher),
      tax_cipher = coalesce(excluded.tax_cipher, hr_tax_pii.tax_cipher),
      updated_at = now()
  `;
  return { last4: packed.last4, error: packed.error };
}

export async function viewPii(
  ctx: EntityWriteContext,
  employerId: string,
  employeeId: string,
): Promise<HrPiiView> {
  assertEmployerScope(ctx, employerId);
  const sql = await getSql();
  const rows = await sql<{ ssn_last4: string | null; ssn_cipher: string | null; tax_cipher: string | null }>`
    select ssn_last4, ssn_cipher, tax_cipher from hr_tax_pii
    where location_id = ${ctx.locationId} and employee_id = ${employeeId}
    limit 1
  `;
  const row = rows[0];
  const redacted = ctx.isPlatformAdmin || !canViewHrField(ctx, employerId, "documents");
  return {
    employeeId,
    ssnLast4: redacted ? (row?.ssn_last4 ? "••••" : null) : row?.ssn_last4 ?? null,
    ssnOnFile: Boolean(row?.ssn_cipher || row?.ssn_last4),
    taxOnFile: Boolean(row?.tax_cipher),
    redacted,
  };
}

export function snapshotConfig(ctx: EntityWriteContext, employerId: string): EntityHrConfig {
  return parseHrConfig(configOf(ctx.setup, employerId));
}

export type HrPayrollRow = {
  employeeId: string;
  employeeName: string;
  scheduledHours: number;
  shiftCount: number;
};

export async function payrollSummary(
  ctx: EntityWriteContext,
  employerId: string,
): Promise<{
  rows: HrPayrollRow[];
  showWages: boolean;
  showHours: boolean;
  note: string;
}> {
  assertEmployerScope(ctx, employerId);
  if (!featureOn(ctx.setup, employerId, "payrollSummary") && !featureOn(ctx.setup, employerId, "payrollExport")) {
    throw new ForbiddenError("This HR feature is off for the employer entity");
  }
  const showHours = canViewHrField(ctx, employerId, "hours");
  const showWages = canViewHrField(ctx, employerId, "wages");
  if (!showHours && !showWages) {
    throw new ForbiddenError("Not allowed to view hours or wages for this employer");
  }
  const sql = await getSql();
  const rows = await sql<{
    employee_id: string;
    start_at: unknown;
    end_at: unknown;
  }>`
    select employee_id, start_at, end_at
    from location_shifts
    where location_id = ${ctx.locationId} and operator_id = ${employerId}
  `;
  const by = new Map<string, HrPayrollRow>();
  for (const r of rows) {
    const start = r.start_at ? new Date(r.start_at as string).getTime() : 0;
    const end = r.end_at ? new Date(r.end_at as string).getTime() : 0;
    const hours = start && end && end > start ? (end - start) / 3_600_000 : 0;
    const cur = by.get(r.employee_id) ?? {
      employeeId: r.employee_id,
      employeeName: r.employee_id,
      scheduledHours: 0,
      shiftCount: 0,
    };
    cur.scheduledHours += hours;
    cur.shiftCount += 1;
    by.set(r.employee_id, cur);
  }
  return {
    rows: [...by.values()].sort((a, b) => a.employeeId.localeCompare(b.employeeId)),
    showWages,
    showHours,
    note: "Hours from published entity shifts. Tips and wages come from Labor when visibility allows. Not a tax engine.",
  };
}

export async function saveEntityHrConfig(
  ctx: EntityWriteContext,
  data: {
    employerId: string;
    enabled?: boolean;
    employmentState?: string;
    features?: Partial<EntityHrConfig["features"]>;
    visibility?: Partial<EntityHrConfig["visibility"]>;
  },
): Promise<EntityHrConfig> {
  assertEmployerScope(ctx, data.employerId);
  if (ctx.role === "vendor" && ctx.operatorId !== data.employerId) {
    throw new ForbiddenError("You can only change HR settings for your entity");
  }
  if (ctx.role === "server" || ctx.role === "host" || ctx.role === "bartender" || ctx.role === "kitchen" || ctx.role === "cashier" || ctx.role === "staff") {
    throw new ForbiddenError("HR settings require an entity owner or manager");
  }
  const prev = configOf(ctx.setup, data.employerId);
  const next: EntityHrConfig = {
    enabled: data.enabled ?? prev.enabled,
    features: { ...prev.features, ...(data.features ?? {}) },
    visibility: { ...prev.visibility, ...(data.visibility ?? {}) },
    employmentState: parseHrConfig({
      ...prev,
      employmentState: data.employmentState ?? prev.employmentState,
    }).employmentState,
  };
  const map: Record<string, EntityHrConfig> = { ...(ctx.setup.hrByEntity ?? {}) };
  map[data.employerId] = next;
  const merged = {
    ...ctx.setup,
    employmentState: data.employmentState ?? ctx.setup.employmentState,
    hrByEntity: map,
  };
  const sql = await getSql();
  await sql`
    update locations
    set setup = ${JSON.stringify(merged)}::jsonb
    where id = ${ctx.locationId} and org_id = ${ctx.orgId}
  `;
  return next;
}

export { employerOf, packetsForState, esignConfigured, piiReady, HOST_SCOPE };

