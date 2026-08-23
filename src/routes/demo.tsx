import { createFileRoute } from "@tanstack/react-router";
import { DemoCatalogPage } from "@/components/demo/DemoCatalogPage";

export const Route = createFileRoute("/demo")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Prospect demos · Summex" }],
  }),
  component: DemoCatalogPage,
});
