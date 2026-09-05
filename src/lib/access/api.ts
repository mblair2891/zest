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

/**
 * First-run station pair. No login — the claim code from Devices is the capability.
 * Returns enough to prime the tablet, then PIN is identity.
 */
export const pairStationFn = createServerFn({ method: "POST" })
  .validator((d: { claimCode: string; browserDeviceId?: string }) => ({
    claimCode: String(d.claimCode ?? "")
      .replace(/[\s-]/g, "")
      .toUpperCase()
      .slice(0, 12),
    browserDeviceId: d.browserDeviceId ? String(d.browserDeviceId).trim().slice(0, 80) : "",
  }))
  .handler(async ({ data }) => {
    if (data.claimCode.length < 4) throw new Error("Enter the code from Devices");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const { deviceRoleFromFunction } = await import("@/lib/pos/device-roles");
    const { parseLocationDevices } = await import("@/lib/pos/location-devices");
    const { isVenueEntityId } = await import("@/lib/pos/entities");
    const { operatorsAsVendors } = await import("@/lib/saas/onboarding.server");
    const { ensureTrainingFloor } = await import("@/lib/pos/training-roster.server");

    type LocHit = {
      device_id: string;
      location_id: string;
      org_id: string;
      loc_name: string;
      venue_type: string;
      org_name: string;
      timezone: string;
      address: string | null;
      host_brand_name: string | null;
      operating_model: string | null;
      label: string;
      type: string;
      status: string;
      serial: string | null;
      claim_code: string | null;
      assigned_operator_id: string | null;
      assigned_function: string | null;
      last_seen_at: unknown;
    };

    let hit: LocHit | null = null;
    try {
      const rows = await sql<LocHit>`
        select d.id as device_id, d.location_id, l.org_id, l.name as loc_name, l.venue_type,
               l.timezone, l.address, l.host_brand_name, l.operating_model,
               o.name as org_name, d.label, d.type, d.status, d.serial, d.claim_code,
               d.assigned_operator_id, d.assigned_function, d.last_seen_at
        from location_devices d
        join locations l on l.id = d.location_id
        join organizations o on o.id = l.org_id
        where upper(d.claim_code) = ${data.claimCode}
          and d.status <> ${"inactive"}
        limit 2
      `;
      if (rows.length > 1) throw new Error("That code matches more than one slot. Ask the owner for a new code.");
      hit = rows[0] ?? null;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("That code")) throw e;
      /* table may be missing — fall through to setup scan */
    }

    if (!hit) {
      const locs = await sql<{
        id: string;
        org_id: string;
        name: string;
        venue_type: string;
        timezone: string;
        address: string | null;
        host_brand_name: string | null;
        operating_model: string | null;
        setup: unknown;
        org_name: string;
      }>`
        select l.id, l.org_id, l.name, l.venue_type, l.timezone, l.address,
               l.host_brand_name, l.operating_model, l.setup, o.name as org_name
        from locations l
        join organizations o on o.id = l.org_id
        where coalesce(l.status, ${"active"}) = ${"active"}
      `.catch(() => [] as Array<{
        id: string;
        org_id: string;
        name: string;
        venue_type: string;
        timezone: string;
        address: string | null;
        host_brand_name: string | null;
        operating_model: string | null;
        setup: unknown;
        org_name: string;
      }>);
      for (const loc of locs) {
        const setup =
          loc.setup && typeof loc.setup === "object" && !Array.isArray(loc.setup)
            ? (loc.setup as { locationDevices?: unknown })
            : {};
        const devices = parseLocationDevices(setup.locationDevices);
        const d = devices.find((x) => (x.claimCode || "").toUpperCase() === data.claimCode);
        if (!d || d.status === "inactive") continue;
        hit = {
          device_id: d.id,
          location_id: loc.id,
          org_id: loc.org_id,
          loc_name: loc.name,
          venue_type: loc.venue_type,
          org_name: loc.org_name,
          timezone: loc.timezone,
          address: loc.address,
          host_brand_name: loc.host_brand_name,
          operating_model: loc.operating_model,
          label: d.label,
          type: d.type,
          status: d.status,
          serial: d.serial ?? null,
          claim_code: d.claimCode ?? data.claimCode,
          assigned_operator_id: d.assignment.operatorId,
          assigned_function: d.assignment.function,
          last_seen_at: d.lastSeenAt,
        };
        break;
      }
    }

    if (!hit) throw new Error("No station slot for that code. Check Devices.");

    const device = mapDeviceRow({
      id: hit.device_id,
      location_id: hit.location_id,
      label: hit.label,
      type: hit.type,
      status: hit.status,
      serial: data.browserDeviceId || hit.serial,
      claim_code: hit.claim_code,
      assigned_operator_id: hit.assigned_operator_id,
      assigned_function: hit.assigned_function,
      last_seen_at: hit.last_seen_at,
    });
    if (!device) throw new Error("No station slot for that code. Check Devices.");

    try {
      await sql`
        update location_devices
        set serial = ${device.serial ?? null}, status = ${"online"}, last_seen_at = now(),
            claim_code = ${null}
        where id = ${device.id} and location_id = ${hit.location_id}
      `;
    } catch {
      /* optional */
    }

    const pack = await ensureTrainingFloor(hit.location_id);
    try {
      const devices = parseLocationDevices(pack.setup.locationDevices).map((d) =>
        d.id === device.id
          ? { ...d, serial: device.serial, status: "online" as const, claimCode: undefined, lastSeenAt: Date.now() }
          : d,
      );
      await sql`
        update locations
        set setup = jsonb_set(coalesce(setup, '{}'::jsonb), '{locationDevices}', ${JSON.stringify(devices)}::jsonb)
        where id = ${hit.location_id}
      `;
    } catch {
      /* optional */
    }

    const pack2 = await ensureTrainingFloor(hit.location_id);
    const operators = await operatorsAsVendors(hit.location_id);
    const venueType = isVenueEntityId(hit.venue_type) ? hit.venue_type : "food_hall";
    const station = deviceRoleFromFunction(device.assignment.function);
    const operatingModel =
      hit.operating_model === "peer_venue"
        ? ("peer_venue" as const)
        : hit.operating_model === "host_operators"
          ? ("host_operators" as const)
          : ("single" as const);
    const publish = pack2.setup.stationPublish ?? {
      version: 1,
      publishedAt: Date.now(),
      publishedByName: "Pair",
      setup: {
        menuCatalog: pack2.setup.menuCatalog,
        floorPlan: pack2.setup.floorPlan,
        locationDevices: pack2.setup.locationDevices,
        qrMode: pack2.setup.qrMode,
        qrPolicy: pack2.setup.qrPolicy,
        cashHandling: pack2.setup.cashHandling,
        cashDiscountEnabled: pack2.setup.cashDiscountEnabled,
        cashDiscountPercent: pack2.setup.cashDiscountPercent,
        cashRoundIncrement: pack2.setup.cashRoundIncrement,
        cashRoundMode: pack2.setup.cashRoundMode,
        sectionNames: pack2.setup.sectionNames,
        laborByEntity: pack2.setup.laborByEntity,
      },
    };

    return {
      pair: {
        locationId: hit.location_id,
        orgId: hit.org_id,
        locationName: hit.loc_name,
        orgName: hit.org_name,
        venueType,
        station,
        deviceId: device.id,
        claimCode: "",
      },
      org: { id: hit.org_id, name: hit.org_name, status: "active" as const },
      location: {
        id: hit.location_id,
        orgId: hit.org_id,
        name: hit.loc_name,
        venueType,
        timezone: hit.timezone || "America/Los_Angeles",
        status: "active",
        enabledPackages: [] as string[],
        createdAt: new Date().toISOString(),
        address: hit.address ?? "",
        hostBrandName: hit.host_brand_name ?? null,
        operatingModel,
        setup: pack2.setup,
        lifecycleStatus: pack2.setup.lifecycleStatus || "training",
      },
      operators,
      floorStaff: pack2.staff,
      role: "staff" as const,
      operatorId: device.assignment.operatorId === "host" ? null : device.assignment.operatorId,
      openDemo: false as const,
      trainingRoster: pack2.seededRoster || pack2.staff.some((s) => s.id.startsWith("emp_tr_")),
      publish,
    };
  });

