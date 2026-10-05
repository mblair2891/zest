/**
 * Map a typed username to the Better Auth email. Server-only.
 * Does not touch passwords.
 */
import { getSql } from "@/lib/db";
import { isMissingRelationError } from "@/lib/db-errors";
import { PLATFORM_ADMIN_EMAIL } from "@/lib/platform/brand";
import { loginLookup } from "./login-identifier";

export async function resolveCredentialEmail(raw: string): Promise<string | null> {
  const lookup = loginLookup(raw);
  if (lookup.keys.length === 0) return null;
  if (lookup.platformAdmin) return PLATFORM_ADMIN_EMAIL;

  const sql = await getSql();
  const a = lookup.keys[0] ?? "";
  const b = lookup.keys[1] ?? a;
  const c = lookup.keys[2] ?? a;

  try {
    const rows = await sql<{ email: string | null }>`
      select u.email
      from "user" u
      left join subscriber_logins s on s.user_id = u.id
      where lower(u.email) in (${a}, ${b}, ${c})
         or lower(s.username) in (${a}, ${b}, ${c})
      limit 1
    `;
    const email = rows[0]?.email?.trim().toLowerCase() ?? "";
    return email.includes("@") ? email : null;
  } catch (err) {
    if (!isMissingRelationError(err)) throw err;
    const rows = await sql<{ email: string | null }>`
      select email from "user"
      where lower(email) in (${a}, ${b}, ${c})
      limit 1
    `;
    const email = rows[0]?.email?.trim().toLowerCase() ?? "";
    return email.includes("@") ? email : null;
  }
}
