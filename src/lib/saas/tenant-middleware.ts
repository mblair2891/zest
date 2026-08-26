import { createMiddleware } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * Tenant context for every request that touches org/location data.
 *
 * Authenticate first, then bind membership:
 * - If the payload includes locationId, membership is checked for that location
 *   (org is loaded from Postgres — client orgId cannot retarget another tenant).
 * - If only orgId is present, membership for that org is required.
 * - Otherwise the active organization from `active_contexts` is used.
 * Platform admin is global and may omit an org.
 *
 *   createServerFn({ method: "POST" })
 *     .middleware([tenantMiddleware])
 *     .handler(async ({ context, data }) => { ... });
 */
export const tenantMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async (opts) => {
    const { next, context } = opts;
    const data = "data" in opts ? (opts as { data?: unknown }).data : undefined;
    const { bindTenant } = await import("./assert-tenant.server");
    const tenant = await bindTenant(context.userId, data);
    return next({
      context: {
        userId: context.userId,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
        role: tenant.role,
        isPlatformAdmin: tenant.isPlatformAdmin,
      },
    });
  });
