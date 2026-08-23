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
    const { updateLocationSetupForUser } = await import("@/lib/saas/tenancy.server");
    const merged: LocationSetup = { ...EMPTY_LOCATION_SETUP, ...data.setup };
    return updateLocationSetupForUser(context.userId, {
      orgId: data.orgId,
      locationId: data.locationId,
      setup: merged,
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
