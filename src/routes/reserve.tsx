import { createFileRoute, Link } from "@tanstack/react-router";
import { KioskApp } from "@/components/kiosk/KioskApp";

export const Route = createFileRoute("/reserve")({
  ssr: false,
  component: ReservePage,
});

function ReservePage() {
  return (
    <div className="min-h-[100dvh] bg-bg">
      <p className="px-4 pt-[calc(var(--grok-banner-h,0px)+0.5rem)] text-center text-xs text-muted-foreground">
        Book a table, then check in at the kiosk.{" "}
        <Link to="/kiosk" className="underline">
          Open kiosk
        </Link>
      </p>
      <KioskApp />
    </div>
  );
}
