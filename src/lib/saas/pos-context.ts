const KEY = "summex-tenant-pos";

export type TenantPosContext = {
  orgId: string;
  locationId: string;
  venueType: string;
  locationName: string;
  orgName: string;
  ownerName: string;
};

export function saveTenantPosContext(ctx: TenantPosContext): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function readTenantPosContext(): TenantPosContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TenantPosContext;
  } catch {
    return null;
  }
}

export function clearTenantPosContext(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