function publishSetupSlice(setup: LocationSetup) {
  return {
    menuCatalog: setup.menuCatalog,
    floorPlan: setup.floorPlan,
    locationDevices: setup.locationDevices,
    qrMode: setup.qrMode,
    qrPolicy: setup.qrPolicy,
    cashHandling: setup.cashHandling,
    cashDiscountEnabled: setup.cashDiscountEnabled,
    cashDiscountPercent: setup.cashDiscountPercent,
    cashRoundIncrement: setup.cashRoundIncrement,
    cashRoundMode: setup.cashRoundMode,
    sectionNames: setup.sectionNames,
    laborByEntity: setup.laborByEntity,
    sharedVenueCostsCents: setup.sharedVenueCostsCents,
  };
}

export const getPairedStationFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; deviceId: string }) => ({
    locationId: loc(d.locationId),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    if (!data.deviceId) throw new Error("This tablet is not paired.");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      location_id: string;
      status: string;
      serial: string | null;
      assigned_function: string | null;
    }>`
      select id, location_id, status, serial, assigned_function
      from location_devices
      where location_id = ${data.locationId}
        and status <> ${"inactive"}
        and (id = ${data.deviceId} or serial = ${data.deviceId})
      limit 1
    `.catch(() => [] as Array<{
      id: string;
      location_id: string;
      status: string;
      serial: string | null;
      assigned_function: string | null;
    }>);
    const row = rows[0];
    if (!row) throw new Error("This tablet is not paired. Ask the owner for a new code.");
    const { operatorsAsVendors } = await import("@/lib/saas/onboarding.server");
    const { ensureTrainingFloor } = await import("@/lib/pos/training-roster.server");
    const pack = await ensureTrainingFloor(data.locationId);
    const operators = await operatorsAsVendors(data.locationId);
    const locRows = await sql<{
      org_id: string;
      name: string;
      venue_type: string;
      timezone: string;
      address: string | null;
      host_brand_name: string | null;
      operating_model: string | null;
      org_name: string;
    }>`
      select l.org_id, l.name, l.venue_type, l.timezone, l.address, l.host_brand_name,
             l.operating_model, o.name as org_name
      from locations l
      join organizations o on o.id = l.org_id
      where l.id = ${data.locationId}
      limit 1
    `;
    const locRow = locRows[0];
    if (!locRow) throw new Error("Location not found");
    const { isVenueEntityId } = await import("@/lib/pos/entities");
    const { deviceRoleFromFunction } = await import("@/lib/pos/device-roles");
    const venueType = isVenueEntityId(locRow.venue_type) ? locRow.venue_type : "food_hall";
    const operatingModel =
      locRow.operating_model === "peer_venue"
        ? ("peer_venue" as const)
        : locRow.operating_model === "host_operators"
          ? ("host_operators" as const)
          : ("single" as const);
    const station = deviceRoleFromFunction((row.assigned_function || "floor_pos") as DeviceFunction);
    const publish = pack.setup.stationPublish ?? {
      version: 1,
      publishedAt: Date.now(),
      publishedByName: "House",
      setup: publishSetupSlice(pack.setup),
    };
    return {
      pair: {
        locationId: data.locationId,
        orgId: locRow.org_id,
        locationName: locRow.name,
        orgName: locRow.org_name,
        venueType,
        station,
        deviceId: row.id,
        claimCode: "",
      },
      org: { id: locRow.org_id, name: locRow.org_name, status: "active" as const },
      location: {
        id: data.locationId,
        orgId: locRow.org_id,
        name: locRow.name,
        venueType,
        timezone: locRow.timezone || "America/Los_Angeles",
        status: "active",
        enabledPackages: [] as string[],
        createdAt: new Date().toISOString(),
        address: locRow.address ?? "",
        hostBrandName: locRow.host_brand_name ?? null,
        operatingModel,
        setup: pack.setup,
        lifecycleStatus: pack.setup.lifecycleStatus || "training",
      },
      operators,
      floorStaff: pack.staff,
      role: "staff" as const,
      operatorId: null as string | null,
      openDemo: false as const,
      trainingRoster: pack.seededRoster || pack.staff.some((s) => s.id.startsWith("emp_tr_")),
      publish,
    };
  });

