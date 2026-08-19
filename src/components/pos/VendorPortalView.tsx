import { useMemo, useState } from "react";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { vendorSubtotalOnOrder } from "@/lib/pos/settlement";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export function VendorPortalView() {
  const vendors = usePosStore((s) => s.vendors);
  const orders = usePosStore((s) => s.orders);
  const tickets = usePosStore((s) => s.tickets);
  const menuItems = usePosStore((s) => s.menuItems);
  const periods = usePosStore((s) => s.settlementPeriods);
  const toggleItem = usePosStore((s) => s.toggleItemAvailable);
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");

  const vendor = vendors.find((v) => v.id === vendorId) ?? vendors[0];

  const stats = useMemo(() => {
    if (!vendor) return null;
    const closed = orders.filter((o) => o.status === "closed");
    let gross = 0;
    let checks = 0;
    for (const o of closed) {
      const sub = vendorSubtotalOnOrder(o, vendor.id);
      if (sub > 0) {
        gross += sub;
        checks += 1;
      }
    }
    const openTickets = tickets.filter(
      (t) => t.vendorId === vendor.id && t.status !== "bumped",
    ).length;
    const items = menuItems.filter((m) => m.vendorId === vendor.id);
    const lastPeriod = periods.find((p) =>
      p.rows.some((r) => r.vendorId === vendor.id),
    );
    const row = lastPeriod?.rows.find((r) => r.vendorId === vendor.id);
    return { gross, checks, openTickets, items, lastPeriod, row };
  }, [vendor, orders, tickets, menuItems, periods]);

  if (!vendor || !stats) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No vendors configured
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Vendor portal</h2>
          <Badge variant="info">Self-serve stall owner view</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {vendors.map((v) => (
            <Button
              key={v.id}
              size="sm"
              variant={v.id === vendor.id ? "default" : "outline"}
              onClick={() => setVendorId(v.id)}
            >
              <span
                className="mr-1.5 h-2 w-2 rounded-full"
                style={{ background: v.color }}
              />
              {v.shortName}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="text-lg font-semibold">{vendor.name}</h3>
          <p className="text-sm text-muted-foreground">
            {vendor.cuisine} · KDS: {vendor.stationLabel} · Payout bank ••
            {vendor.bankLast4} ({vendor.bankLabel})
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Period gross (closed)" value={formatCurrency(stats.gross)} />
          <Tile label="Checks with your items" value={String(stats.checks)} />
          <Tile label="Open KDS tickets" value={String(stats.openTickets)} />
          <Tile label="Menu items" value={String(stats.items.length)} />
        </div>

        {stats.row && stats.lastPeriod && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h4 className="mb-2 text-sm font-semibold">Last closed settlement</h4>
            <p className="mb-2 text-xs text-muted-foreground">
              {formatDateTime(stats.lastPeriod.periodStart)} →{" "}
              {formatDateTime(stats.lastPeriod.periodEnd)} ·{" "}
              {stats.lastPeriod.status}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
              <Tile label="Gross" value={formatCurrency(stats.row.grossSalesCents)} />
              <Tile label="Card fees" value={formatCurrency(stats.row.cardFeesCents)} />
              <Tile label="Host cut" value={formatCurrency(stats.row.hostCutCents)} />
              <Tile
                label="E-payout"
                value={formatCurrency(stats.row.netElectronicPayoutCents)}
              />
              <Tile label="Cash due" value={formatCurrency(stats.row.cashDueCents)} />
              <Tile
                label="Total due you"
                value={formatCurrency(stats.row.totalVendorDueCents)}
              />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h4 className="mb-2 text-sm font-semibold">Your menu · 86 board</h4>
          <ul className="divide-y divide-border text-sm">
            {stats.items.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span>
                  {m.name}{" "}
                  <span className="text-muted-foreground">
                    {formatCurrency(m.priceCents)}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={m.available ? "outline" : "default"}
                  onClick={() => toggleItem(m.id)}
                >
                  {m.available ? "86 item" : "Restore"}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How you get paid</p>
          <p className="mt-1">
            Guests pay the host once. Your product sales accrue on closed checks.
            At period close the platform pays your bank for card-attributed sales
            (minus fees and host cut) and the host hands cash per the cash-due
            report. Tax is remitted by the building host — not deducted as your
            product payout.
          </p>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-base font-semibold tabular">{value}</p>
    </div>
  );
}
