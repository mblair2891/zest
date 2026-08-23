import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

const PLANS = [
  {
    name: "Starter",
    price: "$0 trial",
    note: "1 location · core POS, KDS, reports, menu",
  },
  {
    name: "Full service",
    price: "Per location",
    note: "Host stand, labor, inventory, guests, marketing",
  },
  {
    name: "Food hall",
    price: "Per location",
    note: "Settlement, vendor portal, multi-merchant checks",
  },
];

function PricingPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-black tracking-tighter">Pricing</h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Software fees for Summex. Guest card processing is Quantum Payments — billed
          separately, never through a POS processor picker.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => (
            <li
              key={p.name}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="mt-2 text-2xl font-black tracking-tight">{p.price}</p>
              <p className="mt-2 text-sm text-muted-foreground">{p.note}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/get-pricing"
            className="inline-flex h-12 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Build a quote
          </Link>
          <Link
            to="/signup"
            className="inline-flex h-12 items-center rounded-xl border border-border px-5 text-sm font-semibold"
          >
            Create account
          </Link>
        </div>
      </main>
    </MarketingShell>
  );
}
