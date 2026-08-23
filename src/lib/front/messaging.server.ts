import { getSql } from "@/lib/db";
import { appPublicUrl } from "@/lib/saas/flags";
import { newId } from "@/lib/saas/ids";

function readEnv(key: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function optOutUrl(token: string): string {
  const base = (appPublicUrl() || "https://www.summex.app").replace(/\/$/, "");
  return `${base}/waitlist/opt-out/${encodeURIComponent(token)}`;
}

async function logMessage(row: {
  channel: "sms" | "email";
  to: string;
  subject?: string;
  body: string;
  provider: string;
  kind: string;
  locationId?: string | null;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into message_log (
      id, channel, to_addr, subject, body, provider, kind, location_id
    )
    values (
      ${newId("msg")},
      ${row.channel},
      ${row.to},
      ${row.subject ?? null},
      ${row.body},
      ${row.provider},
      ${row.kind},
      ${row.locationId ?? null}
    )
  `;
}

export async function sendSms(opts: {
  to: string;
  body: string;
  kind: string;
  locationId?: string | null;
  from?: string | null;
}): Promise<{ ok: true; provider: string }> {
  const sid = readEnv("TWILIO_ACCOUNT_SID");
  const token = readEnv("TWILIO_AUTH_TOKEN");
  const from = opts.from || readEnv("TWILIO_FROM_NUMBER");
  if (sid && token && from) {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: opts.to, From: from, Body: opts.body }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SMS failed: ${text.slice(0, 180)}`);
    }
    await logMessage({
      channel: "sms",
      to: opts.to,
      body: opts.body,
      provider: "twilio",
      kind: opts.kind,
      locationId: opts.locationId,
    });
    return { ok: true, provider: "twilio" };
  }
  await logMessage({
    channel: "sms",
    to: opts.to,
    body: opts.body,
    provider: "sandbox",
    kind: opts.kind,
    locationId: opts.locationId,
  });
  console.info("[sms:sandbox]", opts.kind, opts.to, opts.body);
  return { ok: true, provider: "sandbox" };
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  kind: string;
  locationId?: string | null;
}): Promise<{ ok: true; provider: string }> {
  const key = readEnv("RESEND_API_KEY");
  const from = readEnv("RESEND_FROM") || "Summex <noreply@summex.app>";
  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.body,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Email failed: ${text.slice(0, 180)}`);
    }
    await logMessage({
      channel: "email",
      to: opts.to,
      subject: opts.subject,
      body: opts.body,
      provider: "resend",
      kind: opts.kind,
      locationId: opts.locationId,
    });
    return { ok: true, provider: "resend" };
  }
  await logMessage({
    channel: "email",
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    provider: "sandbox",
    kind: opts.kind,
    locationId: opts.locationId,
  });
  console.info("[email:sandbox]", opts.kind, opts.to, opts.subject);
  return { ok: true, provider: "sandbox" };
}

export async function listRecentMessages(
  locationId: string,
  limit = 20,
): Promise<
  Array<{
    id: string;
    channel: string;
    to: string;
    subject: string | null;
    body: string;
    provider: string;
    kind: string;
    createdAt: string;
  }>
> {
  const sql = await getSql();
  const cap = Math.min(40, Math.max(1, limit));
  const rows = await sql<{
    id: string;
    channel: string;
    to_addr: string;
    subject: string | null;
    body: string;
    provider: string;
    kind: string;
    created_at: unknown;
  }>`
    select id, channel, to_addr, subject, body, provider, kind, created_at
    from message_log
    where location_id = ${locationId}
    order by created_at desc
    limit ${cap}
  `;
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    to: r.to_addr,
    subject: r.subject,
    body: r.body,
    provider: r.provider,
    kind: r.kind,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  }));
}
