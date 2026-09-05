import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SessionGate } from "@/components/pos/SessionGate";

export const Route = createFileRoute("/platform")({
  ssr: false,
  beforeLoad: ({ location }) => {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/platform") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PlatformLayout,
});

function PlatformLayout() {
  return (
    <SessionGate>
      <Outlet />
    </SessionGate>
  );
}
