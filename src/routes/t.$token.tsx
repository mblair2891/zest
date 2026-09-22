import { createFileRoute } from "@tanstack/react-router";
import { GuestTablePage } from "@/components/pos/GuestTablePage";
import { readCheckParam } from "@/lib/pos/check-number";

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
  const checkNumber = readCheckParam(search.check);
  if (token.startsWith("c.")) {
    return <GuestTablePage checkToken={token} checkNumber={checkNumber} payOnly />;
  }
  return (
    <GuestTablePage
      token={token}
      checkNumber={checkNumber}
      payOnly={search.pay === "1" || Boolean(checkNumber)}
      demoHint={typeof search.demo === "string" ? search.demo : undefined}
      seat={search.seat ? Number(search.seat) || undefined : undefined}
    />
  );
}
