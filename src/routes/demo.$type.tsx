import { createFileRoute, Navigate } from "@tanstack/react-router";
import { DemoVenueShell } from "@/components/demo/DemoVenueShell";
import { parseDemoType } from "@/lib/demo/session";

export const Route = createFileRoute("/demo/$type")({
  ssr: false,
  component: DemoTypePage,
});

function DemoTypePage() {
  const { type } = Route.useParams();
  if (type === "tour") return <Navigate to="/demo/tour/full" />;
  const venue = parseDemoType(type);
  if (!venue) return <Navigate to="/demo" />;
  return <DemoVenueShell type={venue} />;
}
