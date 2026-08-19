import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";

export const Route = createFileRoute("/venue/$type")({
  ssr: false,
  component: VenuePage,
});

function VenuePage() {
  const { type } = Route.useParams();
  return <PosApp entityId={type} />;
}
