import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import type { SmsUsageSnapshot } from "./sms.server";
import type { AiIncludedWith } from "./policy";

export type CommsUsageSnapshot = {
  sms: SmsUsageSnapshot;
  ai: { used: number; cap: number; includedWith: AiIncludedWith };
};

export const getCommsUsageFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string }) => ({
    locationId: String(d.locationId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }): Promise<CommsUsageSnapshot | null> => {
    if (!data.locationId) return null;
    if (context.userId) {
      try {
        const { bindTenant } = await import("@/lib/saas/assert-tenant.server");
        await bindTenant(context.userId, { locationId: data.locationId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg !== "Location not found") throw e;
      }
    }
    const [{ getSmsUsage }, { getAiUsage }] = await Promise.all([
      import("./sms.server"),
      import("./ai.server"),
    ]);
    const [sms, ai] = await Promise.all([
      getSmsUsage(data.locationId),
      getAiUsage(data.locationId),
    ]);
    return { sms, ai };
  });
