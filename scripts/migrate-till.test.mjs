import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "migrations");

async function migrationFiles() {
  return (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
}

async function applyNamed(pg, names) {
  await pg.exec(
    "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set(
    (await pg.query("select name from _migrations")).rows.map((r) => r.name),
  );
  for (const name of names) {
    if (done.has(name)) continue;
    const text = await readFile(join(migrationsDir, name), "utf8");
    await pg.transaction(async (tx) => {
      await tx.exec(text);
      await tx.query("insert into _migrations (name) values ($1)", [name]);
    });
  }
}

async function closeoutColumns(pg) {
  const rows = await pg.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'till_closeouts'
     order by column_name`,
  );
  return new Set(rows.rows.map((r) => r.column_name));
}

test("all migrations apply on an empty database", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  const files = await migrationFiles();
  await applyNamed(pg, files);
  const cols = await closeoutColumns(pg);
  assert.ok(cols.has("id"), "till_closeouts exists");
  assert.ok(cols.has("first_total_cents"));
  assert.ok(cols.has("first_over_short_cents"));
  assert.ok(cols.has("second_counted_cents"));
  assert.ok(cols.has("first_counted_cents"));
  assert.ok(cols.has("notify_sent_at_ms"));
  assert.ok(cols.has("manager_ack_by_name"));
  assert.ok(cols.has("transfers_in_cents"));
  assert.ok(cols.has("slip_print_ok"));
  const wrong = await pg.query("select to_regclass('pos_till_closeouts') as t");
  assert.equal(wrong.rows[0].t, null);
  await pg.close();
});

test("0034 applies after 0032+0033 (current prod) without dropping rows", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  const files = await migrationFiles();
  const through33 = files.filter((f) => f <= "0033_till_turn_in_slip.sql");
  await applyNamed(pg, through33);
  await pg.exec(
    `insert into till_closeouts (
       id, location_id, org_id, drawer_id, drawer_name, employee_id, employee_name, started_at_ms
     ) values ('tc_keep', 'loc_a', 'org_a', 'dr1', 'Drawer 1', 'emp1', 'Server', 1)`,
  );
  const rest = files.filter((f) => f > "0033_till_turn_in_slip.sql");
  await applyNamed(pg, rest);
  const kept = await pg.query("select id from till_closeouts where id = 'tc_keep'");
  assert.equal(kept.rows.length, 1);
  const cols = await closeoutColumns(pg);
  assert.ok(cols.has("first_total_cents"));
  assert.ok(cols.has("second_counted_cents"));
  await pg.close();
});

test("0034 is idempotent on a schema that already has the columns", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  const files = await migrationFiles();
  await applyNamed(pg, files);
  const text = await readFile(join(migrationsDir, "0034_till_two_step.sql"), "utf8");
  await pg.exec(text);
  await pg.exec(text);
  const cols = await closeoutColumns(pg);
  assert.ok(cols.has("first_total_cents"));
  const count = await pg.query("select count(*)::int as n from till_closeouts");
  assert.equal(typeof count.rows[0].n, "number");
  await pg.close();
});
