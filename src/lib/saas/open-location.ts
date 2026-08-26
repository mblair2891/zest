import { saveTenantPosContext } from "@/lib/saas/pos-context";
import { setActiveContextFn } from "@/lib/saas/api";
import { useSaasStore } from "@/lib/pos/saas-store";
import type { LocationMode } from "@/lib/pos/saas-types";

const MODES = new Set<string>([
  "restaurant",
  "food_hall",
  "truck_pod",
  "ghost_kitchen",
  "catering",
  "bar_lounge",
  "cafe",
  "qsr",
]);

export function venuePathForLocation(mode: string | null | undefined): LocationMode {
  const m = String(mode ?? "").trim();
  if (MODES.has(m)) return m as LocationMode;
  return "food_hall";
}

/** Same-origin POS URL. Never app.summex.app — that host is not served. */
export function sameOriginVenueHref(venueType: string, locationId: string): string {
  const venue = venuePathForLocation(venueType);
  return `/venue/${venue}?loc=${encodeURIComponent(locationId)}`;
}

/** Same destination as header Open POS: set active location, then go to POS. */
export function openLocationPos(opts: {
  orgId: string;
  locationId: string;
  venueType: string;
  locationName: string;
  orgName: string;
  ownerName?: string;
  skipActiveContext?: boolean;
}): void {
  const venueType = venuePathForLocation(opts.venueType);
  try {
    useSaasStore.getState().setActiveLocation(opts.locationId);
  } catch {
    /* store may not be hydrated on the marketing login path */
  }
  saveTenantPosContext({
    orgId: opts.orgId,
    locationId: opts.locationId,
    venueType,
    locationName: opts.locationName,
    orgName: opts.orgName,
    ownerName: opts.ownerName || "Owner",
  });
  const href = sameOriginVenueHref(venueType, opts.locationId);
  const go = () => {
    window.location.assign(href);
  };
  if (opts.skipActiveContext) {
    go();
    return;
  }
  void setActiveContextFn({
    data: { orgId: opts.orgId, locationId: opts.locationId },
  })
    .catch(() => undefined)
    .finally(go);
}
