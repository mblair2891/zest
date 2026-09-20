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

export const publishRegBulletinFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { id: string }) => ({ id: String(d.id ?? "").trim() }))
  .handler(async ({ context, data }) => {
    const { publishRegBulletin } = await import("./reg-bulletins.server");
    return publishRegBulletin(context.userId, data.id);
  });

export const listRegReviewTasksFn = createServerFn({ method: "GET" })
  .middleware([tenantMiddleware])
  .handler(async ({ context }) => {
    const { listRegReviewTasks } = await import("./reg-bulletins.server");
    return listRegReviewTasks(context.userId);
  });

export const dismissRegReviewTaskFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { id: string }) => ({ id: String(d.id ?? "").trim() }))
  .handler(async ({ context, data }) => {
    const { dismissRegReviewTask } = await import("./reg-bulletins.server");
    return dismissRegReviewTask(context.userId, data.id);
  });

export const draftBulletinFromUrlFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { url: string; taskId?: string; state?: string; city?: string; kinds?: string }) => ({
    url: String(d.url ?? "").trim(),
    taskId: d.taskId ? String(d.taskId) : undefined,
    state: d.state ? String(d.state) : undefined,
    city: d.city ? String(d.city) : undefined,
    kinds: d.kinds ? String(d.kinds) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { draftBulletinFromUrl } = await import("./reg-bulletins.server");
    return draftBulletinFromUrl(context.userId, data);
  });

export const runRegCalendarTickFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d?: { nowIso?: string }) => ({ nowIso: d?.nowIso ? String(d.nowIso) : undefined }))
  .handler(async ({ data }) => {
    const { runRegCalendarTick } = await import("./reg-bulletins.server");
    return runRegCalendarTick(data.nowIso);
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
  .validator((d: {
    locationId: string;
    bulletinId: string;
    status: "saved" | "dismissed" | "scheduled";
    applyOn?: string | null;
  }) => ({
    locationId: String(d.locationId ?? "").trim(),
    bulletinId: String(d.bulletinId ?? "").trim(),
    status:
      d.status === "saved" || d.status === "scheduled" ? d.status : ("dismissed" as const),
    applyOn: d.applyOn ? String(d.applyOn).slice(0, 10) : null,
  }))
  .handler(async ({ context, data }) => {
    const { ackVenueBulletin } = await import("./reg-bulletins.server");
    return ackVenueBulletin(context.userId, data);
  });
