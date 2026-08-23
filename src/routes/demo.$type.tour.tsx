import { useEffect } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { DemoVenueShell } from "@/components/demo/DemoVenueShell";
import { parseDemoType } from "@/lib/demo/session";
import { startTour, useTourStore } from "@/lib/demo/tour-store";

export const Route = createFileRoute("/demo/$type/tour")({
  ssr: false,
  component: DemoTypeTourPage,
});

function DemoTypeTourPage() {
  const { type } = Route.useParams();
  const venue = parseDemoType(type);

  useEffect(() => {
    if (!venue) return;
    if (useTourStore.getState().tour) return;
    const id = `type:${venue}`;
    if (!startTour(id, { autoPlay: true })) {
      console.error("[summex] Tour failed to start", id);
      toast.error("Tour not available");
    }
  }, [venue]);

  if (!venue) return <Navigate to="/demo" />;
  return <DemoVenueShell type={venue} hideTourCta />;
}
