import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { IntakeWizard } from "@/components/saas/IntakeWizard";

/** Interview + live quote. Not `/whitepaper`. */
export const Route = createFileRoute("/get-pricing")({
  validateSearch: (s: Record<string, unknown>): { t?: string } => {
    const t = typeof s.t === "string" && s.t.length > 0 ? s.t : undefined;
    return t ? { t } : {};
  },
  component: GetPricingPage,
});

function GetPricingPage() {
  const { t } = Route.useSearch();
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
          <IntakeWizard initialToken={t} />
        </div>
      </main>
    </MarketingShell>
  );
}
