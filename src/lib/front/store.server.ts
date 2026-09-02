import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { optOutUrl, sendEmail, sendSms } from "./messaging.server";
import { estimateWaitMinutes } from "./wait-estimate.server";
import {
  DEFAULT_FRONT_SETTINGS,
  WAITLIST_REASONS,
  type FrontSettings,
  type KioskMode,
  type ReservationRecord,
  type ReservationStatus,
  type WaitlistReason,
  type WaitlistRecord,
  type WaitlistStatus,
} from "./types";

function asIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function mintCheckInCode(): string {
  let s = "";
  for (let i = 0; i < 4; i += 1) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]!;
  }
  return s;
}

function parseReasons(raw: unknown): WaitlistReason[] {
  if (!Array.isArray(raw)) return [...WAITLIST_REASONS];
  return raw.filter((x): x is WaitlistReason =>
    (WAITLIST_REASONS as readonly string[]).includes(String(x)),
  );
}

function mapSettings(r: {
  location_id: string;
  kiosk_mode: string;
  waitlist_enabled: boolean;
  waitlist_reason: string | null;
  waitlist_reasons: unknown;
  sms_from: string | null;
  sms_enabled?: boolean | null;
  sms_monthly_cap?: number | null;
}): FrontSettings {
  const mode = r.kiosk_mode;
  return {
    locationId: r.location_id,
    kioskMode:
      mode === "order" || mode === "checkin" || mode === "combined"
        ? (mode as KioskMode)
        : "combined",
    waitlistEnabled: Boolean(r.waitlist_enabled),
    waitlistReason: (WAITLIST_REASONS as readonly string[]).includes(
      String(r.waitlist_reason),
    )
      ? (r.waitlist_reason as WaitlistReason)
      : null,
    waitlistReasons: parseReasons(r.waitlist_reasons),
    smsFrom: r.sms_from,
    smsEnabled: r.sms_enabled !== false,
    smsMonthlyCap:
      r.sms_monthly_cap == null || !Number.isFinite(Number(r.sms_monthly_cap))
        ? null
        : Math.max(0, Math.floor(Number(r.sms_monthly_cap))),
  };
}

function mapRes(r: {
  id: string;
  location_id: string;
  name: string;
  party_size: number;
  at: unknown;
  phone: string | null;
  email: string | null;
  check_in_code: string;
  status: string;
  table_suggestion: string | null;
  notes: string | null;
  created_at: unknown;
}): ReservationRecord {
  return {
    id: r.id,
    locationId: r.location_id,
    name: r.name,
    partySize: Number(r.party_size),
    at: asIso(r.at),
    phone: r.phone,
    email: r.email,
    checkInCode: r.check_in_code,
    status: r.status as ReservationStatus,
    tableSuggestion: r.table_suggestion,
    notes: r.notes,
    createdAt: asIso(r.created_at),
  };
}

function mapWait(r: {
  id: string;
  location_id: string;
  name: string;
  party_size: number;
  phone: string;
  quoted_minutes: number;
  status: string;
  opt_out_token: string;
  notes: string | null;
  created_at: unknown;
  notified_at: unknown;
}): WaitlistRecord {
  return {
    id: r.id,
    locationId: r.location_id,
    name: r.name,
    partySize: Number(r.party_size),
    phone: r.phone,
    quotedMinutes: Number(r.quoted_minutes),
    status: r.status as WaitlistStatus,
    optOutToken: r.opt_out_token,
    notes: r.notes,
    createdAt: asIso(r.created_at),
    notifiedAt: r.notified_at ? asIso(r.notified_at) : null,
  };
}

export async function getFrontSettings(locationId: string): Promise<FrontSettings> {
  const sql = await getSql();
  const rows = await sql<{
    location_id: string;
    kiosk_mode: string;
    waitlist_enabled: boolean;
    waitlist_reason: string | null;
    waitlist_reasons: unknown;
    sms_from: string | null;
    sms_enabled: boolean | null;
    sms_monthly_cap: number | null;
  }>`
    select * from front_settings where location_id = ${locationId} limit 1
  `;
  if (rows[0]) return mapSettings(rows[0]);
  const created: FrontSettings = { locationId, ...DEFAULT_FRONT_SETTINGS };
  await sql`
    insert into front_settings (
      location_id, kiosk_mode, waitlist_enabled, waitlist_reason, waitlist_reasons,
      sms_from, sms_enabled, sms_monthly_cap
    )
    values (
      ${locationId},
      ${created.kioskMode},
      ${created.waitlistEnabled},
      ${created.waitlistReason},
      ${JSON.stringify(created.waitlistReasons)}::jsonb,
      ${created.smsFrom},
      ${created.smsEnabled},
      ${created.smsMonthlyCap}
    )
    on conflict (location_id) do nothing
  `;
  return created;
}

