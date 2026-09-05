import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { HomeErrorBoundary, HomeRouteError } from "@/components/marketing/HomeErrorBoundary";
import { HomePage } from "@/components/marketing/HomePage";
import { parseStationQuery } from "@/lib/pos/device-roles";
import { venueSlugFromHost } from "@/lib/platform/venue-host";
import { SessionGate } from "@/components/pos/SessionGate";
import { VenueSlugApp } from "@/components/pos/VenueSlugApp";
import { normalizeClaimCode } from "@/lib/pos/station-pair";
import {
  absolutePlatformHref,
  hostSplitActive,
  isAppPlatformHost,
  isMarketingPublicHost,
} from "@/lib/platform/hosts";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: ({ location }) => {
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const qs = (location.searchStr || "").replace(/^\?/, "");
    const params = new URLSearchParams(qs);
    const station = parseStationQuery(params.get("station"));
    if (station) {
      const loc = params.get("loc") || undefined;
      const pairRaw = params.get("pair");
      const pair = pairRaw ? normalizeClaimCode(pairRaw) : undefined;
      const q = new URLSearchParams();
      if (loc) q.set("loc", loc);
      if (pair) q.set("pair", pair);
      const tail = q.toString() ? `?${q.toString()}` : "";
      if (host && hostSplitActive(host) && isMarketingPublicHost(host)) {
        throw redirect({
          href: absolutePlatformHref(`/station/${station}${tail}`),
        });
      }
      throw redirect({
        to: "/station/$role",
        params: { role: station },
        search: {
          ...(loc ? { loc } : {}),
          ...(pair ? { pair } : {}),
        },
        replace: true,
      });
    }
    if (host && hostSplitActive(host) && isAppPlatformHost(host)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: IndexPage,
  errorComponent: HomeRouteError,
});

/** Venue subdomain {slug}.summex.app → that house. Else public sales landing. */
function IndexPage() {
  const [slug, setSlug] = useState<string | null>(() =>
    typeof window !== "undefined" ? venueSlugFromHost(window.location.hostname) : null,
  );

  useEffect(() => {
    setSlug(venueSlugFromHost(window.location.hostname));
  }, []);

  if (slug) {
    return (
      <SessionGate allowPrimedStation>
        <VenueSlugApp slug={slug} />
      </SessionGate>
    );
  }

  return (
    <HomeErrorBoundary>
      <HomePage />
    </HomeErrorBoundary>
  );
}
