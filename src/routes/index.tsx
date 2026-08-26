import { createFileRoute } from "@tanstack/react-router";
import { HomeErrorBoundary, HomeRouteError } from "@/components/marketing/HomeErrorBoundary";
import { HomePage } from "@/components/marketing/HomePage";

export const Route = createFileRoute("/")({
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
