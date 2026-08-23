import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { IntakeWizard } from "@/components/saas/IntakeWizard";

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
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Stage A
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tighter">Get pricing</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Tell us how you operate. We snapshot a quote from the current package catalog
          and rules — later catalog changes will not rewrite this proposal.
        </p>
        <div className="mt-8">
          <IntakeWizard initialToken={t} />
        </div>
      </main>
    </MarketingShell>
  );
}
