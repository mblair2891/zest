import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { SessionGate } from "@/components/pos/SessionGate";

export const Route = createFileRoute("/app/venue/$type")({
  ssr: false,
  component: AppVenuePage,
});

function AppVenuePage() {
  const { type } = Route.useParams();
  return (
    <SessionGate>
      <PosApp entityId={type} />
    </SessionGate>
  );
}
