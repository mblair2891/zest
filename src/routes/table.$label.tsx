import { createFileRoute } from "@tanstack/react-router";
import { GuestTablePage } from "@/components/pos/GuestTablePage";

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
  return (
    <GuestTablePage
      label={label}
      payOnly={search.pay === "1"}
      demoHint={typeof search.demo === "string" ? search.demo : undefined}
      seat={search.seat ? Number(search.seat) || undefined : undefined}
    />
  );
}
