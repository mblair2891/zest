import { usePosStore } from "@/lib/pos/store";
import { idbGetSnapshot, idbPutSnapshot } from "./idb";
import { activeLocationId } from "./scope";
import { readTenantPosContext } from "@/lib/saas/pos-context";
import type { LocationSnapshot } from "./types";

export function captureLocationSnapshot(): LocationSnapshot | null {
  if (typeof window === "undefined") return null;
  const pos = usePosStore.getState();
  const locationId = pos.tenantLocationId || activeLocationId();
  if (!locationId || locationId === "loc_local") return null;
  const ctx = readTenantPosContext();
  return {
    locationId,
    savedAt: Date.now(),
    name: pos.settings?.name || ctx?.locationName || "Location",
    menuItemCount: pos.menuItems?.length ?? 0,
    tableCount: pos.tables?.length ?? 0,
    staffCount: pos.employees?.length ?? 0,
    venueType: pos.activeEntityId || ctx?.venueType,
    orgId: ctx?.orgId,
    payload: {
      settings: pos.settings,
      employees: pos.employees,
      categories: pos.categories,
      menuItems: pos.menuItems,
      tables: pos.tables,
      orders: pos.orders,
      tickets: pos.tickets,
      vendors: pos.vendors,
      floorSections: pos.floorSections,
      waitlist: pos.waitlist,
      reservations: pos.reservations,
    },
  };
}

export function persistLocationSnapshot(): void {
  const snap = captureLocationSnapshot();
  if (!snap) return;
  void idbPutSnapshot(snap);
}

export function applyLocationSnapshot(snap: LocationSnapshot): boolean {
  if (!snap.payload) return false;
  const p = snap.payload;
  try {
    const cur = usePosStore.getState();
    const patch: Record<string, unknown> = {
      tenantLocationId: snap.locationId,
      currentEmployeeId: null,
    };
    if (p.settings && typeof p.settings === "object") patch.settings = p.settings;
    if (Array.isArray(p.employees)) patch.employees = p.employees;
    else patch.employees = cur.employees;
    if (Array.isArray(p.categories)) patch.categories = p.categories;
    if (Array.isArray(p.menuItems)) patch.menuItems = p.menuItems;
    if (Array.isArray(p.tables)) patch.tables = p.tables;
    if (Array.isArray(p.orders)) patch.orders = p.orders;
    if (Array.isArray(p.tickets)) patch.tickets = p.tickets;
    if (Array.isArray(p.vendors)) patch.vendors = p.vendors;
    if (Array.isArray(p.floorSections)) patch.floorSections = p.floorSections;
    if (Array.isArray(p.waitlist)) patch.waitlist = p.waitlist;
    if (Array.isArray(p.reservations)) patch.reservations = p.reservations;
    usePosStore.setState(patch as never);
    return true;
  } catch {
    return false;
  }
}

export async function loadPrimedLocation(locationId: string): Promise<boolean> {
  const pos = usePosStore.getState();
  if (pos.tenantLocationId === locationId && (pos.menuItems?.length || pos.tables?.length)) {
    return true;
  }
  const snap = await idbGetSnapshot(locationId);
  if (!snap) return false;
  if (snap.payload) return applyLocationSnapshot(snap);
  return pos.tenantLocationId === locationId;
}
