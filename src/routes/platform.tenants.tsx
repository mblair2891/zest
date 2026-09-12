import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SessionGate } from "@/components/pos/SessionGate";

export const Route = createFileRoute("/platform/tenants")({
  ssr: false,
  component: PlatformTenantsLayout,
});

function PlatformTenantsLayout() {
  return (
    <SessionGate>
      <Outlet />
    </SessionGate>
  );
}
