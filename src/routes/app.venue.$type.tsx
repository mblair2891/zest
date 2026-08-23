import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";

export const Route = createFileRoute("/app/venue/$type")({
  ssr: false,
  component: AppVenuePage,
});

function AppVenuePage() {
  const { type } = Route.useParams();
  return <PosApp entityId={type} />;
}
