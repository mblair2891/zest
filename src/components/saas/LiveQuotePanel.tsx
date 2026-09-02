import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ToggleChip } from "./WizardChrome";
import { generateQuote, planLabel } from "@/lib/saas/pricing";
import {
  applyQuoteToggles,
  extraStationCount,
  isMultiOperatorHouse,
  kioskCount,
  odsStationCount,
  orderStationCount,
  tenantEntityCount,
  terminalNeedOf,
  wantsFullServiceFloor,
  wantsOpsPack,
} from "@/lib/saas/quote-catalog";
import type { IntakeAnswers, QuoteCatalog } from "@/lib/saas/prospect-types";
import { DEFAULT_PRICING_RULES } from "@/lib/saas/pricing";
import { QuoteSummary } from "./QuoteSummary";

export function LiveQuotePanel({
  answers,
  catalog,
  onChange,
}: {
  answers: IntakeAnswers;
  catalog: QuoteCatalog;
  onChange: (next: IntakeAnswers) => void;
}) {
  const rules = { ...DEFAULT_PRICING_RULES, quoteCatalog: catalog };
  const quote = generateQuote(answers, rules, { draft: true });
  const multi = isMultiOperatorHouse(answers);
  const full = wantsFullServiceFloor(answers);
  const ops = wantsOpsPack(answers);
  const extra = extraStationCount(answers, catalog);
  const kiosks = kioskCount(answers);
  const term = terminalNeedOf(answers);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recommended package
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight">{planLabel(quote.planSlug)}</p>
        <p className="text-sm text-muted-foreground">
          {quote.planSlug === "starter" && "Counter POS + kitchen display — $0 / mo software."}
          {quote.planSlug === "full_service" &&
            `Full service floor — ${formatCurrency(catalog.fullServiceCents)} / location / mo.`}
          {quote.planSlug === "food_hall" &&
            `Multi-operator host — ${formatCurrency(catalog.multiOpHostCents)} / location / mo + ${formatCurrency(catalog.tenantCents)} per tenant.`}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Modules
        </p>
        <ToggleChip
          on
          label={`Base counter + 1 ODS · ${formatCurrency(catalog.baseCents)}`}
          hint="Included. Always on."
          onClick={() => undefined}
        />
        <ToggleChip
          on={full && !multi}
          label={`Full service floor / host / sections / closeout · ${formatCurrency(catalog.fullServiceCents)} / loc`}
          hint="Dining room, reservations, waitlist, server closeout."
          onClick={() => onChange(applyQuoteToggles(answers, { fullService: !(full && !multi), multiOp: false }))}
        />
        <ToggleChip
          on={multi}
          label={`Multi-operator / hall host · ${formatCurrency(catalog.multiOpHostCents)} + ${formatCurrency(catalog.tenantCents)} / tenant`}
          hint="One guest check. Each brand is its own Quantum Payments merchant."
          onClick={() => onChange(applyQuoteToggles(answers, { multiOp: !multi }))}
        />
        {multi && (
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Tenant operators</span>
            <Input
              type="number"
              min={1}
              value={tenantEntityCount(answers)}
              onChange={(e) =>
                onChange(applyQuoteToggles(answers, { tenantCount: Number(e.target.value) || 1 }))
              }
            />
          </label>
        )}
        <ToggleChip
          on={ops}
          label={`Ops pack — recipes, costing, staffing recs, HR, payroll export · ${formatCurrency(catalog.opsPackCents)}`}
          onClick={() => onChange(applyQuoteToggles(answers, { opsPack: !ops }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Order stations</span>
            <Input
              type="number"
              min={1}
              value={orderStationCount(answers)}
              onChange={(e) =>
                onChange(applyQuoteToggles(answers, { orderStations: Number(e.target.value) || 1 }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">ODS (kitchen/bar displays)</span>
            <Input
              type="number"
              min={0}
              value={odsStationCount(answers)}
              onChange={(e) =>
                onChange(applyQuoteToggles(answers, { odsStations: Number(e.target.value) || 0 }))
              }
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          First {catalog.includedStations} order+ODS stations included. Extra {extra} ×{" "}
          {formatCurrency(catalog.extraStationCents)}.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            Kiosks · {formatCurrency(catalog.kioskCents)} each
          </span>
          <Input
            type="number"
            min={0}
            value={kiosks}
            onChange={(e) =>
              onChange(applyQuoteToggles(answers, { kioskCount: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <div className="grid gap-2">
          {(
            [
              ["none", "We have readers / BYO terminals"],
              ["lease", `Lease Quantum terminals · ${formatCurrency(catalog.terminalLeaseCents)} / mo each`],
              ["buy", "Buy terminals (one-time, if priced in settings)"],
            ] as const
          ).map(([id, label]) => (
            <ToggleChip
              key={id}
              on={term === id}
              label={label}
              onClick={() => onChange(applyQuoteToggles(answers, { terminalNeed: id }))}
            />
          ))}
        </div>
      </div>

      <QuoteSummary quote={quote} compact />
      <p className="text-xs text-muted-foreground">
        Toggle anything above — monthly software recalculates. Processing (Quantum Payments /
        cash-discount) is a note, not part of software $. Setup defaults to $0.
      </p>
    </div>
  );
}
