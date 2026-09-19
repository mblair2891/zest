import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "./tenant-middleware";
import type { CreateBulletinInput } from "./reg-bulletins";

export const listRegBulletinsFn = createServerFn({ method: "GET" })
  .middleware([tenantMiddleware])
  .handler(async ({ context }) => {
    const { listRegBulletins } = await import("./reg-bulletins.server");
    return listRegBulletins(context.userId);
  });

export const createRegBulletinFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: CreateBulletinInput) => d)
  .handler(async ({ context, data }) => {
    const { createRegBulletin } = await import("./reg-bulletins.server");
    return createRegBulletin(context.userId, data);
  });

export const archiveRegBulletinFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { id: string }) => ({ id: String(d.id ?? "").trim() }))
  .handler(async ({ context, data }) => {
    const { archiveRegBulletin } = await import("./reg-bulletins.server");
    return archiveRegBulletin(context.userId, data.id);
  });

export const listVenueBulletinsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string }) => ({
    locationId: String(d.locationId ?? "").trim(),
  }))
  .handler(async ({ context, data }) => {
    const { listVenueBulletins } = await import("./reg-bulletins.server");
    return listVenueBulletins(context.userId, data.locationId);
  });

export const ackVenueBulletinFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; bulletinId: string; status: "saved" | "dismissed" }) => ({
    locationId: String(d.locationId ?? "").trim(),
    bulletinId: String(d.bulletinId ?? "").trim(),
    status: d.status === "saved" ? ("saved" as const) : ("dismissed" as const),
  }))
  .handler(async ({ context, data }) => {
    const { ackVenueBulletin } = await import("./reg-bulletins.server");
    return ackVenueBulletin(context.userId, data);
  });
