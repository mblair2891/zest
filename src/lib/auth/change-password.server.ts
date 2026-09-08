/**
 * Server-only credential password change.
 * Platform admin or venue owner (subscriber_logins). Clears must-change
 * in the same request so the current session stays valid.
 */
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";

const BOOTSTRAP_PASSWORD = "password";

export async function changePlatformAdminPasswordForUser(
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<{ ok: true }> {
  const current = input.currentPassword;
  const next = input.newPassword;
  if (!current) throw new Error("Current password is required.");
  let minLen = 8;
  try {
    const { getMinPasswordLength } = await import("@/lib/saas/platform-settings.server");
    minLen = await getMinPasswordLength();
  } catch {
    minLen = 8;
  }
  if (next.length < minLen) {
    throw new Error(`New password must be at least ${minLen} characters.`);
  }
  if (next.toLowerCase() === BOOTSTRAP_PASSWORD) {
    throw new Error(
      "Choose a password other than the initial bootstrap password.",
    );
  }
  if (next === current) {
    throw new Error("New password must be different from the current password.");
  }

  const sql = await getSql();
  const admin = await sql<{ user_id: string }>`
    select user_id from platform_admin
    where user_id = ${userId}
    limit 1
  `;
  let subscriber = false;
  if (!admin[0]) {
    try {
      const rows = await sql<{ user_id: string }>`
        select user_id from subscriber_logins where user_id = ${userId} limit 1
      `;
      subscriber = Boolean(rows[0]);
    } catch {
      subscriber = false;
    }
    if (!subscriber) {
      throw new Error("This login does not require a password change.");
    }
  }

  const accounts = await sql<{ id: string; password: string | null }>`
    select id, password from "account"
    where "userId" = ${userId} and "providerId" = ${"credential"}
    limit 1
  `;
  const account = accounts[0];
  if (!account?.password) {
    throw new Error("No password is set on this account.");
  }

  const matches = await verifyPassword({
    hash: account.password,
    password: current,
  });
  if (!matches) {
    throw new Error("Current password is incorrect.");
  }

  const hashed = await hashPassword(next);
  const now = new Date().toISOString();
  await sql`
    update "account"
    set password = ${hashed}, "updatedAt" = ${now}
    where id = ${account.id} and "userId" = ${userId}
  `;
  if (admin[0]) {
    await sql`
      update platform_admin
      set must_change_password = false
      where user_id = ${userId}
    `;
  } else {
    const { clearSubscriberMustChangePassword } = await import(
      "@/lib/saas/subscriber-login.server"
    );
    await clearSubscriberMustChangePassword(userId);
  }
  return { ok: true };
}
