import { Link } from "@tanstack/react-router";
import { LandingFrame } from "@/components/marketing/LandingFrame";
import { Button } from "@/components/ui/button";

/** Public demo catalog is retired. Keep this page as a Get pricing landing if linked. */
export function DemoCatalogPage() {
  return (
    <LandingFrame>
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mkt-kicker font-display text-xs text-champagne uppercase">
          Summex
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ivory sm:text-5xl">
          No public demo houses.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          There is no PIN pad on this site and no seeded restaurant. Get pricing
          starts SaaS onboarding. After the host is ready, the owner signs in and
          trains on Quantum Payments sandbox.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/get-pricing">Get pricing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/guide">Operators Guide</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </main>
    </LandingFrame>
  );
}
