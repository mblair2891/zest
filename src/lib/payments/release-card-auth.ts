import { voidCheckAuthorizationFn } from "@/lib/payments/api";
import type { CardAuthHold } from "@/lib/pos/types";
import { readTenantPosContext } from "@/lib/saas/pos-context";

/** Void an authorization that was never captured. Failures stay on the check. */
export function releaseCardAuthorization(opts: {
  auth: CardAuthHold | null | undefined;
  checkId: string;
  locationId: string;
}): void {
  const authorizationId = opts.auth?.authorizationId || opts.auth?.finixTransferId || "";
  if (!authorizationId) return;
  const orgId = readTenantPosContext()?.orgId || "";
  const locationId = opts.locationId.trim();
  if (!locationId || !orgId) return;
  void voidCheckAuthorizationFn({
    data: {
      locationId,
      orgId,
      authorizationId,
      checkId: opts.checkId,
    },
  }).catch(() => undefined);
}
