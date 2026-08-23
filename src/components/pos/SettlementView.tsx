import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import type { SettlementPeriodType, HostCutType } from "@/lib/pos/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { CHARGEBACK_FEE_CENTS, PAYMENTS_BRAND } from "@/lib/platform/brand";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { SetupAssistButton } from "@/components/assist/SetupAssistDialog";

export function SettlementView() {
  const setView = usePosStore((s) => s.setView);
  const config = usePosStore((s) => s.settlementConfig);
  const vendors = usePosStore((s) => s.vendors);
  const periods = usePosStore((s) => s.settlementPeriods);
  const update = usePosStore((s) => s.updateSettlementConfig);
  const closePeriod = usePosStore((s) => s.closeSettlementPeriod);
  const markPaid = usePosStore((s) => s.markSettlementPaid);
  const preview = usePosStore((s) => s.getOpenPeriodPreview);
  const chargebacks = usePosStore((s) => s.chargebacks ?? []);
  const fileChargeback = usePosStore((s) => s.fileChargeback);
  const resolveChargeback = usePosStore((s) => s.resolveChargeback);
  const [flash, setFlash] = useState<string | null>(null);

  const orders = usePosStore((s) => s.orders);
  const live = useMemo(
    () => preview(),
    // orders/config/vendors change → recompute open period
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, config, vendors, preview],
  );

  const onClose = () => {
    const res = closePeriod();
    if (!res.ok) setFlash(res.error ?? "Failed");
    else
      setFlash(
        `Period closed. Host cut ${formatCurrency(res.period!.hostCutTotalCents)}. Electronic payouts ready.`,
      );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Host settlement · {config.hostName}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <SetupAssistButton domain="operator" label="Add operator" />
            <Button size="sm" variant="outline" onClick={() => setView("ledger")}>
              Ledger
            </Button>
            <GuideLearnLink topicId="settlement">Learn: settlement</GuideLearnLink>
            <GuideLearnLink topicId="chargebacks">Learn: chargebacks</GuideLearnLink>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          One host brand ({config.hostName}), multiple operators. Guest pays
          once via {PAYMENTS_BRAND}. Period payouts are addressed to each
          operator’s account placeholder — not live ACH.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {flash && (
          <p className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            {flash}
          </p>
        )}

        {/* Platform settings */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Platform settings</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-xs text-muted-foreground">
              Building / location name
              <Input
                className="mt-1"
                value={config.locationName}
                onChange={(e) => update({ locationName: e.target.value })}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Settlement period
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2 text-sm text-foreground"
                value={config.periodType}
                onChange={(e) =>
                  update({
                    periodType: e.target.value as SettlementPeriodType,
                  })
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom_days">Custom days</option>
              </select>
            </label>
            {config.periodType === "custom_days" && (
              <label className="block text-xs text-muted-foreground">
                Days per period
                <Input
                  className="mt-1"
                  type="number"
                  value={config.customPeriodDays}
                  onChange={(e) =>
                    update({
                      customPeriodDays: parseInt(e.target.value, 10) || 7,
                    })
                  }
                />
              </label>
            )}
            <label className="block text-xs text-muted-foreground">
              Card processing fee (%)
              <Input
                className="mt-1"
                type="number"
                step="0.1"
                value={config.cardFeePercent}
                onChange={(e) =>
                  update({
                    cardFeePercent: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Host / building operator name
              <Input
                className="mt-1"
                value={config.hostName}
                onChange={(e) => update({ hostName: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm pt-5">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={config.hostCutEnabled}
                onChange={(e) =>
                  update({ hostCutEnabled: e.target.checked })
                }
              />
              Host takes a cut
            </label>
            {config.hostCutEnabled && (
              <>
                <label className="block text-xs text-muted-foreground">
                  Host cut type
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
                    value={config.hostCutType}
                    onChange={(e) =>
                      update({
                        hostCutType: e.target.value as HostCutType,
                      })
                    }
                  >
                    <option value="percent_of_gross">
                      % of vendor gross sales
                    </option>
                    <option value="fixed_per_vendor">
                      Fixed $ per vendor / period
                    </option>
                  </select>
                </label>
                {config.hostCutType === "percent_of_gross" ? (
                  <label className="block text-xs text-muted-foreground">
                    Host cut (%)
                    <Input
                      className="mt-1"
                      type="number"
                      step="0.1"
                      value={config.hostCutPercent}
                      onChange={(e) =>
                        update({
                          hostCutPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                ) : (
                  <label className="block text-xs text-muted-foreground">
                    Fixed cut per vendor ($)
                    <Input
                      className="mt-1"
                      type="number"
                      step="0.01"
                      value={(config.hostCutFixedCents / 100).toFixed(2)}
                      onChange={(e) =>
                        update({
                          hostCutFixedCents: Math.round(
                            (parseFloat(e.target.value) || 0) * 100,
                          ),
                        })
                      }
                    />
                  </label>
                )}
              </>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">
              Sales tax remitted by
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
                value={config.taxRemittedBy ?? "host"}
                onChange={(e) =>
                  update({
                    taxRemittedBy: e.target.value as "host" | "vendor",
                  })
                }
              >
                <option value="host">Building host (recommended)</option>
                <option value="vendor">Each vendor remits own tax</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm pt-5">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!config.tipPoolWithVendors}
                onChange={(e) =>
                  update({ tipPoolWithVendors: e.target.checked })
                }
              />
              Include hall vendors in tip pool (advanced)
            </label>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Policy: merchandise shares go to operators; tax remitted by{" "}
            {config.taxRemittedBy === "vendor" ? "each operator" : "the host"};
            tips {config.tipPoolWithVendors ? "pool with operators" : "stay with the house"}
            . Card processing fee is a % of card merchandise. A {PAYMENTS_BRAND}{" "}
            dispute adds a ${CHARGEBACK_FEE_CENTS / 100} fee split by merchandise
            share — only when a dispute is filed, win or lose.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Current open period started{" "}
            {formatDateTime(config.currentPeriodStart)}. Close when your period
            ends — payouts are calculated then.
          </p>
        </section>

        {/* Vendors in building */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">
            Operators at this host ({vendors.filter((v) => v.active).length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                <p className="flex items-center gap-2 font-medium">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: v.color }}
                  />
                  {v.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {v.cuisine ? `${v.cuisine} · ` : ""}
                  KDS: {v.stationLabel} · {v.bankLabel} ••{v.bankLast4}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Live open period */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">Open period (live)</h3>
            <Badge variant="info">Not closed yet</Badge>
            <Button className="ml-auto" size="sm" onClick={onClose}>
              Close period & generate payouts
            </Button>
          </div>
          {live && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label="Vendor gross"
                  value={formatCurrency(
                    live.rows.reduce((s, r) => s + r.grossSalesCents, 0),
                  )}
                />
                <Stat
                  label="Card fees"
                  value={formatCurrency(live.cardFeesTotalCents)}
                />
                <Stat
                  label={`${live.hostName} cut`}
                  value={formatCurrency(live.hostCutTotalCents)}
                />
                <Stat
                  label="Chargeback fees"
                  value={formatCurrency(live.chargebackFeesTotalCents ?? 0)}
                />
                <Stat
                  label="E-payouts total"
                  value={formatCurrency(
                    live.rows.reduce(
                      (s, r) => s + r.netElectronicPayoutCents,
                      0,
                    ),
                  )}
                />
              </div>
              <SettlementTable rows={live.rows} />
              <div className="mt-4 rounded-xl border border-border bg-bg p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cash distribution (count-out)
                </h4>
                <p className="mb-2 text-xs text-muted-foreground">
                  Cash collected at the single till is owed to vendors by their
                  cash-tendered sales, after host cut on the cash share.
                </p>
                <ul className="space-y-1 text-sm">
                  {live.rows.map((r) => (
                    <li
                      key={r.vendorId}
                      className="flex justify-between border-b border-border/40 py-1"
                    >
                      <span>{r.vendorName}</span>
                      <span className="tabular font-medium">
                        {formatCurrency(r.cashDueCents)}
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between py-1 font-semibold">
                    <span>Total cash to vendors</span>
                    <span className="tabular">
                      {formatCurrency(
                        live.rows.reduce((s, r) => s + r.cashDueCents, 0),
                      )}
                    </span>
                  </li>
                  {config.hostCutEnabled && (
                    <li className="flex justify-between py-1 text-muted-foreground">
                      <span>Host cut from cash share</span>
                      <span className="tabular">
                        {formatCurrency(
                          live.rows.reduce(
                            (s, r) => s + r.hostCutFromCashCents,
                            0,
                          ),
                        )}
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </section>

        <ChargebackSection
          orders={orders}
          chargebacks={chargebacks}
          onFile={(id) => {
            const res = fileChargeback(id);
            setFlash(res.ok ? "Dispute filed. $35 fee split by merchandise share." : (res.error ?? "Failed"));
          }}
          onResolve={(id, outcome) => {
            const res = resolveChargeback(id, outcome);
            setFlash(res.ok ? `Dispute ${outcome}. $35 fee still allocated.` : (res.error ?? "Failed"));
          }}
        />

        {/* Closed periods */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Closed periods</h3>
          {periods.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No closed periods yet. Run service, take multi-vendor payments,
              then close the period.
            </p>
          )}
          <div className="space-y-4">
            {periods.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-border bg-bg p-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {formatDateTime(p.periodStart)} →{" "}
                    {formatDateTime(p.periodEnd)}
                  </span>
                  <Badge
                    variant={
                      p.status === "paid"
                        ? "success"
                        : p.status === "closed"
                          ? "warn"
                          : "secondary"
                    }
                  >
                    {p.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    by {p.closedBy}
                  </span>
                  {p.status === "closed" && (
                    <Button
                      size="sm"
                      className="ml-auto"
                      onClick={() => markPaid(p.id)}
                    >
                      Mark electronic payouts sent
                    </Button>
                  )}
                </div>
                <SettlementTable rows={p.rows} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Host ({p.hostName}): {formatCurrency(p.hostCutTotalCents)} ·
                  Card fees: {formatCurrency(p.cardFeesTotalCents)} · Chargebacks:{" "}
                  {formatCurrency(p.chargebackFeesTotalCents ?? 0)} · Fee rate{" "}
                  {p.cardFeePercent}%
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Guest sits; server rings items from any vendor on one check.</li>
            <li>Send routes each item to that vendor’s KDS / prep line.</li>
            <li>
              Guest pays once (card or cash). Card is a single {PAYMENTS_BRAND}{" "}
              capture under the host brand — never an operator MID.
            </li>
            <li>
              At period end you close settlement: each operator’s merchandise −
              card fee share − host cut − any $35 dispute fees = electronic
              payout; cash report shows cash to hand each operator.
            </li>
            <li>
              A dispute files a ${CHARGEBACK_FEE_CENTS / 100} fee split by each
              operator’s % of merchandise on that check (e.g. $65 food / $35
              drink → 65% / 35% of $35). One operator on the check takes the
              full $35. No fee if no dispute. Win or lose, the fee stays.
            </li>
          </ol>
        </section>
      </div>
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

function SettlementTable({
  rows,
}: {
  rows: {
    vendorId: string;
    vendorName: string;
    grossSalesCents: number;
    cardSalesCents: number;
    cashSalesCents: number;
    cardFeesCents: number;
    hostCutCents: number;
    chargebackFeeCents?: number;
    cardPayoutCents: number;
    cashDueCents: number;
    orderCount: number;
    bankLast4: string;
    payoutAccountLabel?: string;
  }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5">Vendor</th>
            <th className="px-2 py-1.5">Gross</th>
            <th className="px-2 py-1.5">Card</th>
            <th className="px-2 py-1.5">Cash</th>
            <th className="px-2 py-1.5">CC fees</th>
            <th className="px-2 py-1.5">Host cut</th>
            <th className="px-2 py-1.5">CB $35</th>
            <th className="px-2 py-1.5">E-payout</th>
            <th className="px-2 py-1.5">Cash due</th>
            <th className="px-2 py-1.5">Payout account</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((r) => (
            <tr key={r.vendorId}>
              <td className="px-2 py-2 font-medium">
                {r.vendorName}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({r.orderCount} checks)
                </span>
              </td>
              <td className="px-2 py-2 tabular">
                {formatCurrency(r.grossSalesCents)}
              </td>
              <td className="px-2 py-2 tabular">
                {formatCurrency(r.cardSalesCents)}
              </td>
              <td className="px-2 py-2 tabular">
                {formatCurrency(r.cashSalesCents)}
              </td>
              <td className="px-2 py-2 tabular">
                {formatCurrency(r.cardFeesCents)}
              </td>
              <td className="px-2 py-2 tabular">
                {formatCurrency(r.hostCutCents)}
              </td>
              <td className="px-2 py-2 tabular">
                {formatCurrency(r.chargebackFeeCents ?? 0)}
              </td>
              <td className="px-2 py-2 tabular font-semibold">
                {formatCurrency(r.cardPayoutCents)}
              </td>
              <td className="px-2 py-2 tabular font-semibold">
                {formatCurrency(r.cashDueCents)}
              </td>
              <td className="px-2 py-2 text-muted-foreground">
                {(r.payoutAccountLabel
                  ? `${r.payoutAccountLabel} · `
                  : "") + `••${r.bankLast4}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChargebackSection({
  orders,
  chargebacks,
  onFile,
  onResolve,
}: {
  orders: { id: string; number: number; status: string; payments: { method: string }[] }[];
  chargebacks: {
    id: string;
    orderId: string;
    orderNumber: number;
    feeCents: number;
    status: string;
    allocations: { vendorName: string; merchCents: number; feeCents: number; shareBps: number }[];
  }[];
  onFile: (orderId: string) => void;
  onResolve: (id: string, outcome: "won" | "lost") => void;
}) {
  const filedIds = new Set(chargebacks.map((c) => c.orderId));
  const eligible = orders.filter(
    (o) =>
      o.status === "closed" &&
      o.payments.some((p) => p.method === "card" || p.method === "room_charge") &&
      !filedIds.has(o.id),
  );
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{PAYMENTS_BRAND} disputes</h3>
        <GuideLearnLink topicId="chargebacks" compact>
          Why $35?
        </GuideLearnLink>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        ${CHARGEBACK_FEE_CENTS / 100} fee only when a dispute is filed. Split by
        merchandise share on that check. Applies whether you win or lose.
      </p>
      {eligible.length > 0 && (
        <ul className="mt-3 space-y-2">
          {eligible.slice(0, 8).map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
            >
              <span>Closed check #{o.number}</span>
              <Button size="sm" variant="outline" onClick={() => onFile(o.id)}>
                File dispute
              </Button>
            </li>
          ))}
        </ul>
      )}
      {chargebacks.length === 0 && eligible.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">No disputes on file.</p>
      )}
      {chargebacks.map((c) => (
        <div key={c.id} className="mt-3 rounded-xl border border-border bg-bg p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              #{c.orderNumber} · {formatCurrency(c.feeCents)} fee
            </span>
            <Badge variant={c.status === "filed" ? "warn" : "secondary"}>{c.status}</Badge>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {c.allocations.map((a) => (
              <li key={a.vendorName} className="flex justify-between">
                <span>
                  {a.vendorName} ({(a.shareBps / 100).toFixed(1)}% of merchandise{" "}
                  {formatCurrency(a.merchCents)})
                </span>
                <span className="tabular">{formatCurrency(a.feeCents)}</span>
              </li>
            ))}
          </ul>
          {c.status === "filed" && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onResolve(c.id, "won")}>
                Mark won
              </Button>
              <Button size="sm" variant="outline" onClick={() => onResolve(c.id, "lost")}>
                Mark lost
              </Button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
