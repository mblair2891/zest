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
  const software = quote.lineItems.filter((i) => !i.oneTime && i.bucket !== "hardware");
  const hwMonthly = quote.lineItems.filter((i) => !i.oneTime && i.bucket === "hardware");
  const hwOnce = quote.lineItems.filter((i) => i.oneTime && i.bucket === "hardware");
  const oneTime = quote.lineItems.filter((i) => i.oneTime && i.bucket !== "hardware");
  const hwMo = quote.hardwareMonthlyCents ?? hwMonthly.reduce((s, i) => s + i.totalCents, 0);
  const hwBuy = quote.hardwareOneTimeCents ?? hwOnce.reduce((s, i) => s + i.totalCents, 0);
  const expires = quote.expiresAt ? new Date(quote.expiresAt).toLocaleDateString() : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pricing proposal
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular">
            {formatCurrency(quote.monthlyCents)}
            <span className="ml-1 text-base font-medium text-muted-foreground">/ mo software</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {quote.planName || planLabel(quote.planSlug)}
            {quote.locationCount ? ` · ${quote.locationCount} loc` : ""}
            {quote.entityCount ? ` · ${quote.entityCount} entit${quote.entityCount === 1 ? "y" : "ies"}` : ""}
            {quote.trialDays ? ` · ${quote.trialDays}-day trial` : ""}
            {" · "}
            annual {formatCurrency(quote.annualCents)}
            {quote.onboardingFeeCents > 0
              ? ` · setup ${formatCurrency(quote.onboardingFeeCents)}`
              : " · no setup fee"}
            {hwMo > 0 ? ` · hardware ${formatCurrency(hwMo)}/mo` : ""}
            {hwBuy > 0 ? ` · hardware ${formatCurrency(hwBuy)} one-time` : " · hardware BYO $0"}
          </p>
          {expires && (
            <p className="text-xs text-muted-foreground">Expires {expires}</p>
          )}
        </div>
        {status && <Badge variant="info">{statusLabel(status)}</Badge>}
      </div>

      {quote.featureList && quote.featureList.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            From intake
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
            {quote.featureList.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {quote.stationCounts && (
        <p className="text-xs text-muted-foreground">
          Stations from intake: order {quote.stationCounts.order} · ODS {quote.stationCounts.ods} ·
          host {quote.stationCounts.host}
        </p>
      )}

      {quote.byoChecklist && quote.byoChecklist.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            You provide (BYO)
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
            {quote.byoChecklist.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        <li className="px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Software
        </li>
        {software.map((line) => (
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
        {(hwMonthly.length > 0 || hwOnce.length > 0) && (
          <li className="px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Hardware (separate from software)
          </li>
        )}
        {hwMonthly.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
            <span>
              <span className="block font-medium">{line.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {line.qty} × {formatCurrency(line.unitCents)} / mo
                {line.note ? ` · ${line.note}` : ""}
              </span>
            </span>
            <span className="tabular">{formatCurrency(line.totalCents)}</span>
          </li>
        ))}
        {hwOnce.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
            <span>
              <span className="block font-medium">{line.label}</span>
              <span className="text-[11px] text-muted-foreground">
                One-time · partner drop-ship to your site
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

      <p className="text-xs text-muted-foreground">
        {quote.commsNote ||
          "Email included. SMS: 500/mo included, extra at cost. AI reports in Ops pack."}
      </p>
      <p className="text-xs text-muted-foreground">
        {quote.processingNote ||
          "Guest card processing is Quantum Payments, billed separately from software."}
      </p>

      {quote.changeRequest && (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
          Changes requested {new Date(quote.changeRequest.at).toLocaleString()}:{" "}
          {quote.changeRequest.message}
        </p>
      )}

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