export const getStationPublishFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; deviceId: string; sinceVersion?: number }) => ({
    locationId: loc(d.locationId),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
    sinceVersion: Math.max(0, Math.round(Number(d.sinceVersion) || 0)),
  }))
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const ok = await sql<{ n: number }>`
      select 1 as n from location_devices
      where location_id = ${data.locationId}
        and status <> ${"inactive"}
        and (id = ${data.deviceId} or serial = ${data.deviceId})
      limit 1
    `.catch(() => [] as Array<{ n: number }>);
    if (!ok[0]) return { upToDate: true as const, publish: null };
    const rows = await sql<{ setup: unknown }>`
      select setup from locations where id = ${data.locationId} limit 1
    `;
    const setup = rows[0]?.setup;
    const raw =
      setup && typeof setup === "object" && !Array.isArray(setup)
        ? (setup as { stationPublish?: unknown }).stationPublish
        : null;
    const rawObj = raw && typeof raw === "object" ? (raw as { version?: number; publishedAt?: number; publishedByName?: string; setup?: object }) : null;
    const publish = rawObj && Number(rawObj.version) > 0
      ? {
          version: Math.round(Number(rawObj.version)),
          publishedAt: Number(rawObj.publishedAt) || Date.now(),
          publishedByName: String(rawObj.publishedByName ?? "Owner"),
          setup: (rawObj.setup && typeof rawObj.setup === "object" ? rawObj.setup : {}) as {
            menuCatalog?: object;
            floorPlan?: object;
            locationDevices?: object[];
            qrMode?: string;
            sectionNames?: string[];
            sharedVenueCostsCents?: number;
          },
        }
      : null;
    if (!publish || publish.version <= data.sinceVersion) {
      return { upToDate: true as const, publish: null };
    }
    return { upToDate: false as const, publish };
  });

