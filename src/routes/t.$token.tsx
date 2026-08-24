import { createFileRoute } from "@tanstack/react-router";
import { GuestTablePage } from "@/components/pos/GuestTablePage";

export const Route = createFileRoute("/t/$token")({
  ssr: false,
  component: TokenTablePage,
});

function TokenTablePage() {
  const { token } = Route.useParams();
  const search =
    typeof window === "undefined"
      ? {}
      : Object.fromEntries(new URLSearchParams(window.location.search));
  return (
    <GuestTablePage
      token={token}
      payOnly={search.pay === "1"}
      demoHint={typeof search.demo === "string" ? search.demo : undefined}
    />
  );
}
