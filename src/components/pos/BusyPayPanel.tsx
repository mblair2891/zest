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
      <div className="grid h-full place-items-center p-6 text-center" data-pay-tab>
        <div className="space-y-3">
          <p className="text-lg font-semibold">No check to pay</p>
          <Button className="station-touch h-16 px-8 text-lg" onClick={onNeedFloor}>
            Floor
          </Button>
        </div>
      </div>
    );
  }

  const dual = computeDualTotals(order, settings);
  const table = tables.find((t) => t.id === order.tableId);
  const methods = enabledPayMethods(parsePaymentMethods(settings.paymentMethods)).filter((m) =>
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
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3" data-pay-tab>
      <div>
        <p className="text-2xl font-semibold">
          {table ? `Table ${table.label}` : order.tabName || "Check"} · #{order.number}
        </p>
        <p className="mt-1 text-lg font-semibold tabular">
          Cash {formatCurrency(dual.cash.balanceCents || dual.cash.totalCents)}
          {dual.enabled
            ? ` · Card ${formatCurrency(dual.card.balanceCents || dual.card.totalCents)}`
            : ""}
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
