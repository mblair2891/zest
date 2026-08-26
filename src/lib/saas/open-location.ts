import { appHref } from "@/lib/platform/hosts";
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

/** Same destination as header Open POS: set active location, then go to POS. */
export function openLocationPos(opts: {
  orgId: string;
  locationId: string;
  venueType: string;
  locationName: string;
  orgName: string;
  ownerName?: string;
}): void {
  const venueType = venuePathForLocation(opts.venueType);
  useSaasStore.getState().setActiveLocation(opts.locationId);
  saveTenantPosContext({
    orgId: opts.orgId,
    locationId: opts.locationId,
    venueType,
    locationName: opts.locationName,
    orgName: opts.orgName,
    ownerName: opts.ownerName || "Owner",
  });
  const href = appHref(
    `/venue/${venueType}?loc=${encodeURIComponent(opts.locationId)}`,
  );
  void setActiveContextFn({
    data: { orgId: opts.orgId, locationId: opts.locationId },
  }).finally(() => {
    window.location.href = href;
  });
}
