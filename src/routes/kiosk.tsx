import { createFileRoute } from "@tanstack/react-router";
import { KioskApp } from "@/components/kiosk/KioskApp";

export const Route = createFileRoute("/kiosk")({
  ssr: false,
  component: KioskApp,
});
