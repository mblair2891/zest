import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { SessionGate } from "@/components/pos/SessionGate";

export const Route = createFileRoute("/venue/$type")({
  ssr: false,
  component: VenuePage,
});

function VenuePage() {
  const { type } = Route.useParams();
  return (
    <SessionGate>
      <PosApp entityId={type} />
    </SessionGate>
  );
}
