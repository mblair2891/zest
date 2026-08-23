import { createFileRoute, Navigate } from "@tanstack/react-router";
import { DemoVenueShell } from "@/components/demo/DemoVenueShell";
import { parseDemoType } from "@/lib/demo/session";

export const Route = createFileRoute("/demo/$type/tour")({
  ssr: false,
  component: DemoTypeTourPage,
});

function DemoTypeTourPage() {
  const { type } = Route.useParams();
  const venue = parseDemoType(type);
  if (!venue) return <Navigate to="/demo" />;
  return <DemoVenueShell type={venue} startTour />;
}
