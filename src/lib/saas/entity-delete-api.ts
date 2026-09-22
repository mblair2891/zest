import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "./tenant-middleware";

export const deleteSellingEntityFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; operatorId: string; confirmName: string }) => ({
    locationId: String(d.locationId ?? "").trim(),
    operatorId: String(d.operatorId ?? "").trim(),
    confirmName: String(d.confirmName ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { deleteSellingEntityRecord } = await import("./entity-delete.server");
    return deleteSellingEntityRecord(context.userId, data);
  });
