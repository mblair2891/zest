import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { LocationSetup } from "@/lib/saas/types";
import { EMPTY_LOCATION_SETUP } from "@/lib/saas/types";
import { SETTINGS_WRITE_MEMBERSHIP } from "./membership-map";

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
      canWriteSettings:
        access.isPlatformAdmin ||
        SETTINGS_WRITE_MEMBERSHIP.includes(access.role),
    };
  });
