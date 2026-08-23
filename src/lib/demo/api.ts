import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const listDemosFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { isPlatformAdmin } = await import("@/lib/saas/tenancy.server");
    if (!(await isPlatformAdmin(context.userId))) {
      throw new Error("Only platform admin can list demos");
    }
    const { listDemoVenues } = await import("./seed.server");
    return listDemoVenues();
  });

export const seedDemosFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { isPlatformAdmin } = await import("@/lib/saas/tenancy.server");
    if (!(await isPlatformAdmin(context.userId))) {
      throw new Error("Only platform admin can seed demos");
    }
    const { seedDemoVenues } = await import("./seed.server");
    return seedDemoVenues();
  });

export const resetDemosFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { resetDemoVenues } = await import("./seed.server");
    return resetDemoVenues(context.userId);
  });
