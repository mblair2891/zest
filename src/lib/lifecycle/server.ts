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
  return { ok: true as const };
}
