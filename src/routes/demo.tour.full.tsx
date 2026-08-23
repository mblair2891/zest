import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { DemoCatalogPage } from "@/components/demo/DemoCatalogPage";
import { startTour, useTourStore } from "@/lib/demo/tour-store";

export const Route = createFileRoute("/demo/tour/full")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Full product tour · Summex" }],
  }),
  component: FullTourPage,
});

function FullTourPage() {
  useEffect(() => {
    if (useTourStore.getState().tour) return;
    if (!startTour("full", { autoPlay: true })) {
      console.error("[summex] Tour failed to start", "full");
      toast.error("Tour not available");
    }
  }, []);

  return <DemoCatalogPage />;
}
