import { isProspectDemo } from "@/lib/demo/session";
import { usePosStore } from "@/lib/pos/store";
import type { VenueEntityId } from "@/lib/pos/types";
import { buildLocationMetrics } from "./metrics";
import type { LocationMetrics, RangeKey } from "./types";
import { canViewSalesReports, isHostPrivileged } from "@/lib/access/entity-grants";

export function metricsFromPosStore(opts: {
  range: RangeKey;
  from?: number;
  to?: number;
  operatorId?: string | null;
  serverId?: string | null;
}): LocationMetrics {
  const s = usePosStore.getState();
  const venue = (s.activeEntityId || "restaurant") as VenueEntityId;
  const emp = s.employees.find((e) => e.id === s.currentEmployeeId);
  const grants = s.entityPermissions;
  let lockOp: string | null = opts.operatorId ?? null;
  if (emp?.role === "vendor_operator") {
    const want = opts.operatorId || emp.operatorId || null;
    lockOp =
      want && canViewSalesReports(emp, grants, want) ? want : emp.operatorId ?? null;
  } else if (!isHostPrivileged(emp) && emp?.operatorId) {
    lockOp = canViewSalesReports(emp, grants, opts.operatorId)
      ? opts.operatorId ?? emp.operatorId
      : emp.operatorId;
  }
  const lockSrv = emp?.role === "server" ? emp.id : opts.serverId ?? null;
  return buildLocationMetrics({
    locationId: s.tenantLocationId || `demo:${venue}`,
    locationName: s.settings.name,
    venueType: venue,
    range: opts.range,
    from: opts.from,
    to: opts.to,
    isDemo: isProspectDemo(),
    operatorId: lockOp,
    serverId: lockSrv,
    settings: s.settings,
    orders: s.orders,
    tickets: s.tickets,
    waitlist: s.waitlist,
    reservations: s.reservations,
    employees: s.employees,
    menuItems: s.menuItems,
    categories: s.categories,
    vendors: s.vendors,
    inventory: s.inventory,
    chargebacks: s.chargebacks ?? [],
    settlementPeriods: s.settlementPeriods ?? [],
    shift: s.shift,
  });
}
