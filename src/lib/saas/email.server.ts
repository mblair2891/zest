/**
 * Server-only platform email. Never import from client bundles.
 * RESEND_API_KEY or EMAIL_API_KEY + EMAIL_FROM / RESEND_FROM.
 * Missing key → logged_only outbox row, no throw.
 */
import { getSql } from "@/lib/db";
import { readServerEnv } from "@/lib/database-url";
import { PRODUCT_NAME } from "@/lib/platform/brand";
import { newId } from "./ids";
import type { EmailOutboxRow } from "./platform-settings";

export type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text: string;
  kind: string;
  prospectId?: string | null;
};

export type SendEmailResult = {
  ok: true;
  status: "sent" | "logged_only" | "failed";
  provider: string | null;
  id: string;
};

function apiKey(): string | undefined {
  return readServerEnv("RESEND_API_KEY")?.trim() || readServerEnv("EMAIL_API_KEY")?.trim();
}

export function emailFromAddress(fromName?: string): string {
  const env = readServerEnv("EMAIL_FROM")?.trim() || readServerEnv("RESEND_FROM")?.trim();
  if (env) return env;
  const name = (fromName || PRODUCT_NAME).replace(/[<>]/g, "").trim() || PRODUCT_NAME;
  return `${name} <noreply@summex.app>`;
}

export function isEmailConfigured(): boolean {
  return Boolean(apiKey());
}

function validTo(to: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
}

async function insertOutbox(row: {
  to: string;
  subject: string;
  html: string | null;
  text: string;
  kind: string;
  status: string;
  provider: string | null;
  prospectId: string | null;
  error: string | null;
  sentAt: string | null;
}): Promise<string> {
  const id = newId("eml");
  try {
    const sql = await getSql();
    await sql`
      insert into email_outbox (
        id, to_addr, subject, html, text_body, kind, status, provider, prospect_id, error, sent_at
      )
      values (
        ${id},
        ${row.to},
        ${row.subject},
        ${row.html},
        ${row.text},
        ${row.kind},
        ${row.status},
        ${row.provider},
        ${row.prospectId},
        ${row.error},
        ${row.sentAt}
      )
    `;
  } catch (err) {
    console.warn("[email_outbox]", err);
  }
  return id;
}

export async function sendEmail(opts: SendEmailInput): Promise<SendEmailResult> {
  const to = opts.to.trim().toLowerCase();
  const subject = opts.subject.trim() || "(no subject)";
  const text = opts.text;
  const html = opts.html?.trim() || null;
  const prospectId = opts.prospectId ?? null;
  if (!validTo(to)) {
    const id = await insertOutbox({
      to: to || "invalid",
      subject,
      html,
      text,
      kind: opts.kind,
      status: "failed",
      provider: null,
      prospectId,
      error: "Invalid recipient",
      sentAt: null,
    });
    return { ok: true, status: "failed", provider: null, id };
  }

  const key = apiKey();
  if (!key) {
    const id = await insertOutbox({
      to,
      subject,
      html,
      text,
      kind: opts.kind,
      status: "logged_only",
      provider: null,
      prospectId,
      error: null,
      sentAt: null,
    });
    console.info("[email:outbox]", opts.kind, to, subject);
    return { ok: true, status: "logged_only", provider: null, id };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFromAddress(),
        to: [to],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    });
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 180);
      const id = await insertOutbox({
        to,
        subject,
        html,
        text,
        kind: opts.kind,
        status: "failed",
        provider: "resend",
        prospectId,
        error: errText,
        sentAt: null,
      });
      console.warn("[email:failed]", opts.kind, to, errText);
      return { ok: true, status: "failed", provider: "resend", id };
    }
    const id = await insertOutbox({
      to,
      subject,
      html,
      text,
      kind: opts.kind,
      status: "sent",
      provider: "resend",
      prospectId,
      error: null,
      sentAt: new Date().toISOString(),
    });
    return { ok: true, status: "sent", provider: "resend", id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send failed";
    const id = await insertOutbox({
      to,
      subject,
      html,
      text,
      kind: opts.kind,
      status: "failed",
      provider: "resend",
      prospectId,
      error: msg.slice(0, 180),
      sentAt: null,
    });
    console.warn("[email:failed]", opts.kind, to, msg);
    return { ok: true, status: "failed", provider: "resend", id };
  }
}

export async function listEmailOutbox(limit = 40): Promise<EmailOutboxRow[]> {
  const sql = await getSql();
  const cap = Math.min(80, Math.max(1, limit));
  try {
    const rows = await sql<{
      id: string;
      to_addr: string;
      subject: string;
      kind: string;
      status: string;
      provider: string | null;
      prospect_id: string | null;
      created_at: unknown;
    }>`
      select id, to_addr, subject, kind, status, provider, prospect_id, created_at
      from email_outbox
      order by created_at desc
      limit ${cap}
    `;
    return rows.map((r) => ({
      id: r.id,
      to: r.to_addr,
      subject: r.subject,
      kind: r.kind,
      status: r.status,
      provider: r.provider,
      prospectId: r.prospect_id,
      createdAt:
        r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  } catch {
    return [];
  }
}
