import { getSql } from "@/lib/db";
import { ForbiddenError } from "@/lib/saas/tenancy.server";
import type { KeepEraseMap } from "./types";

export async function saveLifecycleForLocation(
  userId: string,
  data: {
    orgId: string;
    locationId: string;
    lifecycleStatus?: string;
    trainingTrackInventory?: boolean;
    operatorLifecycle?: Record<string, string>;
    goLiveAt?: string | null;
    goLiveChoices?: KeepEraseMap;
  },
) {
  const { requireMembership } = await import("@/lib/saas/tenancy.server");
  await requireMembership(userId, data.orgId, ["owner", "manager", "platform_admin"], data.locationId);
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations
    where id = ${data.locationId} and org_id = ${data.orgId} and coalesce(is_demo, false) = false
    limit 1
  `;
  if (!rows[0]) throw new ForbiddenError("Location not found");
  const setup =
    rows[0].setup && typeof rows[0].setup === "object"
      ? { ...(rows[0].setup as Record<string, unknown>) }
      : {};
  if (data.lifecycleStatus) setup.lifecycleStatus = data.lifecycleStatus;
  if (data.trainingTrackInventory !== undefined) {
    setup.trainingTrackInventory = data.trainingTrackInventory;
  }
  if (data.operatorLifecycle) setup.operatorLifecycle = data.operatorLifecycle;
  if (data.goLiveAt !== undefined) setup.goLiveAt = data.goLiveAt;
  if (data.goLiveChoices) setup.goLiveChoices = data.goLiveChoices;

  const life = data.lifecycleStatus ?? setup.lifecycleStatus ?? "training";
  const track = Boolean(
    data.trainingTrackInventory ?? setup.trainingTrackInventory,
  );
  const goLiveAt = data.goLiveAt === undefined ? setup.goLiveAt : data.goLiveAt;

  try {
    await sql`
      update locations
      set setup = ${JSON.stringify(setup)}::jsonb,
          lifecycle_status = ${String(life)},
          training_track_inventory = ${track},
          go_live_at = ${goLiveAt ? String(goLiveAt) : null}
      where id = ${data.locationId}
    `;
  } catch {
    await sql`
      update locations
      set setup = ${JSON.stringify(setup)}::jsonb
      where id = ${data.locationId}
    `;
  }
  if (String(life) === "live" && data.goLiveChoices) {
    await erasePracticeOnServer(sql, data.locationId, data.goLiveChoices);
  }
  return { ok: true as const };
}

async function erasePracticeOnServer(
  sql: Awaited<ReturnType<typeof getSql>>,
  locationId: string,
  choices: KeepEraseMap,
) {
  const del = async (text: string) => {
    try {
      await sql.query(text, [locationId]);
    } catch {
      /* table may not exist yet */
    }
  };
  if (choices.orders === "erase") {
    await del("delete from pos_ticket_events where location_id = $1");
    await del(
      "delete from pos_check_items where check_id in (select id from pos_checks where location_id = $1)",
    );
    await del(
      "delete from pos_check_payments where check_id in (select id from pos_checks where location_id = $1)",
    );
    await del("delete from pos_tickets where location_id = $1");
    await del("delete from pos_table_status where location_id = $1");
    await del("delete from pos_checks where location_id = $1");
  }
  if (choices.waitlist === "erase") {
    await del("delete from waitlist_entries where location_id = $1");
    await del("delete from reservations where location_id = $1");
  }
  if (choices.gift_balances === "erase") {
    try {
      await sql.query(
        `update gift_cards set balance_cents = 0, status = case when status = 'void' then status else 'active' end
         where location_id = $1`,
        [locationId],
      );
    } catch {
      /* gift schema */
    }
  }
}
