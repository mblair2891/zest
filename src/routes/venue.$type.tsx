import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { SessionGate } from "@/components/pos/SessionGate";

export const Route = createFileRoute("/venue/$type")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { loc?: string } => {
    const loc = typeof s.loc === "string" && s.loc ? s.loc : undefined;
    return loc ? { loc } : {};
  },
  component: VenuePage,
});

function VenuePage() {
  const { type } = Route.useParams();
  return (
    <SessionGate allowPrimedStation>
      <PosApp entityId={type} />
    </SessionGate>
  );
}
