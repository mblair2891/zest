import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TAX_APPLY_LABEL,
  TAX_APPLY_TO,
  newTaxRate,
  taxRateFractionFromRates,
  type TaxApplyTo,
  type TaxRateDef,
} from "@/lib/pos/tax-rates";
import { useTaxSuggestionStore } from "@/lib/pos/tax-suggestion";
import { usePosStore } from "@/lib/pos/store";
import { ackVenueBulletinFn } from "@/lib/saas/reg-bulletins-api";

export function TaxRatesEditor({
  rates,
  disabled,
  onChange,
}: {
  rates: TaxRateDef[];
  disabled?: boolean;
  onChange: (next: TaxRateDef[]) => void;
}) {
  const patch = (id: string, next: Partial<TaxRateDef>) => {
    onChange(rates.map((r) => (r.id === id ? { ...r, ...next } : r)));
  };
  const bulletinId = useTaxSuggestionStore((s) => s.bulletinId);
  const suggestion = useTaxSuggestionStore((s) => s.suggestion);
  const locId = usePosStore((s) => s.tenantLocationId);
  const applySuggestion = () => {
    if (!suggestion) return;
    onChange([...rates, newTaxRate(suggestion)]);
    if (locId && bulletinId) {
      void ackVenueBulletinFn({
        data: { locationId: locId, bulletinId, status: "saved" },
      });
    }
    useTaxSuggestionStore.getState().clear();
  };
  const dismissSuggestion = () => {
    if (locId && bulletinId) {
      void ackVenueBulletinFn({
        data: { locationId: locId, bulletinId, status: "dismissed" },
      });
    }
    useTaxSuggestionStore.getState().clear();
  };
  return (
    <div className="space-y-3" data-tax-rates>
      <p className="text-sm font-medium">Taxes</p>
      {bulletinId ? (
        <div
          data-tax-suggestion
          className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm"
        >
          <p className="font-medium">Suggested rate from bulletin</p>
          {suggestion ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {suggestion.name} · {suggestion.percent}% — not on the list until you Save.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              No rate was attached. Review your named rates. Nothing is changed until you Save.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestion ? (
              <Button type="button" size="sm" disabled={disabled} onClick={applySuggestion}>
                Save suggested rate
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={dismissSuggestion}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Named rates — not a JSON blob. Zero rates is no tax; guest checks print no tax line.
        Menu prices stay cash-source; tax is on top unless Inclusive is on. Stacked applies to
        the pre-tax amount; Compound applies to the running taxable.
      </p>
      {rates.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          No tax. Add a rate (Sales, Restaurant, City, Tourism, …) or leave empty.
        </p>
      )}
      <div className="space-y-2">
        {rates.map((r) => (
          <div
            key={r.id}
            className="grid gap-2 rounded-xl border border-border bg-bg p-3 sm:grid-cols-[1fr_5.5rem_7rem_8rem_auto]"
            data-tax-rate={r.id}
          >
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Name</span>
              <Input
                disabled={disabled}
                value={r.name}
                onChange={(e) => patch(r.id, { name: e.target.value })}
                placeholder="Sales"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">%</span>
              <Input
                disabled={disabled}
                inputMode="decimal"
                value={String(r.percent)}
                onChange={(e) =>
                  patch(r.id, { percent: parseFloat(e.target.value) || 0 })
                }
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Applies to</span>
              <select
                disabled={disabled}
                className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
                value={r.appliesTo}
                onChange={(e) => patch(r.id, { appliesTo: e.target.value as TaxApplyTo })}
              >
                {TAX_APPLY_TO.map((id) => (
                  <option key={id} value={id}>
                    {TAX_APPLY_LABEL[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Stack</span>
              <select
                disabled={disabled}
                className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
                value={r.compound}
                onChange={(e) =>
                  patch(r.id, { compound: e.target.value === "compound" ? "compound" : "stacked" })
                }
              >
                <option value="stacked">Stacked (pre-tax)</option>
                <option value="compound">Compound (running)</option>
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex items-center gap-1.5 pb-2 text-xs">
                <input
                  type="checkbox"
                  disabled={disabled}
                  className="h-4 w-4 rounded border-border"
                  checked={r.inclusive}
                  onChange={(e) => patch(r.id, { inclusive: e.target.checked })}
                />
                Inclusive
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => onChange(rates.filter((x) => x.id !== r.id))}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...rates,
            newTaxRate({
              name: rates.length ? "Restaurant" : "Sales",
              percent: rates.length ? 2.25 : 6.5,
              appliesTo: "all",
            }),
          ])
        }
      >
        Add rate
      </Button>
    </div>
  );
}

export function ratesPatch(next: TaxRateDef[]): {
  taxRates: TaxRateDef[];
  taxRate: number;
} {
  return { taxRates: next, taxRate: taxRateFractionFromRates(next) };
}
