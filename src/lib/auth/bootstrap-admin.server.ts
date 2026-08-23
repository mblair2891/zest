/**
 * First-run bootstrap of the single SaaS platform admin.
 * Server-only — never import from client code.
 *
 * Username shown in the login form: Admin
 * Email stored in Better Auth: admin@zest.local
 * Initial password is hashed with Better Auth's hasher before insert.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";

export const PLATFORM_ADMIN_EMAIL = "admin@zest.local";
export const PLATFORM_ADMIN_NAME = "Admin";

/** Initial bootstrap password. Server-only. Never ship in a client bundle. */
const INITIAL_PASSWORD = "password";

const globalRef = globalThis as typeof globalThis & {
  __zestPlatformAdminBoot__?: Promise<void>;
};

export async function ensurePlatformAdmin(): Promise<void> {
  globalRef.__zestPlatformAdminBoot__ ??= (async () => {
    const sql = await getSql();
    const existing = await sql<{ id: string }>`
      select id from "user" where email = ${PLATFORM_ADMIN_EMAIL} limit 1
    `;
    let userId = existing[0]?.id;
    if (!userId) {
      userId = randomUUID();
      const now = new Date().toISOString();
      const hashed = await hashPassword(INITIAL_PASSWORD);
      await sql`
        insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
        values (
          ${userId},
          ${PLATFORM_ADMIN_NAME},
          ${PLATFORM_ADMIN_EMAIL},
          ${true},
          ${null},
          ${now},
          ${now}
        )
      `;
      await sql`
        insert into "account" (
          id, "accountId", "providerId", "userId", password,
          "createdAt", "updatedAt"
        )
        values (
          ${randomUUID()},
          ${userId},
          ${"credential"},
          ${userId},
          ${hashed},
          ${now},
          ${now}
        )
      `;
    }
    await sql`
      insert into platform_admin (user_id, must_change_password)
      values (${userId}, ${true})
      on conflict (user_id) do nothing
    `;
  })().catch((err) => {
    globalRef.__zestPlatformAdminBoot__ = undefined;
    throw err;
  });
  return globalRef.__zestPlatformAdminBoot__;
}
