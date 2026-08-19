import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";

export const Route = createFileRoute("/")({
  ssr: false,
  component: PosApp,
});
