import { getDemoType, isProspectDemo } from "@/lib/demo/session";
import { readTenantPosContext } from "@/lib/saas/pos-context";

export function activeLocationId(): string {
  try {
    const ctx = readTenantPosContext();
    if (ctx?.locationId) return ctx.locationId;
  } catch {
    /* ignore */
  }
  try {
    if (isProspectDemo()) {
      const t = getDemoType();
      if (t) return `demo:${t}`;
    }
  } catch {
    /* ignore */
  }
  return "loc_local";
}

export function tenantOrgId(): string | null {
  try {
    return readTenantPosContext()?.orgId ?? null;
  } catch {
    return null;
  }
}
