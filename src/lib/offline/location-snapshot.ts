import { usePosStore } from "@/lib/pos/store";
import { idbGetLatestSnapshot, idbGetSnapshot, idbPutSnapshot } from "./idb";
import { activeLocationId } from "./scope";
import { readTenantPosContext } from "@/lib/saas/pos-context";
import type { LocationSnapshot } from "./types";

function packEmployees(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((e) => {
    if (!e || typeof e !== "object") return e;
    const row = e as Record<string, unknown>;
    return {
      ...row,
      pin: "",
      pinHash: typeof row.pinHash === "string" ? row.pinHash : "",
    };
  });
}

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
      employees: packEmployees(pos.employees),
      categories: pos.categories,
      menuItems: pos.menuItems,
      tables: pos.tables,
      orders: pos.orders,
      tickets: pos.tickets,
      vendors: pos.vendors,
      floorSections: pos.floorSections,
      waitlist: pos.waitlist,
      reservations: pos.reservations,
      locationDevices: pos.locationDevices,
      activeEntityId: pos.activeEntityId,
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
      currentEmployeeId: cur.currentEmployeeId,
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
    if (Array.isArray(p.locationDevices)) patch.locationDevices = p.locationDevices;
    if (typeof p.activeEntityId === "string" && p.activeEntityId) {
      patch.activeEntityId = p.activeEntityId;
    } else if (snap.venueType) {
      patch.activeEntityId = snap.venueType;
    }
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

export async function hasPrimedLocationPack(): Promise<boolean> {
  const snap = await idbGetLatestSnapshot();
  if (snap?.payload && (snap.menuItemCount > 0 || snap.tableCount > 0 || snap.staffCount > 0)) {
    return true;
  }
  const pos = usePosStore.getState();
  return Boolean(pos.tenantLocationId && (pos.menuItems?.length || pos.tables?.length));
}

export async function resolvePrimedLocation(): Promise<{
  locationId: string;
  venueType: string;
} | null> {
  const ctx = readTenantPosContext();
  const pos = usePosStore.getState();
  const snap = await idbGetLatestSnapshot();
  const locationId = ctx?.locationId || pos.tenantLocationId || snap?.locationId || "";
  const venueType =
    ctx?.venueType ||
    (typeof pos.activeEntityId === "string" ? pos.activeEntityId : "") ||
    snap?.venueType ||
    snap?.payload?.activeEntityId ||
    "";
  if (!locationId) return null;
  if (snap && snap.locationId === locationId && snap.payload) {
    applyLocationSnapshot(snap);
  } else if (locationId) {
    await loadPrimedLocation(locationId);
  }
  return { locationId, venueType: venueType || "food_hall" };
}
