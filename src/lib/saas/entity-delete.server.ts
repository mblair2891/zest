/**
 * Platform admin or location owner deletes one selling entity.
 * Training / never-live with no card history: hard delete.
 * Live or card history: archive. Sibling operators stay.
 */
import { deleteIgnoringMissing, getSql, type Sql } from "@/lib/db";
import { ForbiddenError, isPlatformAdmin } from "./tenancy.server";
import {
  deleteSellingEntity,
  stripEntityCatalog,
  type SellingEntitySnap,
  type VenueEntitySnap,
} from "./entity-delete";

async function mayDelete(userId: string, locationId: string): Promise<boolean> {
  if (await isPlatformAdmin(userId)) return true;
  const sql = await getSql();
  const rows = await sql<{ role: string }>`
    select m.role
    from memberships m
    join locations l on l.org_id = m.org_id
    where m.user_id = ${userId}
      and l.id = ${locationId}
      and m.role in ('owner', 'manager')
    limit 1
  `;
  return Boolean(rows[0]);
}

async function hasCardHistory(sql: Sql, operatorId: string): Promise<boolean> {
  try {
    const charges = await sql<{ n: string }>`
      select count(*)::text as n
      from pos_check_payments p
      join pos_check_items i on i.check_id = p.check_id
      where i.operator_id = ${operatorId}
        and p.method in ('card', 'credit', 'debit')
        and coalesce(p.sandbox, false) = false
    `;
    if (Number(charges[0]?.n ?? 0) > 0) return true;
  } catch {
    /* payments table optional until migrate */
  }
  try {
    const accts = await sql<{ n: string }>`
      select count(*)::text as n
      from payment_accounts
      where operator_id = ${operatorId}
        and coalesce(onboarding_status, '') in ('approved', 'activated', 'live')
    `;
    return Number(accts[0]?.n ?? 0) > 0;
  } catch {
    return false;
  }
}

function entityLifecycle(
  setup: Record<string, unknown>,
  column: string | null | undefined,
  operatorId: string,
): string {
  const map =
    setup.operatorLifecycle && typeof setup.operatorLifecycle === "object"
      ? (setup.operatorLifecycle as Record<string, unknown>)
      : {};
  const per = String(map[operatorId] ?? "").trim();
  const house = String(setup.lifecycleStatus ?? "").trim();
  return per || house || String(column ?? "").trim() || "training";
}

async function hardDeleteEntityRows(sql: Sql, locationId: string, id: string): Promise<void> {
  const checks = await sql<{ check_id: string }>`
    select distinct check_id from pos_check_items
    where operator_id = ${id} and location_id = ${locationId}
  `.catch(() => [] as Array<{ check_id: string }>);

  await deleteIgnoringMissing(sql, "pos_ticket_events", "operator_id = $1 and location_id = $2", [
    id,
    locationId,
  ]);
  await deleteIgnoringMissing(sql, "pos_tickets", "operator_id = $1 and location_id = $2", [
    id,
    locationId,
  ]);
  await deleteIgnoringMissing(sql, "pos_check_items", "operator_id = $1 and location_id = $2", [
    id,
    locationId,
  ]);
  for (const row of checks) {
    const left = await sql<{ n: string }>`
      select count(*)::text as n from pos_check_items where check_id = ${row.check_id}
    `.catch(() => [{ n: "1" }]);
    if (Number(left[0]?.n ?? 1) === 0) {
      await deleteIgnoringMissing(sql, "pos_checks", "id = $1 and location_id = $2", [
        row.check_id,
        locationId,
      ]);
    }
  }

  await deleteIgnoringMissing(
    sql,
    "location_devices",
    "assigned_operator_id = $1 and location_id = $2",
    [id, locationId],
  );
  await deleteIgnoringMissing(sql, "location_staff", "operator_id = $1 and location_id = $2", [
    id,
    locationId,
  ]);
  await deleteIgnoringMissing(sql, "location_shifts", "operator_id = $1 and location_id = $2", [
    id,
    locationId,
  ]);
  await deleteIgnoringMissing(sql, "location_punches", "employer_id = $1 and location_id = $2", [
    id,
    locationId,
  ]);
  for (const table of [
    "hr_tax_pii",
    "hr_eligibility",
    "hr_availability",
    "hr_writeups",
    "hr_time_off",
    "hr_packets",
    "hr_onboarding",
    "hr_applicants",
    "hr_payroll_map",
  ]) {
    await deleteIgnoringMissing(sql, table, "employer_id = $1 and location_id = $2", [
      id,
      locationId,
    ]);
  }
  await deleteIgnoringMissing(sql, "operator_invites", "operator_id = $1", [id]);
  await deleteIgnoringMissing(sql, "invites", "operator_id = $1", [id]);
  await deleteIgnoringMissing(sql, "memberships", "operator_id = $1", [id]);
  await deleteIgnoringMissing(sql, "payment_accounts", "operator_id = $1", [id]);
  await deleteIgnoringMissing(sql, "onboarding_check_items", "operator_id = $1", [id]);

  const locSetup = await sql<{ setup: unknown }>`
    select setup from locations where id = ${locationId} limit 1
  `;
  const raw = locSetup[0]?.setup;
  const setup =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  const stripped = stripEntityCatalog(setup, id);
  await sql`
    update locations set setup = ${JSON.stringify(stripped)}::jsonb where id = ${locationId}
  `;
  await sql`delete from operators where id = ${id} and location_id = ${locationId}`;
}

export async function deleteSellingEntityRecord(
  userId: string,
  opts: { locationId: string; operatorId: string; confirmName: string },
): Promise<{ ok: true; mode: "hard" | "archive" }> {
  const sql = await getSql();
  if (!(await mayDelete(userId, opts.locationId))) {
    throw new ForbiddenError("Platform admin or location owner only");
  }
  const ops = await sql<{
    id: string;
    legal_name: string;
    dba: string | null;
    archived_at: string | null;
  }>`
    select id, legal_name, dba, archived_at
    from operators
    where location_id = ${opts.locationId}
  `;
  const loc = await sql<{
    archived_at: string | null;
    lifecycle_status: string | null;
    setup: unknown;
  }>`
    select archived_at, lifecycle_status, setup from locations where id = ${opts.locationId} limit 1
  `;
  const setupRaw = loc[0]?.setup;
  const setup =
    setupRaw && typeof setupRaw === "object" && !Array.isArray(setupRaw)
      ? (setupRaw as Record<string, unknown>)
      : {};
  const venue: VenueEntitySnap = {
    archived: Boolean(loc[0]?.archived_at),
    entities: await Promise.all(
      ops.map(async (o) => {
        const cards = await hasCardHistory(sql, o.id);
        const snap: SellingEntitySnap = {
          id: o.id,
          name: (o.dba || o.legal_name || "").trim() || o.legal_name,
          lifecycle: entityLifecycle(setup, loc[0]?.lifecycle_status, o.id),
          hasCardHistory: cards,
          archived: Boolean(o.archived_at),
        };
        return snap;
      }),
    ),
  };
  const result = deleteSellingEntity(venue, opts.operatorId, opts.confirmName);
  if (!result.ok) throw new Error(result.error);
  const id = opts.operatorId;
  if (result.mode === "archive") {
    await sql`
      update operators set archived_at = now() where id = ${id} and location_id = ${opts.locationId}
    `;
    return { ok: true, mode: "archive" };
  }
  await hardDeleteEntityRows(sql, opts.locationId, id);
  return { ok: true, mode: "hard" };
}
