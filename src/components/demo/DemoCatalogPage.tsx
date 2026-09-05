import { Link } from "@tanstack/react-router";
import { LandingCta, LandingFrame } from "@/components/marketing/LandingFrame";

/** Sales demo — not a seeded restaurant and not the platform console. */
export function DemoCatalogPage() {
  return (
    <LandingFrame>
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mkt-kicker font-display text-xs text-champagne uppercase">
          Demo
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ivory sm:text-5xl">
          See the floor, kitchen, and one guest check.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          There is no public PIN pad and no seeded restaurant on this site. A
          walkthrough happens after you have a house — training uses Quantum
          Payments sandbox. Get a price to start, or log in if you already have
          an account.
        </p>
        <ul className="mt-10 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="font-medium text-ivory">Order / ODS / host</span>
            {" — "}
            three station screens. Staff PIN on{" "}
            <span className="text-ivory">/?station=</span> or{" "}
            <span className="text-ivory">/station/order</span> — never the sales
            home.
          </li>
          <li>
            <span className="font-medium text-ivory">One guest check</span>
            {" — "}
            even when operators differ. Receipt grouped by vendor. Cards through
            Quantum Payments.
          </li>
          <li>
            <span className="font-medium text-ivory">Guide</span>
            {" — "}
            operations only (order, ODS, host, owner). No SaaS admin, CRM, or
            pipeline in the public Guide or white paper.
          </li>
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <LandingCta to="/get-pricing">Get a price</LandingCta>
          <LandingCta to="/guide" tone="ghost">
            Guide
          </LandingCta>
          <LandingCta to="/login" tone="ghost">
            Log in
          </LandingCta>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Already onboarded?{" "}
          <Link to="/login" className="text-champagne hover:text-ivory">
            Log in
          </Link>{" "}
          goes to the platform dashboard (Admin) or your venue home — not this
          page.
        </p>
      </main>
    </LandingFrame>
  );
}
