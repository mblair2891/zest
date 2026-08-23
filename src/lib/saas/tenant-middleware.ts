import { createMiddleware } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * Tenant context for every request that touches org/location data.
 *
 * Shared-app model (Toast-style): authenticate first, then resolve the active
 * organization + location from `active_contexts` (set by the location picker).
 * Never trust a client-supplied orgId as the only check — membership is
 * re-verified here.
 *
 *   createServerFn({ method: "POST" })
 *     .middleware([tenantMiddleware])
 *     .handler(async ({ context }) => {
 *       // context.userId, organizationId, locationId, role
 *     });
 */
export const tenantMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    const { resolveActiveTenant, ForbiddenError } = await import("./tenancy.server");
    const tenant = await resolveActiveTenant(context.userId);
    if (!tenant) {
      throw new ForbiddenError("Select an organization");
    }
    if (tenant.orgStatus === "suspended" && tenant.role !== "platform_admin") {
      const { SuspendedError } = await import("./tenancy.server");
      throw new SuspendedError();
    }
    return next({
      context: {
        userId: context.userId,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
        role: tenant.role,
        orgName: tenant.orgName,
        orgStatus: tenant.orgStatus,
      },
    });
  });
