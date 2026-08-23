import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { planLabel, statusLabel } from "@/lib/saas/pricing";
import type { ProspectStatus, QuoteSnapshot } from "@/lib/saas/prospect-types";

export function QuoteSummary({
  quote,
  status,
  compact,
}: {
  quote: QuoteSnapshot;
  status?: ProspectStatus;
  compact?: boolean;
}) {
  const monthly = quote.lineItems.filter((i) => !i.oneTime);
  const oneTime = quote.lineItems.filter((i) => i.oneTime);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pricing proposal
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular">
            {formatCurrency(quote.monthlyCents)}
            <span className="ml-1 text-base font-medium text-muted-foreground">/ mo</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {planLabel(quote.planSlug)} · annual prepaid {formatCurrency(quote.annualCents)}
            {quote.onboardingFeeCents > 0
              ? ` · onboarding ${formatCurrency(quote.onboardingFeeCents)}`
              : ""}
          </p>
        </div>
        {status && <Badge variant="info">{statusLabel(status)}</Badge>}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {monthly.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
            <span>
              <span className="block font-medium">{line.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {line.qty} × {formatCurrency(line.unitCents)}
                {line.note ? ` · ${line.note}` : ""}
              </span>
            </span>
            <span className="tabular">{formatCurrency(line.totalCents)}</span>
          </li>
        ))}
        {oneTime.map((line) => (
          <li
            key={line.id}
            className="flex items-start justify-between gap-3 bg-surface-2 px-4 py-3 text-sm"
          >
            <span>
              <span className="block font-medium">{line.label}</span>
              <span className="text-[11px] text-muted-foreground">One-time</span>
            </span>
            <span className="tabular">{formatCurrency(line.totalCents)}</span>
          </li>
        ))}
      </ul>

      {!compact && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Assumptions
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {quote.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
