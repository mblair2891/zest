import { formatCurrency } from "@/lib/utils";
import { PRODUCT_NAME, POWERED_BY } from "@/lib/platform/brand";
import { planLabel, statusLabel } from "@/lib/saas/pricing";
import type { ProspectDetail } from "@/lib/saas/prospect-types";

export function QuotePrintView({ detail }: { detail: ProspectDetail }) {
  const quote = detail.quote;
  if (!quote) return null;
  const software = quote.lineItems.filter((i) => !i.oneTime && i.bucket !== "hardware");
  const hwMonthly = quote.lineItems.filter((i) => !i.oneTime && i.bucket === "hardware");
  const hwOnce = quote.lineItems.filter((i) => i.oneTime && i.bucket === "hardware");
  const oneTime = quote.lineItems.filter((i) => i.oneTime && i.bucket !== "hardware");
  const company = detail.answers.company;
  return (
    <article className="mx-auto max-w-2xl bg-surface p-8 text-foreground print:max-w-none print:p-0">
      <header className="border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">{PRODUCT_NAME}</p>
        <p className="mt-1 text-xs text-muted-foreground">Powered by {POWERED_BY}</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Software proposal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {company.legalName || "Prospect"}
          {company.dba ? ` · ${company.dba}` : ""}
        </p>
        <p className="text-sm text-muted-foreground">{company.billingEmail}</p>
      </header>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {quote.planName || planLabel(quote.planSlug)} · {quote.locationCount ?? 1} location
            {(quote.locationCount ?? 1) === 1 ? "" : "s"}
            {quote.trialDays ? ` · ${quote.trialDays}-day trial` : ""}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular">
            {formatCurrency(quote.monthlyCents)}
            <span className="ml-1 text-base font-medium text-muted-foreground">/ mo software</span>
          </p>
          {quote.onboardingFeeCents > 0 && (
            <p className="text-sm text-muted-foreground">
              Setup {formatCurrency(quote.onboardingFeeCents)} one-time
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Hardware {(quote.hardwareMonthlyCents ?? 0) > 0
              ? `${formatCurrency(quote.hardwareMonthlyCents ?? 0)} / mo`
              : "BYO $0"}
            {(quote.hardwareOneTimeCents ?? 0) > 0
              ? ` · ${formatCurrency(quote.hardwareOneTimeCents ?? 0)} one-time partner drop-ship`
              : ""}
          </p>
          {quote.expiresAt && (
            <p className="text-sm text-muted-foreground">
              Expires {new Date(quote.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{statusLabel(detail.status)}</p>
      </div>
      {quote.featureList && quote.featureList.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            From intake
          </p>
          <ul className="mt-1 list-disc pl-4 text-sm">
            {quote.featureList.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {quote.stationCounts && (
        <p className="mt-2 text-xs text-muted-foreground">
          Entities {quote.entityCount ?? 1} · stations order {quote.stationCounts.order} / ODS{" "}
          {quote.stationCounts.ods} / host {quote.stationCounts.host}
        </p>
      )}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {software.map((line) => (
            <tr key={line.id} className="border-b border-border">
              <td className="py-2">{line.label}</td>
              <td className="py-2">{line.qty}</td>
              <td className="py-2 text-right tabular">{formatCurrency(line.totalCents)}</td>
            </tr>
          ))}
          {hwMonthly.map((line) => (
            <tr key={line.id} className="border-b border-border">
              <td className="py-2">
                {line.label} <span className="text-muted-foreground">(hardware / mo)</span>
              </td>
              <td className="py-2">{line.qty}</td>
              <td className="py-2 text-right tabular">{formatCurrency(line.totalCents)}</td>
            </tr>
          ))}
          {hwOnce.map((line) => (
            <tr key={line.id} className="border-b border-border">
              <td className="py-2">
                {line.label} <span className="text-muted-foreground">(hardware one-time)</span>
              </td>
              <td className="py-2">{line.qty}</td>
              <td className="py-2 text-right tabular">{formatCurrency(line.totalCents)}</td>
            </tr>
          ))}
          {oneTime.map((line) => (
            <tr key={line.id} className="border-b border-border">
              <td className="py-2">
                {line.label} <span className="text-muted-foreground">(one-time)</span>
              </td>
              <td className="py-2">{line.qty}</td>
              <td className="py-2 text-right tabular">{formatCurrency(line.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-xs text-muted-foreground">
        {quote.processingNote ||
          "Guest card processing is Quantum Payments, billed separately from software."}{" "}
        Gift cards are first-party. Bring your own tablets, printers, cash drawers, stands.
        Card readers can be yours or shipped by our payments partner to your site. This
        snapshot does not change if the catalog changes later.
      </p>
    </article>
  );
}
