import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PaymentDialog } from "./PaymentDialog";
import { usePosStore } from "@/lib/pos/store";
import { computeDualTotals } from "@/lib/pos/calculations";
import { formatCurrency } from "@/lib/utils";
import {
  enabledPayMethods,
  methodLabel,
  parsePaymentMethods,
  payConfigForProcessor,
} from "@/lib/pos/payment-methods";
import type { PaymentMethod } from "@/lib/pos/types";
import { ADD_RECEIPT_PRINTER } from "@/lib/print/receipt-printer";
import { toast } from "sonner";

const STATION_TENDERS = new Set<PaymentMethod>(["cash", "card", "gift_card", "check"]);

/** Pay tab: tenders and Print check. No settings. */
export function BusyPayPanel({ onNeedFloor }: { onNeedFloor: () => void }) {
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId) ?? null);
  const settings = usePosStore((s) => s.settings);
  const tables = usePosStore((s) => s.tables);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);

  if (!order || order.status !== "open") {
    return (
      <div
        className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-border bg-surface p-4 shadow-xl"
        data-pay-tab
      >
        <p className="text-lg font-semibold">No check to pay</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The floor stays up. Open a check, then choose Card, Cash, or Gift.
        </p>
        <Button className="station-touch mt-3 min-h-12" onClick={onNeedFloor}>
          Back
        </Button>
      </div>
    );
  }

  const dual = computeDualTotals(order, settings);
  const table = tables.find((t) => t.id === order.tableId);
  const methods = enabledPayMethods(
    payConfigForProcessor(parsePaymentMethods(settings.paymentMethods), settings.cardProcessor),
  ).filter((m) =>
    STATION_TENDERS.has(m),
  );

  const print = () => {
    setMsg(null);
    void import("@/lib/print/from-store").then(async (m) => {
      const r = await m.printGuestCheck(order.id);
      if (r.ok) toast.success(`Sending to ${r.sentTo || "receipt printer"}`);
      else {
        const err = r.error || ADD_RECEIPT_PRINTER;
        setMsg(err);
        toast.error(err);
      }
    });
  };

  return (
    <div
      className="absolute inset-x-3 bottom-3 z-20 max-h-[min(50dvh,24rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-3 shadow-xl"
      data-pay-tab
    >
      <div>
        <p className="text-2xl font-semibold">
          {table ? `Table ${table.label}` : order.tabName || "Check"} · #{order.number}
        </p>
        <p className="mt-1 text-lg font-semibold tabular">
          {formatCurrency(
            dual.enabled
              ? dual.card.balanceCents || dual.card.totalCents
              : dual.cash.balanceCents || dual.cash.totalCents,
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {methods.map((m) => (
          <Button
            key={m}
            className="station-touch h-16 text-xl font-semibold"
            onClick={() => {
              setMethod(m);
              setPayOpen(true);
            }}
          >
            {methodLabel(parsePaymentMethods(settings.paymentMethods), m)}
          </Button>
        ))}
        <Button
          variant="outline"
          className="station-touch h-16 text-xl font-semibold"
          onClick={print}
          data-print-check
        >
          Print check
        </Button>
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} initialMethod={method} />
    </div>
  );
}
