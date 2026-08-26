import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { SessionGate } from "@/components/pos/SessionGate";

/** Shared POS application (app.summex.app). Tenant is already in session context. */
export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppHome,
});

function AppHome() {
  return (
    <SessionGate allowPrimedStation>
      <PosApp />
    </SessionGate>
  );
}
