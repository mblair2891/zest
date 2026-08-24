import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { LocationSetup } from "@/lib/saas/types";
import { EMPTY_LOCATION_SETUP } from "@/lib/saas/types";
import { SETTINGS_WRITE_MEMBERSHIP } from "./membership-map";
import {
  ENTITY_GRANT_KEYS,
  parseGrantMatrix,
  upsertGrant,
  type EntityGrantFlags,
  type EntityGrantKey,
} from "./entity-grants";
import {
  DEVICE_FUNCTIONS,
  DEVICE_TYPES,
  makeClaimCode,
  parseLocationDevices,
  type DeviceFunction,
  type LocationDeviceType,
} from "@/lib/pos/location-devices";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

export const saveLocationSettingsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; locationId: string; setup: Partial<LocationSetup> }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    setup: (d.setup && typeof d.setup === "object" ? d.setup : {}) as Partial<LocationSetup>,
  }))
  .handler(async ({ context, data }) => {
    const { assertHostOrgWrite } = await import("./assert-host.server");
    await assertHostOrgWrite(context.userId, data.orgId, data.locationId);
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    const merged: LocationSetup = { ...EMPTY_LOCATION_SETUP, ...data.setup };
    return updateLocationSetupForUser(context.userId, {
      orgId: data.orgId,
      locationId: data.locationId,
      setup: merged,
    });
  });

export const saveOperatorPayoutFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    operatorId: string;
    bankLast4: string;
    bankLabel: string;
  }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    operatorId: String(d.operatorId ?? "").trim().slice(0, 80),
    bankLast4: String(d.bankLast4 ?? "").replace(/\D/g, "").slice(-4).padStart(4, "0"),
    bankLabel: String(d.bankLabel ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { assertHostOrgWrite } = await import("./assert-host.server");
    await assertHostOrgWrite(context.userId, data.orgId, data.locationId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ setup: unknown }>`
      select setup from locations
      where id = ${data.locationId} and org_id = ${data.orgId} and coalesce(is_demo, false) = false
      limit 1
    `;
    const raw = (rows[0]?.setup ?? {}) as Record<string, unknown>;
    const prev = Array.isArray(raw.operatorPayouts)
      ? (raw.operatorPayouts as { id: string; bankLast4: string; bankLabel: string }[])
      : [];
    const next = prev.some((p) => p.id === data.operatorId)
      ? prev.map((p) =>
          p.id === data.operatorId
            ? { id: data.operatorId, bankLast4: data.bankLast4, bankLabel: data.bankLabel }
            : p,
        )
      : [...prev, { id: data.operatorId, bankLast4: data.bankLast4, bankLabel: data.bankLabel }];
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    return updateLocationSetupForUser(context.userId, {
      orgId: data.orgId,
      locationId: data.locationId,
      setup: { ...EMPTY_LOCATION_SETUP, ...raw, operatorPayouts: next } as LocationSetup,
    });
  });

export const getLocationAccessFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; locationId?: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: d.locationId ? loc(d.locationId) : null,
  }))
  .handler(async ({ context, data }) => {
    const { requireMembership } = await import("@/lib/saas/tenancy.server");
    const access = await requireMembership(
      context.userId,
      data.orgId,
      undefined,
      data.locationId,
    );
    return {
      role: access.role,
      isPlatformAdmin: access.isPlatformAdmin,
      operatorId: access.operatorId ?? null,
      canWriteSettings:
        access.isPlatformAdmin ||
        SETTINGS_WRITE_MEMBERSHIP.includes(access.role),
    };
  });

export const saveEntityPermissionsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    subjectOperatorId: string;
    targetOperatorId: string;
    patch: Partial<EntityGrantFlags>;
  }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    subjectOperatorId: String(d.subjectOperatorId ?? "").trim().slice(0, 80),
    targetOperatorId: String(d.targetOperatorId ?? "").trim().slice(0, 80),
    patch: Object.fromEntries(
      ENTITY_GRANT_KEYS.filter((k) => typeof d.patch?.[k] === "boolean").map((k) => [
        k,
        Boolean(d.patch[k]),
      ]),
    ) as Partial<EntityGrantFlags>,
  }))
  .handler(async ({ context, data }) => {
    const { assertHostOrgWrite } = await import("./assert-host.server");
    await assertHostOrgWrite(context.userId, data.orgId, data.locationId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ setup: unknown }>`
      select setup from locations
      where id = ${data.locationId} and org_id = ${data.orgId} and coalesce(is_demo, false) = false
      limit 1
    `;
    const raw = (rows[0]?.setup ?? {}) as Record<string, unknown>;
    const matrix = upsertGrant(
      parseGrantMatrix(raw.entityPermissions),
      data.subjectOperatorId,
      data.targetOperatorId,
      data.patch,
    );
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    return updateLocationSetupForUser(context.userId, {
      orgId: data.orgId,
      locationId: data.locationId,
      setup: { ...EMPTY_LOCATION_SETUP, ...raw, entityPermissions: matrix } as LocationSetup,
    });
  });

