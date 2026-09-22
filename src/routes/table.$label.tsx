import { createFileRoute } from "@tanstack/react-router";
import { GuestTablePage } from "@/components/pos/GuestTablePage";
import { readCheckParam } from "@/lib/pos/check-number";

export const Route = createFileRoute("/table/$label")({
  ssr: false,
  component: TableQrOrderPage,
});

function TableQrOrderPage() {
  const { label } = Route.useParams();
  const search =
    typeof window === "undefined"
      ? {}
      : Object.fromEntries(new URLSearchParams(window.location.search));
  const checkNumber = readCheckParam(search.check);
  return (
    <GuestTablePage
      label={label}
      checkNumber={checkNumber}
      payOnly={search.pay === "1" || Boolean(checkNumber)}
      demoHint={typeof search.demo === "string" ? search.demo : undefined}
      seat={search.seat ? Number(search.seat) || undefined : undefined}
    />
  );
}
