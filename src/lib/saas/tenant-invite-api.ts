import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { parseTenantKind, type TenantKind } from "./tenant-invite";

export const listTenantSlotsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; locationId?: string | null }) => ({
    orgId: String(d.orgId ?? ""),
    locationId: d.locationId ? String(d.locationId) : null,
  }))
  .handler(async ({ context, data }) => {
    const { listTenantSlots } = await import("./tenant-invite.server");
    return listTenantSlots(context.userId, data.orgId, data.locationId);
  });

export const addTenantSlotFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    displayName: string;
    stationKind: string;
    pocName: string;
    email: string;
    phone: string;
  }) => ({
    orgId: String(d.orgId ?? ""),
    locationId: String(d.locationId ?? ""),
    displayName: String(d.displayName ?? "").trim(),
    stationKind: parseTenantKind(d.stationKind),
    pocName: String(d.pocName ?? "").trim(),
    email: String(d.email ?? "").trim(),
    phone: String(d.phone ?? "").trim(),
  }))
  .handler(async ({ context, data }) => {
    const { addTenantSlot } = await import("./tenant-invite.server");
    return addTenantSlot(context.userId, data);
  });

export const generateTenantInviteFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { operatorId: string; email?: boolean; sms?: boolean }) => ({
    operatorId: String(d.operatorId ?? ""),
    email: d.email !== false,
    sms: Boolean(d.sms),
  }))
  .handler(async ({ context, data }) => {
    const { generateTenantInvite } = await import("./tenant-invite.server");
    return generateTenantInvite(context.userId, data.operatorId, {
      email: data.email,
      sms: data.sms,
    });
  });

export const revokeTenantInviteFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { operatorId: string }) => ({
    operatorId: String(d.operatorId ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { revokeTenantInvite } = await import("./tenant-invite.server");
    await revokeTenantInvite(context.userId, data.operatorId);
    return { ok: true as const };
  });

export const peekTenantInviteFn = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ data }) => {
    const { peekTenantInvite } = await import("./tenant-invite.server");
    return peekTenantInvite(data.token);
  });

export const openTenantInviteFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ context, data }) => {
    const { openTenantInvite } = await import("./tenant-invite.server");
    return openTenantInvite(context.userId, data.token);
  });

export const saveTenantOnboardFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { token: string; payload: unknown }) => ({
    token: String(d.token ?? ""),
    payload: d.payload,
  }))
  .handler(async ({ context, data }) => {
    const { saveTenantOnboard } = await import("./tenant-invite.server");
    return saveTenantOnboard(context.userId, data.token, data.payload);
  });

export const completeTenantOnboardFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { token: string; payload: unknown }) => ({
    token: String(d.token ?? ""),
    payload: d.payload,
  }))
  .handler(async ({ context, data }) => {
    const { completeTenantOnboard } = await import("./tenant-invite.server");
    return completeTenantOnboard(context.userId, data.token, data.payload);
  });

export type { TenantKind };