export const saveLocationDeviceFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    device: {
      id?: string;
      label: string;
      type: LocationDeviceType;
      serial?: string;
      assignment: { operatorId: string; function: DeviceFunction };
    };
  }) => {
    const type = DEVICE_TYPES.includes(d.device?.type) ? d.device.type : "other";
    const fn = DEVICE_FUNCTIONS.includes(d.device?.assignment?.function)
      ? d.device.assignment.function
      : "floor_pos";
    return {
      orgId: String(d.orgId ?? "").trim(),
      locationId: loc(d.locationId),
      device: {
        id: d.device?.id ? String(d.device.id).trim().slice(0, 80) : "",
        label: String(d.device?.label ?? "Device").trim().slice(0, 80) || "Device",
        type,
        serial: d.device?.serial ? String(d.device.serial).trim().slice(0, 80) : "",
        assignment: {
          operatorId: String(d.device?.assignment?.operatorId ?? "host").trim().slice(0, 80) || "host",
          function: fn,
        },
      },
    };
  })
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext, assertHostOrManageDevices } = await import(
      "./assert-entity.server"
    );
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    assertHostOrManageDevices(ctx, data.device.assignment.operatorId);
    const prev = parseLocationDevices(ctx.setup.locationDevices);
    const id = data.device.id || `dev_${Math.random().toString(36).slice(2, 10)}`;
    const existing = prev.find((x) => x.id === id);
    const nextDevice = {
      id,
      locationId: data.locationId,
      label: data.device.label,
      type: data.device.type,
      status: existing?.status ?? ("pending" as const),
      lastSeenAt: Date.now(),
      serial: data.device.serial || existing?.serial,
      claimCode: existing?.claimCode || makeClaimCode(),
      assignment: data.device.assignment,
    };
    const devices = existing
      ? prev.map((x) => (x.id === id ? nextDevice : x))
      : [nextDevice, ...prev];
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into location_devices (
        id, location_id, label, type, status, serial, claim_code,
        assigned_operator_id, assigned_function, last_seen_at
      )
      values (
        ${nextDevice.id}, ${data.locationId}, ${nextDevice.label}, ${nextDevice.type},
        ${nextDevice.status}, ${nextDevice.serial ?? null}, ${nextDevice.claimCode ?? null},
        ${nextDevice.assignment.operatorId}, ${nextDevice.assignment.function}, now()
      )
      on conflict (id) do update set
        label = excluded.label,
        type = excluded.type,
        serial = excluded.serial,
        assigned_operator_id = excluded.assigned_operator_id,
        assigned_function = excluded.assigned_function,
        last_seen_at = now()
    `;
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    return updateLocationSetupForUser(context.userId, {
      orgId: data.orgId,
      locationId: data.locationId,
      setup: { ...EMPTY_LOCATION_SETUP, ...ctx.setup, locationDevices: devices } as LocationSetup,
    });
  });

export const saveMenuItemFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    action: "create" | "update" | "delete" | "toggle";
    operatorId: string;
    item?: Record<string, unknown>;
  }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    action: d.action,
    operatorId: String(d.operatorId ?? "").trim().slice(0, 80),
    item: d.item && typeof d.item === "object" ? d.item : {},
  }))
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext, assertEntityResourceWrite } = await import(
      "./assert-entity.server"
    );
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const grant: EntityGrantKey = data.action === "toggle" ? "edit_menu" : "edit_menu";
    assertEntityResourceWrite(ctx, data.operatorId, grant);
    return { ok: true as const, operatorId: data.operatorId, action: data.action };
  });
