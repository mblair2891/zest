import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { IntakeWizard } from "@/components/saas/IntakeWizard";
import {
  parseGetAPriceSearch,
  type GetAPriceSearch,
} from "@/lib/saas/get-a-price-draft";

/** Interview + live quote. Not `/whitepaper`. */
export const Route = createFileRoute("/get-pricing")({
  validateSearch: (s: Record<string, unknown>): GetAPriceSearch => parseGetAPriceSearch(s),
  component: GetPricingPage,
});

function GetPricingPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <MarketingShell>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Stage A
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Get a price</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          A short selector: house shape, service style, modules, and counts. The quote
          updates as you pick. Contact is last. Tablets, printers, and drawers are BYO;
          live cards use Finix / Quantum readers we ship.
        </p>
        <div className="mt-8">
          <IntakeWizard
            search={search}
            onSearch={(next) => {
              void navigate({
                search: (prev) => (typeof next === "function" ? next(prev) : next),
                replace: true,
              });
            }}
          />
        </div>
      </main>
    </MarketingShell>
  );
}
