import { isProspectDemo } from "@/lib/demo/session";
import { usePosStore } from "@/lib/pos/store";
import type { VenueEntityId } from "@/lib/pos/types";
import { buildLocationMetrics } from "./metrics";
import type { LocationMetrics, RangeKey } from "./types";

export function metricsFromPosStore(opts: {
  range: RangeKey;
  operatorId?: string | null;
  serverId?: string | null;
}): LocationMetrics {
  const s = usePosStore.getState();
  const venue = (s.activeEntityId || "restaurant") as VenueEntityId;
  const emp = s.employees.find((e) => e.id === s.currentEmployeeId);
  const lockOp = emp?.role === "vendor_operator" ? emp.operatorId ?? null : opts.operatorId ?? null;
  const lockSrv = emp?.role === "server" ? emp.id : opts.serverId ?? null;
  return buildLocationMetrics({
    locationId: s.tenantLocationId || `demo:${venue}`,
    locationName: s.settings.name,
    venueType: venue,
    range: opts.range,
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
