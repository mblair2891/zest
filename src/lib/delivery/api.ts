import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { claimDeliveryInbox } from "./apply.server";

export const claimDeliveryInboxFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((data: { locationId?: string }) => ({
    locationId: String(data?.locationId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    if (!data.locationId) return [];
    return claimDeliveryInbox(data.locationId);
  });
