import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { resolveVenueBySlugFn } from "@/lib/saas/api";
import { readTenantPosContext, saveTenantPosContext } from "@/lib/saas/pos-context";
import { venueSlugFromHost, venueSlugFromPath } from "@/lib/platform/venue-host";

/** When Host is {slug}.summex.app (or path /v/{slug}), bind POS/QR/station to that venue. */
export function VenueHostBootstrap() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const slug = venueSlugFromHost(host) || venueSlugFromPath(pathname);
    if (!slug) return;
    const existing = readTenantPosContext();
    if (existing?.slug === slug && existing.locationId) return;
    void resolveVenueBySlugFn({ data: { slug } })
      .then((row) => {
        if (!row) return;
        saveTenantPosContext({
          orgId: row.orgId,
          locationId: row.id,
          venueType: row.venueType,
          locationName: row.name,
          orgName: row.name,
          ownerName: existing?.ownerName || "Owner",
          slug: row.slug,
        });
      })
      .catch(() => undefined);
  }, [pathname]);

  return null;
}
