import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";

function loc(raw: unknown): string {
  const id = String(raw ?? "").trim();
  if (!id || id.length > 80) throw new Error("Location is required");
  return id;
}

export const clearLocationFloorFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId?: string; locationId?: string; floorPlan?: unknown }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    floorPlan: d.floorPlan ?? null,
  }))
  .handler(async ({ context, data }) => {
    const { clearLocationFloor } = await import("./floor-clear.server");
    return clearLocationFloor(context.userId, data);
  });
