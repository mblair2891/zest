/**
 * Server-only: provision a venue-owner login when the contract is signed.
 * Never platform admin. One-time password must change on first login.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { PLATFORM_ADMIN_EMAIL } from "@/lib/platform/brand";
import { appPublicUrl } from "./flags";
import { sendEmail } from "./email.server";
import { isPlatformAdmin } from "./tenancy.server";
import {
  consoleLoginUrl,
  generateOneTimePassword,
  subscriberInviteCopy,
  usernameFromEmail,
} from "./subscriber-login";

export type SubscriberInviteResult = {
  userId: string;
  username: string;
  sent: boolean;
};

function ownerEmail(prospect: { email: string | null; answers: { company: { billingEmail?: string } } }): string {
  const fromAnswers = (prospect.answers.company.billingEmail || "").trim().toLowerCase();
  const fromRow = (prospect.email || "").trim().toLowerCase();
  return fromAnswers.includes("@") ? fromAnswers : fromRow;
}

async function uniqueUsername(sql: Awaited<ReturnType<typeof getSql>>, email: string): Promise<string> {
  const base = usernameFromEmail(email);
  if (!base) throw new Error("A billing email is required to create the venue owner login.");
  const taken = await sql<{ user_id: string }>`
    select user_id from subscriber_logins where lower(username) = ${base} limit 1
  `;
  if (!taken[0]) return base;
  const tag = randomUUID().slice(0, 6);
  const [local, domain] = base.split("@");
  return `${(local || "owner").slice(0, 40)}+${tag}@${domain || "venue.summex.app"}`;
}

async function upsertCredential(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  password: string,
): Promise<void> {
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

export async function provisionSubscriberOwner(opts: {
  prospect: {
    id: string;
    email: string | null;
    ownerUserId: string | null;
    answers: { company: { legalName?: string; dba?: string; billingEmail?: string } };
  };
}): Promise<SubscriberInviteResult> {
  const email = ownerEmail(opts.prospect);
  if (!email.includes("@")) {
    throw new Error("Add a billing email on the quote before recording the contract.");
  }
  if (email === PLATFORM_ADMIN_EMAIL.toLowerCase() || email === "admin@summex.local") {
    throw new Error("The venue owner cannot be the platform admin account.");
  }

  const sql = await getSql();
  const existingLogin = await sql<{ user_id: string; username: string }>`
    select user_id, username from subscriber_logins where prospect_id = ${opts.prospect.id} limit 1
  `;

  let userId = existingLogin[0]?.user_id ?? opts.prospect.ownerUserId ?? null;
  if (userId && (await isPlatformAdmin(userId))) {
    throw new Error("This prospect is tied to the platform admin. Unlink it before inviting the venue owner.");
  }

  const now = new Date().toISOString();
  if (!userId) {
    const byEmail = await sql<{ id: string }>`
      select id from "user" where lower(email) = ${email} limit 1
    `;
    userId = byEmail[0]?.id ?? null;
  }
  if (userId && (await isPlatformAdmin(userId))) {
    throw new Error("That email belongs to the platform admin. Use the venue owner's email.");
  }

  if (!userId) {
    userId = randomUUID();
    const name =
      opts.prospect.answers.company.dba?.trim() ||
      opts.prospect.answers.company.legalName?.trim() ||
      email.split("@")[0] ||
      "Owner";
    await sql`
      insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
      values (${userId}, ${name}, ${email}, ${true}, ${null}, ${now}, ${now})
    `;
  }

  const username = existingLogin[0]?.username ?? (await uniqueUsername(sql, email));
  const password = generateOneTimePassword();
  await upsertCredential(sql, userId, password);

  await sql`
    insert into subscriber_logins (
      user_id, prospect_id, username, must_change_password, invite_sent_at, created_at, updated_at
    )
    values (${userId}, ${opts.prospect.id}, ${username}, ${true}, ${now}, ${now}, ${now})
    on conflict (prospect_id) do update set
      user_id = ${userId},
      username = excluded.username,
      must_change_password = true,
      invite_sent_at = ${now},
      updated_at = ${now}
  `;

  await sql`
    update prospects
    set owner_user_id = ${userId},
        email = coalesce(email, ${email}),
        updated_at = now()
    where id = ${opts.prospect.id}
  `;

  const mail = subscriberInviteCopy({
    companyName: opts.prospect.answers.company.legalName || opts.prospect.answers.company.dba || "your venue",
    username: email,
    password,
    loginUrl: consoleLoginUrl(appPublicUrl()),
  });
  let sent = false;
  try {
    const result = await sendEmail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.text
        .split("\n\n")
        .map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p).replaceAll("\n", "<br/>")}</p>`)
        .join(""),
      kind: "subscriber_owner_invite",
      prospectId: opts.prospect.id,
    });
    sent = result.status === "sent" || result.status === "logged_only";
  } catch (err) {
    console.warn("[subscriber-invite-email]", err);
  }

  return { userId, username, sent };
}

export async function resendSubscriberInvite(prospectId: string): Promise<SubscriberInviteResult> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    email: string | null;
    owner_user_id: string | null;
    answers: unknown;
  }>`
    select id, email, owner_user_id, answers from prospects where id = ${prospectId} limit 1
  `;
  if (!rows[0]) throw new Error("Prospect not found");
  const answers = (rows[0].answers && typeof rows[0].answers === "object" ? rows[0].answers : {}) as {
    company?: { legalName?: string; dba?: string; billingEmail?: string };
  };
  return provisionSubscriberOwner({
    prospect: {
      id: rows[0].id,
      email: rows[0].email,
      ownerUserId: rows[0].owner_user_id,
      answers: { company: answers.company ?? {} },
    },
  });
}

export async function subscriberMustChangePassword(userId: string): Promise<boolean> {
  const sql = await getSql();
  try {
    const rows = await sql<{ must_change_password: boolean }>`
      select must_change_password from subscriber_logins
      where user_id = ${userId}
      limit 1
    `;
    return Boolean(rows[0]?.must_change_password);
  } catch {
    return false;
  }
}

export async function clearSubscriberMustChangePassword(userId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update subscriber_logins
    set must_change_password = false, updated_at = now()
    where user_id = ${userId}
  `;
}

export async function setupPathForUser(userId: string): Promise<{
  token: string;
  status: string;
} | null> {
  const sql = await getSql();
  try {
    const rows = await sql<{ public_token: string; status: string }>`
      select p.public_token, p.status
      from subscriber_logins s
      join prospects p on p.id = s.prospect_id
      where s.user_id = ${userId}
      order by s.updated_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    if (row.status === "contracted" || row.status === "onboarding" || row.status === "training") {
      return { token: row.public_token, status: row.status };
    }
    return null;
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
