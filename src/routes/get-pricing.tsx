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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Get pricing</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Describe the house, answer a few follow-ups, then see a live monthly price
          you can adjust — Counter $0, Full service $149, Multi-operator $299 + tenants.
          Setup defaults to $0. Guest processing is a note, not part of software $.
        </p>
        <div className="mt-8">
          <IntakeWizard initialToken={t} />
        </div>
      </main>
    </MarketingShell>
  );
}
