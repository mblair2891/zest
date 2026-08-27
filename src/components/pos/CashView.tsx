import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ManagerPinDialog } from "./ManagerPinDialog";

export function CashView() {
  const shift = usePosStore((s) => s.shift);
  const closeShift = usePosStore((s) => s.closeShift);
  const openShift = usePosStore((s) => s.openShift);
  const auditLog = usePosStore((s) => s.auditLog);
  const [count, setCount] = useState("");
  const [mgrOpen, setMgrOpen] = useState(false);
  const [pending, setPending] = useState<"close" | "open" | null>(null);

  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const orders = usePosStore((s) => s.orders);
  const expected =
    shift.openingFloatCents + shift.cashSalesCents - shift.tipsCashCents;
  const counted = Math.round(parseFloat(count || "0") * 100);
  const variance = count ? counted - expected : 0;
  const mine = orders.filter(
    (o) => o.serverId === emp?.id && (o.status === "closed" || o.status === "open"),
  );
  const closedMine = mine.filter((o) => o.status === "closed");
  const mySales = closedMine.reduce(
    (n, o) => n + o.payments.reduce((s, p) => s + p.amountCents, 0),
    0,
  );
  const myTips = closedMine.reduce(
    (n, o) => n + o.payments.reduce((s, p) => s + (p.tipCents ?? 0), 0),
    0,
  );

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Cash drawer & Z-report</h2>
        <Badge variant={shift.closedAt ? "secondary" : "success"}>
          {shift.closedAt ? "Shift closed" : "Shift open"}
        </Badge>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Opening float", shift.openingFloatCents],
          ["Cash sales", shift.cashSalesCents],
          ["Cash tips paid out", shift.tipsCashCents],
          ["Expected in drawer", expected],
        ].map(([label, val]) => (
          <div
            key={label as string}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular">
              {formatCurrency(val as number)}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">Tender breakdown</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Card sales</dt>
              <dd className="tabular">{formatCurrency(shift.cardSalesCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Card tips</dt>
              <dd className="tabular">{formatCurrency(shift.tipsCardCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Gift card</dt>
              <dd className="tabular">{formatCurrency(shift.giftSalesCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Comps</dt>
              <dd className="tabular">{formatCurrency(shift.compsCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Voids</dt>
              <dd className="tabular">{formatCurrency(shift.voidsCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Orders closed</dt>
              <dd className="tabular">{shift.orderCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Guests</dt>
              <dd className="tabular">{shift.guestCount}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">Server closeout (this PIN)</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Closed checks</dt>
              <dd className="tabular">{closedMine.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">My sales</dt>
              <dd className="tabular">{formatCurrency(mySales)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">My tips</dt>
              <dd className="tabular">{formatCurrency(myTips)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Cash due (drawer)</dt>
              <dd className="tabular">{formatCurrency(expected)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Floor PIN signs you onto this station. Clock in / out is Labor. Closing
            the drawer does not punch you out.
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">End of day count</p>
          <label className="mb-1 block text-xs text-muted-foreground">
            Counted cash in drawer
          </label>
          <Input
            inputMode="decimal"
            placeholder={(expected / 100).toFixed(2)}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="mb-2"
          />
          {count && (
            <p
              className={`mb-3 text-sm tabular ${variance === 0 ? "text-success" : "text-warn"}`}
            >
              Variance: {formatCurrency(variance)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!!shift.closedAt}
              onClick={() => {
                setPending("close");
                setMgrOpen(true);
              }}
            >
              Close shift (Z)
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPending("open");
                setMgrOpen(true);
              }}
            >
              Open new shift
            </Button>
          </div>
          {shift.closedAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Closed {formatDateTime(shift.closedAt)} · counted{" "}
              {formatCurrency(shift.closingCashCents ?? 0)}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium">Audit log</p>
        <ul className="max-h-64 space-y-1.5 overflow-y-auto text-xs">
          {auditLog.slice(0, 40).map((a) => (
            <li
              key={a.id}
              className="flex gap-2 border-b border-border/60 py-1.5 last:border-0"
            >
              <span className="w-16 shrink-0 tabular text-muted-foreground">
                {new Date(a.at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span className="w-24 shrink-0 truncate text-muted-foreground">
                {a.employeeName}
              </span>
              <span className="font-medium capitalize">{a.action}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {a.detail}
              </span>
            </li>
          ))}
          {auditLog.length === 0 && (
            <li className="text-muted-foreground">No activity yet</li>
          )}
        </ul>
      </div>

      <ManagerPinDialog
        open={mgrOpen}
        onOpenChange={setMgrOpen}
        title="Manager cash authorization"
        onVerified={() => {
          if (pending === "close") {
            closeShift(counted || expected);
          } else if (pending === "open") {
            openShift(20000);
            setCount("");
          }
          setPending(null);
        }}
      />
    </div>
  );
}
