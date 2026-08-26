import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import type { KeepEraseMap, LocationLifecycle } from "./types";

export const saveLifecycleFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    lifecycleStatus?: string;
    trainingTrackInventory?: boolean;
    operatorLifecycle?: Record<string, string>;
    goLiveAt?: string | null;
    goLiveChoices?: KeepEraseMap;
  }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: String(d.locationId ?? "").trim(),
    lifecycleStatus: d.lifecycleStatus ? String(d.lifecycleStatus) : undefined,
    trainingTrackInventory: d.trainingTrackInventory,
    operatorLifecycle: d.operatorLifecycle,
    goLiveAt: d.goLiveAt === undefined ? undefined : d.goLiveAt,
    goLiveChoices: d.goLiveChoices,
  }))
  .handler(async ({ context, data }) => {
    const { saveLifecycleForLocation } = await import("./server");
    return saveLifecycleForLocation(context.userId, data);
  });

export type { LocationLifecycle, KeepEraseMap };
