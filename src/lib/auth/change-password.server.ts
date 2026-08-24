/**
 * Server-only platform-admin password change.
 * Updates the Better Auth credential hash and clears must_change_password
 * in one shot so the current session stays valid.
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
  if (!admin[0]) {
    throw new Error("Only the platform admin can use this page.");
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
  await sql`
    update platform_admin
    set must_change_password = false
    where user_id = ${userId}
  `;
  return { ok: true };
}
