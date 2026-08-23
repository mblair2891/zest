#!/usr/bin/env node
/**
 * One-shot: grant platform_admin to an existing Better Auth user by email.
 * Requires DATABASE_URL (Neon/Postgres). PGLite is in-process — set
 * BOOTSTRAP_ADMIN_EMAIL instead so the first matching signup is promoted.
 *
 *   BOOTSTRAP_ADMIN_EMAIL=you@example.com npm run bootstrap:admin
 */
import pg from "pg";

const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || process.argv[2] || "")
  .trim()
  .toLowerCase();
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!email) {
  console.error("Usage: BOOTSTRAP_ADMIN_EMAIL=you@example.com npm run bootstrap:admin");
  process.exit(1);
}
if (!databaseUrl) {
  console.error(
    "[bootstrap-admin] DATABASE_URL is unset. For local PGLite, set BOOTSTRAP_ADMIN_EMAIL in the env of `npm run dev` and sign up with that email.",
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
try {
  const user = await pool.query(
    `select id, email from "user" where lower(email) = $1 limit 1`,
    [email],
  );
  const row = user.rows[0];
  if (!row) {
    console.error(`[bootstrap-admin] no user with email ${email}. Sign up first.`);
    process.exit(1);
  }
  const existing = await pool.query(
    `select id from memberships where user_id = $1 and role = 'platform_admin' and status = 'active' limit 1`,
    [row.id],
  );
  if (existing.rows[0]) {
    console.log(`[bootstrap-admin] ${email} is already platform_admin`);
    process.exit(0);
  }
  const id = `mem_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  await pool.query(
    `insert into memberships (id, user_id, org_id, role, status) values ($1, $2, null, 'platform_admin', 'active')`,
    [id, row.id],
  );
  console.log(`[bootstrap-admin] granted platform_admin to ${email} (${row.id})`);
} finally {
  await pool.end();
}
