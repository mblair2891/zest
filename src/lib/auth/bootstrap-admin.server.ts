/**
 * First-run bootstrap of the single SaaS platform admin.
 * Server-only — never import from client code.
 *
 * Username shown in the login form: Admin
 * Email stored in Better Auth: admin@summex.local
 * Initial password is hashed with Better Auth's hasher before insert.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { PLATFORM_ADMIN_EMAIL as ADMIN_EMAIL, PLATFORM_ADMIN_USERNAME } from "@/lib/platform/brand";

export const PLATFORM_ADMIN_EMAIL = ADMIN_EMAIL;
export const PLATFORM_ADMIN_NAME = PLATFORM_ADMIN_USERNAME;
const LEGACY_ADMIN_EMAIL = "admin@zest.local";

/** Initial bootstrap password. Server-only. Never ship in a client bundle. */
const INITIAL_PASSWORD = "password";

const globalRef = globalThis as typeof globalThis & {
  __summexPlatformAdminBoot__?: Promise<void>;
};

function dbNotReady(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /database not ready/i.test(msg) ||
    /relation .* does not exist/i.test(msg) ||
    /does not exist/i.test(msg) ||
    /ENOENT|pglite/i.test(msg) ||
    /ECONNREFUSED|ENOTFOUND|connection refused|timeout/i.test(msg)
  ) {
    return new Error("Database not ready");
  }
  return err instanceof Error ? err : new Error(msg);
}

export async function ensurePlatformAdmin(): Promise<void> {
  globalRef.__summexPlatformAdminBoot__ ??= (async () => {
    const sql = await getSql();
    try {
      await sql`select 1 as n from "user" limit 1`;
    } catch (err) {
      throw dbNotReady(err);
    }

    const existing = await sql<{ id: string }>`
      select id from "user"
      where email = ${PLATFORM_ADMIN_EMAIL} or email = ${LEGACY_ADMIN_EMAIL}
      limit 1
    `;
    let userId = existing[0]?.id;
    const now = new Date().toISOString();
    if (!userId) {
      userId = randomUUID();
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
    } else {
      const accounts = await sql<{ id: string; password: string | null }>`
        select id, password from "account"
        where "userId" = ${userId} and "providerId" = ${"credential"}
        limit 1
      `;
      if (!accounts[0]) {
        const hashed = await hashPassword(INITIAL_PASSWORD);
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
    }

    try {
      await sql`
        insert into platform_admin (user_id, must_change_password)
        values (${userId}, ${true})
        on conflict (user_id) do nothing
      `;
    } catch (err) {
      throw dbNotReady(err);
    }

    const mem = await sql<{ id: string }>`
      select id from memberships
      where user_id = ${userId} and role = ${"platform_admin"} and status = ${"active"}
      limit 1
    `;
    if (!mem[0]) {
      await sql`
        insert into memberships (id, user_id, org_id, role, status)
        values (${randomUUID()}, ${userId}, ${null}, ${"platform_admin"}, ${"active"})
      `;
    }
  })().catch((err) => {
    globalRef.__summexPlatformAdminBoot__ = undefined;
    throw dbNotReady(err);
  });
  return globalRef.__summexPlatformAdminBoot__;
}

/** After a factory wipe: ensure Admin exists, password is the bootstrap secret, must-change is on. */
export async function reseedPlatformAdminBootstrap(): Promise<{ userId: string }> {
  globalRef.__summexPlatformAdminBoot__ = undefined;
  await ensurePlatformAdmin();
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from "user"
    where email = ${PLATFORM_ADMIN_EMAIL} or email = ${LEGACY_ADMIN_EMAIL}
    limit 1
  `;
  const userId = existing[0]?.id;
  if (!userId) throw new Error("Admin bootstrap failed");
  const hashed = await hashPassword(INITIAL_PASSWORD);
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
  } else {
    await sql`
      insert into "account" (
        id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
      )
      values (
        ${randomUUID()}, ${userId}, ${"credential"}, ${userId}, ${hashed}, ${now}, ${now}
      )
    `;
  }
  await sql`
    insert into platform_admin (user_id, must_change_password)
    values (${userId}, ${true})
    on conflict (user_id) do update set must_change_password = ${true}
  `;
  const mem = await sql<{ id: string }>`
    select id from memberships
    where user_id = ${userId} and role = ${"platform_admin"} and status = ${"active"}
      and org_id is null
    limit 1
  `;
  if (!mem[0]) {
    await sql`
      insert into memberships (id, user_id, org_id, role, status)
      values (${randomUUID()}, ${userId}, ${null}, ${"platform_admin"}, ${"active"})
    `;
  }
  return { userId };
}
