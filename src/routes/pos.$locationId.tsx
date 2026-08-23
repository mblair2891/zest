import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";

export const Route = createFileRoute("/pos/$locationId")({
  ssr: false,
  component: SaasLocationPosPage,
});

function SaasLocationPosPage() {
  const { locationId } = Route.useParams();
  return <PosApp saasLocationId={locationId} />;
}
