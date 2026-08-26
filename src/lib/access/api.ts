import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
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
  parseLocationDevice,
  parseLocationDevices,
  parsePrinterConfig,
  type DeviceFunction,
  type LocationDevice,
  type LocationDeviceType,
} from "@/lib/pos/location-devices";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

export const saveLocationSettingsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; setup: Partial<LocationSetup> }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    setup: (d.setup && typeof d.setup === "object" ? d.setup : {}) as Partial<LocationSetup>,
  }))
  .handler(async ({ context, data }) => {
    const { assertHostOrgWrite } = await import("./assert-host.server");
    await assertHostOrgWrite(context.userId, data.orgId, data.locationId);
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    return updateLocationSetupForUser(context.userId, {
      orgId: data.orgId,
      locationId: data.locationId,
      setup: data.setup as LocationSetup,
    });
  });

export const saveOperatorPayoutFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
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
  .middleware([tenantMiddleware])
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
  .middleware([tenantMiddleware])
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
  .middleware([tenantMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    device: {
      id?: string;
      label: string;
      type: LocationDeviceType;
      serial?: string;
      assignment: { operatorId: string; function: DeviceFunction };
      print?: unknown;
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
        print: type === "printer" ? parsePrinterConfig(d.device?.print) : undefined,
      },
    };
  })
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext, assertHostOrManageDevices } = await import(
      "./assert-entity.server"
    );
    const orgId = data.orgId || context.organizationId || "";
    const ctx = await loadEntityWriteContext(context.userId, orgId, data.locationId);
    assertHostOrManageDevices(ctx, data.device.assignment.operatorId);
    const prev = parseLocationDevices(ctx.setup.locationDevices);
    const id = data.device.id || `dev_${Math.random().toString(36).slice(2, 10)}`;
    const existing = prev.find((x) => x.id === id);
    const nextDevice = {
      id,
      locationId: data.locationId,
      label: data.device.label,
      type: data.device.type,
      status:
        existing?.status === "inactive"
          ? ("pending" as const)
          : data.device.serial
            ? ("online" as const)
            : (existing?.status ?? ("pending" as const)),
      lastSeenAt: Date.now(),
      serial: data.device.serial || existing?.serial,
      claimCode: existing?.claimCode || makeClaimCode(),
      assignment: data.device.assignment,
      print: data.device.print ?? existing?.print,
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
        status = excluded.status,
        serial = excluded.serial,
        assigned_operator_id = excluded.assigned_operator_id,
        assigned_function = excluded.assigned_function,
        last_seen_at = now()
    `;
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    return updateLocationSetupForUser(context.userId, {
      orgId: ctx.orgId,
      locationId: data.locationId,
      setup: { ...EMPTY_LOCATION_SETUP, ...ctx.setup, locationDevices: devices } as LocationSetup,
    });
  });

function mapDeviceRow(r: {
  id: string;
  location_id: string;
  label: string;
  type: string;
  status: string;
  serial: string | null;
  claim_code: string | null;
  assigned_operator_id: string | null;
  assigned_function: string | null;
  last_seen_at: unknown;
}): LocationDevice | null {
  return parseLocationDevice({
    id: r.id,
    locationId: r.location_id,
    label: r.label,
    type: r.type,
    status: r.status,
    serial: r.serial,
    claimCode: r.claim_code,
    lastSeenAt:
      r.last_seen_at instanceof Date
        ? r.last_seen_at.getTime()
        : r.last_seen_at
          ? Date.parse(String(r.last_seen_at))
          : Date.now(),
    assignment: {
      operatorId: r.assigned_operator_id || "host",
      function: r.assigned_function || "floor_pos",
    },
  });
}

export const listLocationDevicesFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
  }))
  .handler(async ({ context, data }) => {
    const { assertLocationAccess } = await import("@/lib/saas/tenancy.server");
    const access = await assertLocationAccess(context.userId, data.locationId);
    if (data.orgId && access.org.id !== data.orgId) {
      throw new Error("Location not found");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    let tableRows: LocationDevice[] = [];
    try {
      const rows = await sql<{
        id: string;
        location_id: string;
        label: string;
        type: string;
        status: string;
        serial: string | null;
        claim_code: string | null;
        assigned_operator_id: string | null;
        assigned_function: string | null;
        last_seen_at: unknown;
      }>`
        select id, location_id, label, type, status, serial, claim_code,
               assigned_operator_id, assigned_function, last_seen_at
        from location_devices
        where location_id = ${data.locationId}
        order by created_at asc
      `;
      tableRows = rows.map(mapDeviceRow).filter((d): d is LocationDevice => !!d);
    } catch {
      tableRows = [];
    }
    const setupDevices = parseLocationDevices(access.location.setup?.locationDevices);
    const byId = new Map<string, LocationDevice>();
    for (const d of setupDevices) byId.set(d.id, d);
    for (const d of tableRows) {
      const prev = byId.get(d.id);
      byId.set(d.id, { ...d, ...prev, print: prev?.print ?? d.print });
    }
    let devices = Array.from(byId.values());
    if (tableRows.length === 0 && setupDevices.length) {
      for (const d of setupDevices) {
        try {
          await sql`
            insert into location_devices (
              id, location_id, label, type, status, serial, claim_code,
              assigned_operator_id, assigned_function, last_seen_at
            )
            values (
              ${d.id}, ${data.locationId}, ${d.label}, ${d.type}, ${d.status},
              ${d.serial ?? null}, ${d.claimCode ?? null},
              ${d.assignment.operatorId}, ${d.assignment.function},
              ${new Date(d.lastSeenAt).toISOString()}
            )
            on conflict (id) do nothing
          `;
        } catch {
          /* ignore backfill races */
        }
      }
      devices = setupDevices;
    }
    const { operatorsAsVendors } = await import("@/lib/saas/onboarding.server");
    const operators = await operatorsAsVendors(data.locationId);
    return {
      devices,
      operators: operators.map((o) => ({ id: o.id, name: o.name })),
      hostName: access.location.hostBrandName || access.location.name,
    };
  });

export const deactivateLocationDeviceFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; deviceId: string; active: boolean }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
    active: Boolean(d.active),
  }))
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext, assertHostOrManageDevices } = await import(
      "./assert-entity.server"
    );
    const orgId = data.orgId || context.organizationId || "";
    const ctx = await loadEntityWriteContext(context.userId, orgId, data.locationId);
    const prev = parseLocationDevices(ctx.setup.locationDevices);
    const existing = prev.find((x) => x.id === data.deviceId);
    assertHostOrManageDevices(ctx, existing?.assignment.operatorId || "host");
    const status = data.active ? "pending" : "inactive";
    const devices = prev.map((d) =>
      d.id === data.deviceId ? { ...d, status: status as LocationDevice["status"] } : d,
    );
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    try {
      await sql`
        update location_devices
        set status = ${status}, last_seen_at = now()
        where id = ${data.deviceId} and location_id = ${data.locationId}
      `;
    } catch {
      /* table may be empty until first save */
    }
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    return updateLocationSetupForUser(context.userId, {
      orgId: ctx.orgId,
      locationId: data.locationId,
      setup: { ...EMPTY_LOCATION_SETUP, ...ctx.setup, locationDevices: devices } as LocationSetup,
    });
  });

export const claimLocationDeviceFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; claimCode: string; browserDeviceId?: string }) => ({
    locationId: loc(d.locationId),
    claimCode: String(d.claimCode ?? "")
      .replace(/[\s-]/g, "")
      .toUpperCase()
      .slice(0, 12),
    browserDeviceId: d.browserDeviceId ? String(d.browserDeviceId).trim().slice(0, 80) : "",
  }))
  .handler(async ({ context, data }) => {
    if (data.claimCode.length < 4) throw new Error("Enter the claim code from Devices");
    const { assertLocationAccess } = await import("@/lib/saas/tenancy.server");
    const access = await assertLocationAccess(context.userId, data.locationId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const setupDevices = parseLocationDevices(access.location.setup?.locationDevices);
    const byCode = (c: string) =>
      setupDevices.find((d) => (d.claimCode || "").toUpperCase() === c);
    let row: LocationDevice | null = byCode(data.claimCode) ?? null;
    try {
      const rows = await sql<{
        id: string;
        location_id: string;
        label: string;
        type: string;
        status: string;
        serial: string | null;
        claim_code: string | null;
        assigned_operator_id: string | null;
        assigned_function: string | null;
        last_seen_at: unknown;
      }>`
        select id, location_id, label, type, status, serial, claim_code,
               assigned_operator_id, assigned_function, last_seen_at
        from location_devices
        where location_id = ${data.locationId}
          and upper(claim_code) = ${data.claimCode}
        limit 1
      `;
      if (rows[0]) row = mapDeviceRow(rows[0]) ?? row;
    } catch {
      /* table may be empty */
    }
    if (!row || row.status === "inactive") throw new Error("No slot for that claim code");
    const serial = data.browserDeviceId || row.serial;
    const next: LocationDevice = {
      ...row,
      serial: serial || row.serial,
      status: "online",
      lastSeenAt: Date.now(),
    };
    const devices = setupDevices.some((d) => d.id === next.id)
      ? setupDevices.map((d) => (d.id === next.id ? { ...d, ...next, print: d.print ?? next.print } : d))
      : [next, ...setupDevices];
    try {
      await sql`
        update location_devices
        set serial = ${next.serial ?? null}, status = ${"online"}, last_seen_at = now()
        where id = ${next.id} and location_id = ${data.locationId}
      `;
    } catch {
      /* ignore */
    }
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    await updateLocationSetupForUser(context.userId, {
      orgId: access.org.id,
      locationId: data.locationId,
      setup: {
        ...EMPTY_LOCATION_SETUP,
        ...(access.location.setup ?? {}),
        locationDevices: devices,
      } as LocationSetup,
    });
    return { device: next };
  });

export const heartbeatLocationDeviceFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; deviceId: string }) => ({
    locationId: loc(d.locationId),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    if (!data.deviceId) return { ok: false as const };
    const { assertLocationAccess } = await import("@/lib/saas/tenancy.server");
    await assertLocationAccess(context.userId, data.locationId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    try {
      await sql`
        update location_devices
        set status = ${"online"}, last_seen_at = now()
        where id = ${data.deviceId} and location_id = ${data.locationId}
          and status <> ${"inactive"}
      `;
    } catch {
      return { ok: false as const };
    }
    return { ok: true as const };
  });

export const saveMenuItemFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
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
