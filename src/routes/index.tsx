import { createFileRoute, redirect } from "@tanstack/react-router";
import { HomeErrorBoundary, HomeRouteError } from "@/components/marketing/HomeErrorBoundary";
import { HomePage } from "@/components/marketing/HomePage";
import { parseStationQuery } from "@/lib/pos/device-roles";

export const Route = createFileRoute("/")({
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

/** Public sales landing on every host. POS lives at /app, /venue, /station — never here. */
function IndexPage() {
  return (
    <HomeErrorBoundary>
      <HomePage />
    </HomeErrorBoundary>
  );
}