export async function saveFrontSettings(
  locationId: string,
  patch: Partial<FrontSettings>,
): Promise<FrontSettings> {
  const cur = await getFrontSettings(locationId);
  const next: FrontSettings = {
    ...cur,
    ...patch,
    locationId,
  };
  const sql = await getSql();
  await sql`
    insert into front_settings (
      location_id, kiosk_mode, waitlist_enabled, waitlist_reason, waitlist_reasons,
      sms_from, sms_enabled, sms_monthly_cap, updated_at
    )
    values (
      ${locationId},
      ${next.kioskMode},
      ${next.waitlistEnabled},
      ${next.waitlistReason},
      ${JSON.stringify(next.waitlistReasons)}::jsonb,
      ${next.smsFrom},
      ${next.smsEnabled},
      ${next.smsMonthlyCap},
      now()
    )
    on conflict (location_id) do update set
      kiosk_mode = excluded.kiosk_mode,
      waitlist_enabled = excluded.waitlist_enabled,
      waitlist_reason = excluded.waitlist_reason,
      waitlist_reasons = excluded.waitlist_reasons,
      sms_from = excluded.sms_from,
      sms_enabled = excluded.sms_enabled,
      sms_monthly_cap = excluded.sms_monthly_cap,
      updated_at = now()
  `;
  return next;
}

export async function listWaitlist(locationId: string): Promise<WaitlistRecord[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    location_id: string;
    name: string;
    party_size: number;
    phone: string;
    quoted_minutes: number;
    status: string;
    opt_out_token: string;
    notes: string | null;
    created_at: unknown;
    notified_at: unknown;
  }>`
    select * from waitlist_entries
    where location_id = ${locationId}
    order by created_at asc
  `;
  return rows.map(mapWait);
}

export async function listReservations(
  locationId: string,
): Promise<ReservationRecord[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    location_id: string;
    name: string;
    party_size: number;
    at: unknown;
    phone: string | null;
    email: string | null;
    check_in_code: string;
    status: string;
    table_suggestion: string | null;
    notes: string | null;
    created_at: unknown;
  }>`
    select * from reservations
    where location_id = ${locationId}
    order by at asc
  `;
  return rows.map(mapRes);
}

export async function bookReservation(input: {
  locationId: string;
  name: string;
  partySize: number;
  at: string;
  phone?: string;
  email?: string;
  tableSuggestion?: string;
}): Promise<ReservationRecord> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Name is required");
  const party = Math.max(1, Math.min(20, Math.floor(input.partySize) || 2));
  const at = new Date(input.at);
  if (Number.isNaN(at.getTime())) throw new Error("A reservation time is required");
  const sql = await getSql();
  let code = mintCheckInCode();
  for (let i = 0; i < 6; i += 1) {
    const hit = await sql<{ id: string }>`
      select id from reservations
      where location_id = ${input.locationId} and check_in_code = ${code}
      limit 1
    `;
    if (!hit[0]) break;
    code = mintCheckInCode();
  }
  const id = newId("res");
  await sql`
    insert into reservations (
      id, location_id, name, party_size, at, phone, email, check_in_code, status, table_suggestion
    )
    values (
      ${id},
      ${input.locationId},
      ${name},
      ${party},
      ${at.toISOString()},
      ${input.phone?.trim() || null},
      ${input.email?.trim().toLowerCase() || null},
      ${code},
      ${"booked"},
      ${input.tableSuggestion ?? null}
    )
  `;
  const settings = await getFrontSettings(input.locationId);
  const when = at.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const body = `Your table at Summex is booked for ${party} on ${when}. Check-in code: ${code}. At the kiosk enter last name + this code.`;
  if (input.phone?.trim()) {
    await sendSms({
      to: input.phone.trim(),
      body,
      kind: "reservation_confirm",
      locationId: input.locationId,
      from: settings.smsFrom,
    });
  }
  if (input.email?.trim()) {
    await sendEmail({
      to: input.email.trim(),
      subject: `Reservation check-in code ${code}`,
      body,
      kind: "reservation_confirm",
      locationId: input.locationId,
    });
  }
  const rows = await sql<{
    id: string;
    location_id: string;
    name: string;
    party_size: number;
    at: unknown;
    phone: string | null;
    email: string | null;
    check_in_code: string;
    status: string;
    table_suggestion: string | null;
    notes: string | null;
    created_at: unknown;
  }>`select * from reservations where id = ${id}`;
  return mapRes(rows[0]!);
}