export const publishLocationFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
  }))
  .handler(async ({ context, data }) => {
    const { assertHostOrgWrite } = await import("./assert-host.server");
    await assertHostOrgWrite(context.userId, data.orgId, data.locationId);
    const { assertLocationAccess, updateLocationSetupForUser } = await import(
      "@/lib/saas/tenancy.server"
    );
    const access = await assertLocationAccess(context.userId, data.locationId);
    const prev = access.location.setup?.stationPublish;
    const version = (prev?.version ?? 0) + 1;
    const record = {
      version,
      publishedAt: Date.now(),
      publishedByName: "Owner",
      setup: publishSetupSlice(access.location.setup ?? EMPTY_LOCATION_SETUP),
    };
    await updateLocationSetupForUser(context.userId, {
      orgId: data.orgId || access.org.id,
      locationId: data.locationId,
      setup: { ...EMPTY_LOCATION_SETUP, ...access.location.setup, stationPublish: record },
    });
    return { publish: record };
  });

export const unpairLocationDeviceFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; deviceId: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
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
    const devices = prev.map((d) =>
      d.id === data.deviceId
        ? { ...d, status: "inactive" as const, serial: undefined, claimCode: undefined }
        : d,
    );
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    try {
      await sql`
        update location_devices
        set status = ${"inactive"}, serial = ${null}, claim_code = ${null}, last_seen_at = now()
        where id = ${data.deviceId} and location_id = ${data.locationId}
      `;
    } catch {
      /* optional */
    }
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    return updateLocationSetupForUser(context.userId, {
      orgId: ctx.orgId,
      locationId: data.locationId,
      setup: { ...EMPTY_LOCATION_SETUP, ...ctx.setup, locationDevices: devices } as LocationSetup,
    });
  });

export const rotateDevicePairFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; deviceId: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext, assertHostOrManageDevices } = await import(
      "./assert-entity.server"
    );
    const orgId = data.orgId || context.organizationId || "";
    const ctx = await loadEntityWriteContext(context.userId, orgId, data.locationId);
    const prev = parseLocationDevices(ctx.setup.locationDevices);
    const existing = prev.find((x) => x.id === data.deviceId);
    if (!existing) throw new Error("Device not found");
    assertHostOrManageDevices(ctx, existing.assignment.operatorId || "host");
    const code = makeClaimCode();
    const devices = prev.map((d) =>
      d.id === data.deviceId
        ? { ...d, status: "pending" as const, serial: undefined, claimCode: code }
        : d,
    );
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    try {
      await sql`
        update location_devices
        set status = ${"pending"}, serial = ${null}, claim_code = ${code}, last_seen_at = now()
        where id = ${data.deviceId} and location_id = ${data.locationId}
      `;
    } catch {
      /* optional */
    }
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    return updateLocationSetupForUser(context.userId, {
      orgId: ctx.orgId,
      locationId: data.locationId,
      setup: { ...EMPTY_LOCATION_SETUP, ...ctx.setup, locationDevices: devices } as LocationSetup,
    });
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
