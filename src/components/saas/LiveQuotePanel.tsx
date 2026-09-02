import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ToggleChip } from "./WizardChrome";
import { generateQuote, planLabel } from "@/lib/saas/pricing";
import {
  applyQuoteToggles,
  BYO_CHECKLIST,
  HARDWARE_LEAD,
  extraStationCount,
  isMultiOperatorHouse,
  kioskCount,
  odsStationCount,
  orderStationCount,
  otherPartnerSkus,
  tenantEntityCount,
  wantsFullServiceFloor,
  wantsOpsPack,
} from "@/lib/saas/quote-catalog";
import type { IntakeAnswers, QuoteCatalog } from "@/lib/saas/prospect-types";
import { emptyIntakeHardware } from "@/lib/saas/quote-catalog";
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
  const hw = answers.hardware ?? emptyIntakeHardware();
  const others = otherPartnerSkus(catalog);

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
        <div className="space-y-2 rounded-2xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hardware
          </p>
          <p className="text-sm text-muted-foreground">{HARDWARE_LEAD}</p>
          <ToggleChip
            on={hw.ownsTabletsPrintersDrawers !== false}
            label="Provide your own hardware — $0"
            hint="Tablets, printers, drawers, stands. Default."
            onClick={() =>
              onChange(
                applyQuoteToggles(answers, {
                  ownsTabletsPrintersDrawers: !(hw.ownsTabletsPrintersDrawers !== false),
                }),
              )
            }
          />
          {hw.ownsTabletsPrintersDrawers !== false && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {BYO_CHECKLIST.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          )}
          <ToggleChip
            on={hw.shipReaders}
            label="Ship card readers from our payments partner"
            hint="Typically more expensive than a BYO ~$75 Finix/Quantum reader. Drop-ships to your site."
            onClick={() => onChange(applyQuoteToggles(answers, { shipReaders: !hw.shipReaders }))}
          />
          {hw.shipReaders && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">How many readers</span>
                <Input
                  type="number"
                  min={1}
                  value={hw.readerQty || 1}
                  onChange={(e) =>
                    onChange(applyQuoteToggles(answers, { readerQty: Number(e.target.value) || 1 }))
                  }
                />
              </label>
              <div className="space-y-1">
                <ToggleChip
                  on={hw.readerPay !== "lease"}
                  label="Purchase (one-time, partner priced)"
                  onClick={() => onChange(applyQuoteToggles(answers, { readerPay: "purchase" }))}
                />
                <ToggleChip
                  on={hw.readerPay === "lease"}
                  label="Monthly lease (partner priced)"
                  onClick={() => onChange(applyQuoteToggles(answers, { readerPay: "lease" }))}
                />
              </div>
            </div>
          )}
          <ToggleChip
            on={hw.shipPartnerDevices}
            label="Ship kiosk / stand / other partner devices"
            hint="Optional. Partner hardware, typically more expensive than BYO. Ships to your site."
            onClick={() =>
              onChange(applyQuoteToggles(answers, { shipPartnerDevices: !hw.shipPartnerDevices }))
            }
          />
          {hw.shipPartnerDevices &&
            others.map((sku) => (
              <label key={sku.id} className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  {sku.customerFacingName}
                  {sku.monthlyCents > 0
                    ? ` · ${formatCurrency(sku.monthlyCents)} / mo`
                    : ""}
                  {sku.oneTimeCents > 0
                    ? ` · ${formatCurrency(sku.oneTimeCents)} one-time`
                    : ""}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={hw.partnerSkuQty?.[sku.id] ?? 0}
                  onChange={(e) =>
                    onChange(
                      applyQuoteToggles(answers, {
                        partnerSkuQty: { [sku.id]: Number(e.target.value) || 0 },
                      }),
                    )
                  }
                />
              </label>
            ))}
        </div>
      </div>

      <QuoteSummary quote={quote} compact />
      <p className="text-xs text-muted-foreground">
        Toggle anything above — monthly software recalculates separately from hardware.
        Processing (Quantum Payments / cash-discount) is a note, not part of software $.
        Setup defaults to $0.
      </p>
    </div>
  );
}