export async function checkInReservation(input: {
  locationId: string;
  lastName: string;
  code: string;
}): Promise<{ reservation: ReservationRecord; notice: string }> {
  const last = input.lastName.trim().toLowerCase();
  const code = input.code.trim().toUpperCase();
  if (last.length < 2 || code.length < 3) {
    throw new Error("Enter last name and check-in code");
  }
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    location_id: string;
    name: string;
    party_size: number;
    at: unknown;
    phone: string | null;
    email: string | null;
    check_in_code: string;
    status: string;
    table_suggestion: string | null;
    notes: string | null;
    created_at: unknown;
  }>`
    select * from reservations
    where location_id = ${input.locationId}
      and check_in_code = ${code}
      and status = ${"booked"}
      and at::date = now()::date
  `;
  const match = rows.find((r) => {
    const parts = r.name.trim().toLowerCase().split(/\s+/);
    const lastPart = parts[parts.length - 1] ?? "";
    return lastPart === last || r.name.trim().toLowerCase() === last;
  });
  if (!match) throw new Error("No reservation matches that name and code today");
  await sql`
    update reservations set status = ${"checked_in"} where id = ${match.id}
  `;
  const updated = { ...mapRes(match), status: "checked_in" as const };
  const table = updated.tableSuggestion ? ` Suggest table ${updated.tableSuggestion}.` : "";
  return {
    reservation: updated,
    notice: `Guest checked in: ${updated.name} · ${updated.partySize}.${table}`,
  };
}

export async function updateReservationStatus(
  id: string,
  status: ReservationStatus,
): Promise<void> {
  const sql = await getSql();
  await sql`update reservations set status = ${status} where id = ${id}`;
}

export async function joinWaitlist(input: {
  locationId: string;
  name: string;
  phone: string;
  partySize: number;
  openKitchenTickets?: number;
  openTables?: number;
  occupiedTables?: number;
}): Promise<{ entry: WaitlistRecord; estimateLabel: string; provider: string }> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (name.length < 2) throw new Error("Name is required");
  if (phone.length < 7) throw new Error("Phone is required for waitlist texts");
  const settings = await getFrontSettings(input.locationId);
  if (!settings.waitlistEnabled) throw new Error("Waitlist is not active");
  const estimate = await estimateWaitMinutes({
    locationId: input.locationId,
    settings,
    openKitchenTickets: input.openKitchenTickets,
    openTables: input.openTables,
    occupiedTables: input.occupiedTables,
  });
  const sql = await getSql();
  const id = newId("wl");
  const token = newId("wlt");
  await sql`
    insert into waitlist_entries (
      id, location_id, name, party_size, phone, quoted_minutes, status, opt_out_token
    )
    values (
      ${id},
      ${input.locationId},
      ${name},
      ${Math.max(1, Math.min(20, Math.floor(input.partySize) || 2))},
      ${phone},
      ${estimate.minutes},
      ${"waiting"},
      ${token}
    )
  `;
  const remove = optOutUrl(token);
  const sms = await sendSms({
    to: phone,
    body: `You're on the waitlist (${estimate.label}). We'll text when your table is ready. Remove yourself: ${remove}`,
    kind: "waitlist_join",
    locationId: input.locationId,
    from: settings.smsFrom,
  });
  if (!sms.ok) {
    console.info("[waitlist_join:sms]", sms.reason, input.locationId);
  }
  const rows = await sql<{
    id: string;
    location_id: string;
    name: string;
    party_size: number;
    phone: string;
    quoted_minutes: number;
    status: string;
    opt_out_token: string;
    notes: string | null;
    created_at: unknown;
    notified_at: unknown;
  }>`select * from waitlist_entries where id = ${id}`;
  return {
    entry: mapWait(rows[0]!),
    estimateLabel: estimate.label,
    provider: sms.provider,
  };
}

