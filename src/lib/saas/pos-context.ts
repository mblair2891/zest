const KEY = "summex-tenant-pos";
const DURABLE_KEY = "summex-tenant-pos-v1";

export type TenantPosContext = {
  orgId: string;
  locationId: string;
  venueType: string;
  locationName: string;
  orgName: string;
  ownerName: string;
  slug?: string | null;
};

export function saveTenantPosContext(ctx: TenantPosContext): void {
  const raw = JSON.stringify(ctx);
  try {
    sessionStorage.setItem(KEY, raw);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(DURABLE_KEY, raw);
  } catch {
    /* ignore */
  }
}

export function readTenantPosContext(): TenantPosContext | null {
  try {
    const raw = sessionStorage.getItem(KEY) || localStorage.getItem(DURABLE_KEY);
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
  try {
    localStorage.removeItem(DURABLE_KEY);
  } catch {
    /* ignore */
  }
}
