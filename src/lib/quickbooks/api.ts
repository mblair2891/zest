import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import type { QboOverview, QboSyncResult } from "./types";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

function entityId(raw: unknown): string {
  return String(raw ?? "").trim().slice(0, 80);
}

function connectionId(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Company is required");
  return s;
}

function businessDate(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Pick a business date.");
  return s;
}

function originOf(raw: unknown): string {
  return String(raw ?? "").trim().slice(0, 200);
}

export const qboOverviewFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string }) => ({ locationId: loc(d.locationId) }))
  .handler(async ({ context, data }): Promise<QboOverview> => {
    const { qboOverview } = await import("./sync.server");
    return qboOverview(context.userId, data.locationId);
  });

export const qboStartOAuthFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; entityId?: string; origin?: string }) => ({
    locationId: loc(d.locationId),
    entityId: entityId(d.entityId),
    origin: originOf(d.origin),
  }))
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const { beginOAuth } = await import("./sync.server");
    return beginOAuth({
      userId: context.userId,
      locationId: data.locationId,
      entityId: data.entityId,
      origin: data.origin,
    });
  });

export const qboConnectTestFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; entityId?: string }) => ({
    locationId: loc(d.locationId),
    entityId: entityId(d.entityId),
  }))
  .handler(async ({ context, data }): Promise<{ ok: true; message: string }> => {
    const { connectTestCompany } = await import("./sync.server");
    return connectTestCompany({
      userId: context.userId,
      locationId: data.locationId,
      entityId: data.entityId,
    });
  });

export const qboDisconnectFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; connectionId?: string }) => ({
    locationId: loc(d.locationId),
    connectionId: connectionId(d.connectionId),
  }))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { disconnectQbo } = await import("./sync.server");
    await disconnectQbo(context.userId, data.locationId, data.connectionId);
    return { ok: true };
  });

export const qboSaveMapFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      locationId?: string;
      connectionId?: string;
      maps?: Array<{ code?: string; qboAccountId?: string; qboAccountName?: string }>;
    }) => ({
      locationId: loc(d.locationId),
      connectionId: connectionId(d.connectionId),
      maps: (Array.isArray(d.maps) ? d.maps : []).slice(0, 40).map((row) => ({
        code: String(row?.code ?? "").slice(0, 20),
        qboAccountId: String(row?.qboAccountId ?? "").slice(0, 80),
        qboAccountName: String(row?.qboAccountName ?? "").slice(0, 120),
      })),
    }),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { saveAccountMap } = await import("./sync.server");
    await saveAccountMap({
      userId: context.userId,
      locationId: data.locationId,
      connectionId: data.connectionId,
      maps: data.maps,
    });
    return { ok: true };
  });

export const qboSaveClassMapFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      locationId?: string;
      connectionId?: string;
      maps?: Array<{ entityId?: string; classId?: string; className?: string }>;
    }) => ({
      locationId: loc(d.locationId),
      connectionId: connectionId(d.connectionId),
      maps: (Array.isArray(d.maps) ? d.maps : []).slice(0, 40).map((row) => ({
        entityId: entityId(row?.entityId),
        classId: String(row?.classId ?? "").slice(0, 80),
        className: String(row?.className ?? "").slice(0, 120),
      })),
    }),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { saveClassMap } = await import("./sync.server");
    await saveClassMap({
      userId: context.userId,
      locationId: data.locationId,
      connectionId: data.connectionId,
      maps: data.maps,
    });
    return { ok: true };
  });

export const qboSetAutoSyncFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; connectionId?: string; autoSync?: boolean }) => ({
    locationId: loc(d.locationId),
    connectionId: connectionId(d.connectionId),
    autoSync: Boolean(d.autoSync),
  }))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { setAutoSync } = await import("./sync.server");
    await setAutoSync({
      userId: context.userId,
      locationId: data.locationId,
      connectionId: data.connectionId,
      autoSync: data.autoSync,
    });
    return { ok: true };
  });

export const qboRefreshAccountsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; connectionId?: string }) => ({
    locationId: loc(d.locationId),
    connectionId: connectionId(d.connectionId),
  }))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { refreshQboAccounts } = await import("./sync.server");
    await refreshQboAccounts(context.userId, data.locationId, data.connectionId);
    return { ok: true };
  });

export const qboSyncNowFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; connectionId?: string; businessDate?: string }) => ({
    locationId: loc(d.locationId),
    connectionId: connectionId(d.connectionId),
    businessDate: businessDate(d.businessDate),
  }))
  .handler(async ({ context, data }): Promise<QboSyncResult> => {
    const { syncConnection } = await import("./sync.server");
    return syncConnection({
      userId: context.userId,
      locationId: data.locationId,
      connectionId: data.connectionId,
      businessDate: data.businessDate,
      trigger: "manual",
    });
  });

export const qboRetryFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; logId?: string }) => {
    const logId = String(d.logId ?? "").trim();
    if (!logId || logId.length > 80) throw new Error("Log entry is required");
    return { locationId: loc(d.locationId), logId };
  })
  .handler(async ({ context, data }): Promise<QboSyncResult> => {
    const { retryQboLog } = await import("./sync.server");
    return retryQboLog(context.userId, data.locationId, data.logId);
  });

/** Nightly pack for this location. Companies with auto-sync off are left alone. */
export const syncQboNightlyForLocationFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string }) => ({ locationId: loc(d.locationId) }))
  .handler(async ({ context, data }): Promise<{ results: QboSyncResult[] }> => {
    const { syncAutoLocation } = await import("./sync.server");
    return syncAutoLocation(context.userId, data.locationId);
  });