export async function setWaitlistStatus(
  id: string,
  status: WaitlistStatus,
): Promise<WaitlistRecord> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    location_id: string;
    name: string;
    party_size: number;
    phone: string;
    quoted_minutes: number;
    status: string;
    opt_out_token: string;
    notes: string | null;
    created_at: unknown;
    notified_at: unknown;
  }>`select * from waitlist_entries where id = ${id} limit 1`;
  const cur = rows[0];
  if (!cur) throw new Error("Waitlist guest not found");
  const notified = status === "notified" ? new Date().toISOString() : asIso(cur.notified_at);
  await sql`
    update waitlist_entries
    set status = ${status}, notified_at = ${status === "notified" ? notified : cur.notified_at}
    where id = ${id}
  `;
  const settings = await getFrontSettings(cur.location_id);
  if (status === "notified" && cur.phone) {
    const remove = optOutUrl(cur.opt_out_token);
    const ready = await sendSms({
      to: cur.phone,
      body: `Your table is ready. Come to the host stand. Remove yourself: ${remove}`,
      kind: "waitlist_ready",
      locationId: cur.location_id,
      from: settings.smsFrom,
    });
    if (!ready.ok) {
      console.info("[waitlist_ready:sms]", ready.reason, cur.location_id);
    }
  }
  return mapWait({ ...cur, status, notified_at: status === "notified" ? notified : cur.notified_at });
}

export async function optOutWaitlist(token: string): Promise<{
  name: string;
  locationId: string;
}> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    location_id: string;
    status: string;
  }>`
    select id, name, location_id, status from waitlist_entries
    where opt_out_token = ${token} limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("This waitlist link is not valid");
  if (row.status === "removed" || row.status === "seated" || row.status === "cancelled") {
    return { name: row.name, locationId: row.location_id };
  }
  await sql`
    update waitlist_entries set status = ${"removed"} where id = ${row.id}
  `;
  const phoneRows = await sql<{ phone: string }>`
    select phone from waitlist_entries where id = ${row.id} limit 1
  `;
  const phone = phoneRows[0]?.phone?.trim();
  if (phone) {
    const settings = await getFrontSettings(row.location_id);
    const opt = await sendSms({
      to: phone,
      body: "You've been removed from the waitlist. You will not receive more texts for this visit.",
      kind: "waitlist_opt_out",
      locationId: row.location_id,
      from: settings.smsFrom,
    });
    if (!opt.ok) {
      console.info("[waitlist_opt_out:sms]", opt.reason, row.location_id);
    }
  }
  return { name: row.name, locationId: row.location_id };
}

export async function ensureDemoReservation(locationId: string): Promise<ReservationRecord> {
  const sql = await getSql();
  const existing = await sql<{
    id: string;
    location_id: string;
    name: string;
    party_size: number;
    at: unknown;
    phone: string | null;
    email: string | null;
    check_in_code: string;
    status: string;
    table_suggestion: string | null;
    notes: string | null;
    created_at: unknown;
  }>`
    select * from reservations
    where location_id = ${locationId} and check_in_code = ${"K7M2"}
      and at::date = now()::date
    limit 1
  `;
  if (existing[0]) return mapRes(existing[0]);
  const at = new Date();
  at.setHours(19, 0, 0, 0);
  const id = newId("res");
  await sql`
    insert into reservations (
      id, location_id, name, party_size, at, phone, email, check_in_code, status, table_suggestion, notes
    )
    values (
      ${id},
      ${locationId},
      ${"Blair"},
      ${2},
      ${at.toISOString()},
      ${"5550100"},
      ${null},
      ${"K7M2"},
      ${"booked"},
      ${"12"},
      ${"Demo check-in"}
    )
  `;
  await getFrontSettings(locationId);
  await saveFrontSettings(locationId, {
    waitlistEnabled: true,
    kioskMode: "combined",
    waitlistReason: "at_capacity",
  });
  const rows = await sql<{
    id: string;
    location_id: string;
    name: string;
    party_size: number;
    at: unknown;
    phone: string | null;
    email: string | null;
    check_in_code: string;
    status: string;
    table_suggestion: string | null;
    notes: string | null;
    created_at: unknown;
  }>`select * from reservations where id = ${id}`;
  return mapRes(rows[0]!);
}
