import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import type { LocationSetup } from "@/lib/saas/types";
import { EMPTY_LOCATION_SETUP } from "@/lib/saas/types";
import { parseLocationDevices, type LocationDevice } from "@/lib/pos/location-devices";
import {
  applyEloMsrSwipe,
  takeEloMsrSwipe,
  TEST_MSR_TRACK,
  type MsrGiftAction,
  type MsrSwipeEvent,
} from "@/lib/pos/elo-msr";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

function giftAction(raw: unknown): MsrGiftAction | undefined {
  if (raw === "load" || raw === "redeem" || raw === "balance") return raw;
  return undefined;
}

async function writeDevices(userId: string, orgId: string, locationId: string, setup: LocationSetup, devices: LocationDevice[]) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  for (const device of devices) {
    if (device.type !== "elo_msr") continue;
    try {
      await sql`
        insert into location_devices (
          id, location_id, label, type, status, serial,
          assigned_operator_id, assigned_function, last_seen_at
        )
        values (
          ${device.id}, ${locationId}, ${device.label}, ${device.type}, ${device.status},
          ${device.serial ?? null}, ${device.assignment.operatorId}, ${device.assignment.function},
          ${new Date(device.lastSeenAt || Date.now()).toISOString()}
        )
        on conflict (id) do update set
          label = excluded.label,
          type = excluded.type,
          status = excluded.status,
          last_seen_at = excluded.last_seen_at
      `;
    } catch {
      /* The setup JSON is the record the tablet reads. */
    }
  }
  const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
  await updateLocationSetupForUser(userId, {
    orgId,
    locationId,
    setup: { ...EMPTY_LOCATION_SETUP, ...setup, locationDevices: devices } as LocationSetup,
  });
}

export const recordEloMsrSwipeFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    orgId?: string;
    locationId: string;
    deviceId: string;
    raw?: string;
    giftAction?: MsrGiftAction;
    handled?: boolean;
  }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
    raw: String(d.raw ?? TEST_MSR_TRACK).slice(0, 80) || TEST_MSR_TRACK,
    giftAction: giftAction(d.giftAction),
    handled: Boolean(d.handled),
  }))
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext, assertHostOrManageDevices } = await import(
      "@/lib/access/assert-entity.server"
    );
    const orgId = data.orgId || context.organizationId || "";
    const ctx = await loadEntityWriteContext(context.userId, orgId, data.locationId);
    const prev = parseLocationDevices(ctx.setup.locationDevices);
    const existing = prev.find((d) => d.id === data.deviceId);
    if (!existing) return { ok: false as const, error: "Elo reader not found" };
    assertHostOrManageDevices(ctx, existing.assignment.operatorId || "host");
    const applied = applyEloMsrSwipe(prev, data.deviceId, data.raw, {
      giftAction: data.giftAction,
      handled: data.handled,
    });
    if (!applied.event) return { ok: false as const, error: applied.error || "Swipe was not read" };
    await writeDevices(context.userId, ctx.orgId, data.locationId, ctx.setup, applied.devices);
    const station = applied.devices.find((d) => d.id === applied.event?.stationId);
    return {
      ok: true as const,
      event: applied.event,
      stationLabel: station?.label || "Tablet",
    };
  });

export const takeEloMsrSwipeFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId?: string; locationId: string; stationId: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    stationId: String(d.stationId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }): Promise<{ ok: true; event: MsrSwipeEvent | null }> => {
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const orgId = data.orgId || context.organizationId || "";
    const ctx = await loadEntityWriteContext(context.userId, orgId, data.locationId);
    const prev = parseLocationDevices(ctx.setup.locationDevices);
    const taken = takeEloMsrSwipe(prev, data.stationId);
    if (!taken.event) return { ok: true, event: null };
    await writeDevices(context.userId, ctx.orgId, data.locationId, ctx.setup, taken.devices);
    return { ok: true, event: taken.event };
  });
