import { createFileRoute } from "@tanstack/react-router";
import { PlatformApp } from "@/components/pos/PlatformApp";

export const Route = createFileRoute("/platform")({
  ssr: false,
  component: PlatformApp,
});
