import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { HomeErrorBoundary, HomeRouteError } from "@/components/marketing/HomeErrorBoundary";
import { HomePage } from "@/components/marketing/HomePage";
import { parseStationQuery } from "@/lib/pos/device-roles";
import { venueSlugFromHost } from "@/lib/platform/venue-host";
import { SessionGate } from "@/components/pos/SessionGate";
import { VenueSlugApp } from "@/components/pos/VenueSlugApp";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: ({ location }) => {
    const qs = (location.searchStr || "").replace(/^\?/, "");
    const station = parseStationQuery(new URLSearchParams(qs).get("station"));
    if (station) {
      throw redirect({ to: "/station", search: { station }, replace: true });
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
