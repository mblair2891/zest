import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
});

const ITEMS = [
  ["Floor & order", "Tables, checks, modifiers, split tender."],
  ["Kitchen & bar", "Expo rails, bump, vendor-routed tickets."],
  ["Halls & pods", "One guest pay, settlement, pad maps."],
  ["Staff", "Owner, manager, cashier — org-wide or per location."],
  ["Summex Payments", "The only merchant processor in the product."],
  ["Control plane", "Orgs, locations, packages, invites at summex.app/dashboard."],
];

function FeaturesPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-black tracking-tighter">Product</h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          The application at app.summex.app is shared. Features unlock from the
          plan on the organization, then the packages on the location.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {ITEMS.map(([title, body]) => (
            <li key={title} className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </main>
    </MarketingShell>
  );
}
