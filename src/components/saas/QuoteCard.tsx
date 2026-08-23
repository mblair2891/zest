import { formatCurrency } from "@/lib/utils";
import type { QuoteSnapshot } from "@/lib/saas/prospect-types";

export function QuoteCard({ quote }: { quote: QuoteSnapshot }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Pricing proposal
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Stat label="Monthly software" value={formatCurrency(quote.monthlyCents)} />
        <Stat label="Annual prepay" value={formatCurrency(quote.annualCents)} />
        <Stat label="One-time onboarding" value={formatCurrency(quote.oneTimeCents)} />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-2">Item</th>
              <th className="py-1.5 pr-2">Qty</th>
              <th className="py-1.5 pr-2">Unit</th>
              <th className="py-1.5">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {quote.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-1.5 pr-2">
                  {l.label}
                  <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                    {l.recurring === "one_time" ? "one-time" : "mo"}
                  </span>
                </td>
                <td className="py-1.5 pr-2 tabular">{l.quantity}</td>
                <td className="py-1.5 pr-2 tabular">
                  {formatCurrency(l.unitCents)}
                </td>
                <td className="py-1.5 tabular font-medium">
                  {formatCurrency(l.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {quote.assumptions}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Guest card processing is Zest Payments only. Rules {quote.rulesVersion}.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold tabular">{value}</p>
    </div>
  );
}
