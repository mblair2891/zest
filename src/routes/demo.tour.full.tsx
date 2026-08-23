import { useLayoutEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DemoPlayer } from "@/components/demo/DemoPlayer";
import { DemoVenueShell } from "@/components/demo/DemoVenueShell";
import { FULL_TOUR_SCRIPT } from "@/lib/demo/scripts";
import { enterDemoSession } from "@/lib/demo/session";

export const Route = createFileRoute("/demo/tour/full")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Full product tour · Summex" }],
  }),
  component: FullTourPage,
});

function FullTourPage() {
  const [done, setDone] = useState(false);
  useLayoutEffect(() => {
    enterDemoSession("food_hall");
  }, []);

  if (done) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg px-4 pt-[var(--grok-banner-h,0px)] text-center">
        <div className="max-w-md">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Full product tour
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium">That is the house.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Demo data never becomes a tenant. Continue with a type room or request
            pricing.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/demo" className="text-sm font-medium text-primary underline">
              All demos
            </Link>
            <Link to="/get-pricing" className="text-sm font-medium underline">
              Get pricing
            </Link>
            <Link to="/guide" className="text-sm text-muted-foreground underline">
              Operators Guide
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <DemoVenueShell type="food_hall" hideTourCta />
      <DemoPlayer
        script={FULL_TOUR_SCRIPT}
        autoPlay
        onExit={() => setDone(true)}
      />
    </div>
  );
}
