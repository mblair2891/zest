import { createFileRoute, Navigate } from "@tanstack/react-router";
import { SessionGate } from "@/components/pos/SessionGate";

export const Route = createFileRoute("/platform")({
  ssr: false,
  component: PlatformRedirect,
});

function PlatformRedirect() {
  return (
    <SessionGate>
      <Navigate to="/dashboard" replace />
    </SessionGate>
  );
}
