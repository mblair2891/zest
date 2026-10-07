import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";

function loc(raw: unknown): string {
  const id = String(raw ?? "").trim();
  if (!id || id.length > 80) throw new Error("Location is required");
  return id;
}

export const publishEntityFloorFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId?: string; locationId?: string; entityId?: string; floorPlan?: unknown }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    entityId: String(d.entityId ?? "").trim().slice(0, 80),
    floorPlan: d.floorPlan ?? null,
  }))
  .handler(async ({ context, data }) => {
    const { publishEntityFloor } = await import("./entity-floor-publish.server");
    return publishEntityFloor(context.userId, data);
  });
