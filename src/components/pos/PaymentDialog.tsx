import { useMemo, useState } from "react";
import { CreditCard, Banknote, Gift, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePosStore } from "@/lib/pos/store";
import { useNetworkStore } from "@/lib/pos/network-store";
import { useMarketingStore } from "@/lib/pos/marketing-store";
import { computeTotals, tipSuggestions } from "@/lib/pos/calculations";
import { cn, formatCurrency } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/pos/types";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function PaymentDialog({ open, onOpenChange }: Props) {
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));
  const settings = usePosStore((s) => s.settings);
  const takePayment = usePosStore((s) => s.takePayment);
  const wanOnline = useNetworkStore((s) => s.wanOnline());
  const enqueue = useNetworkStore((s) => s.enqueue);
  const clearTable = usePosStore((s) => s.clearTable);
  const setView = usePosStore((s) => s.setView);

  const totals = useMemo(
    () => (order ? computeTotals(order, settings) : null),
    [order, settings],
  );

  const balance = totals?.balanceCents ?? 0;
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState(0);
  const [tendered, setTendered] = useState("");
  const [giftCode, setGiftCode] = useState("");
  const [last4, setLast4] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const amountCents = amount
    ? Math.round(parseFloat(amount) * 100)
    : balance;

  const tips = tipSuggestions(balance);

  const cashPresets = [balance, balance + tip].filter(Boolean);
  const quickCash = [5, 10, 20, 50, 100].map((d) => d * 100);

  const pay = () => {
    setError(null);
    const res = takePayment({
      method,
      amountCents: Math.min(amountCents, balance),
      tipCents: tip,
      tenderedCents:
        method === "cash"
          ? Math.round(parseFloat(tendered || "0") * 100) ||
            amountCents + tip
          : undefined,
      last4: method === "card" ? last4 || "4242" : undefined,
      giftCardCode: method === "gift_card" ? giftCode : undefined,
    });
    if (!res.ok) {
      setError(res.error ?? "Payment failed");
      return;
    }
    if (method === "card") {
      const ctx = (() => {
        try {
          return JSON.parse(sessionStorage.getItem("summex-tenant-pos") || "null") as {
            orgId?: string;
            locationId?: string;
          } | null;
        } catch {
          return null;
        }
      })();
      if (ctx?.orgId) {
        void import("@/lib/saas/api").then(({ recordCardPaymentFn }) =>
          recordCardPaymentFn({
            data: {
              orgId: ctx.orgId!,
              locationId: ctx.locationId,
              amountCents: Math.min(amountCents, balance) + tip,
              last4: last4 || "4242",
            },
          }).catch(() => undefined),
        );
      }
    }
    if (method === "gift_card") {
      useMarketingStore.getState().logGiftTxn({
        giftCardId: giftCode,
        type: "redeem",
        amountCents: Math.min(amountCents, balance) + tip,
        note: giftCode,
      });
    }
    if (method === "card" && !useNetworkStore.getState().wanOnline()) {
      enqueue({
        kind: "card_capture",
        label: `Check #${order?.number ?? ""}`,
        detail: `****${last4 || "4242"} · stored on house hub`,
        amountCents: Math.min(amountCents, balance) + tip,
      });
    }
    if (res.changeCents != null && res.changeCents > 0) {
      setChange(res.changeCents);
    }
    const o = usePosStore.getState().getActiveOrder();
    if (!o || o.status === "closed") {
      setDone(true);
    } else {
      // partial — reset for next tender
      setTip(0);
      setAmount("");
      setTendered("");
    }
  };

  const finish = () => {
    const o = usePosStore.getState().getActiveOrder();
    if (o?.tableId && o.status === "closed") {
      // leave as paid for busing
    }
    setDone(false);
    setChange(null);
    setTip(0);
    setAmount("");
    onOpenChange(false);
    setView("floor");
  };

  if (!order || !totals) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setDone(false);
          setChange(null);
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span>
              {done
                ? "Payment complete"
                : `Pay check #${order.number}`}
            </span>
            <GuideLearnLink topicId="quantum-payments" compact>
              Quantum Payments
            </GuideLearnLink>
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-3xl font-semibold tabular text-success">
              Paid
            </p>
            {change != null && change > 0 && (
              <p className="text-lg">
                Change due{" "}
                <span className="font-semibold tabular">
                  {formatCurrency(change)}
                </span>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Charged as{" "}
              {order.payments[order.payments.length - 1]?.chargeBrand ||
                settings.name}{" "}
              via Quantum Payments. Tip recorded: {formatCurrency(tip)}
            </p>
            <Button className="w-full" size="lg" onClick={finish}>
              Done
            </Button>
            {order.tableId && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  clearTable(order.tableId!);
                  finish();
                }}
              >
                Bus table now
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {!wanOnline && (
              <p className="rounded-xl border border-warn/40 bg-warn/15 px-3 py-2 text-xs text-foreground">
                Internet is out. Cash and local gift still settle now. Card
                is stored on the house hub and captures when WiFi reaches
                the processor again.
              </p>
            )}
            <div className="rounded-xl border border-border bg-bg p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Balance due · {settings.name}
              </p>
              <p className="text-3xl font-semibold tabular">
                {formatCurrency(balance)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Guest charge brand is the host. Card runs on Quantum Payments
                only — not Stripe or Square.
              </p>
            </div>

            <Tabs
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="card">
                  <CreditCard className="h-3.5 w-3.5" />
                </TabsTrigger>
                <TabsTrigger value="cash">
                  <Banknote className="h-3.5 w-3.5" />
                </TabsTrigger>
                <TabsTrigger value="gift_card">
                  <Gift className="h-3.5 w-3.5" />
                </TabsTrigger>
                <TabsTrigger value="comp">
                  <Percent className="h-3.5 w-3.5" />
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Amount (leave blank for full)
                  </label>
                  <Input
                    inputMode="decimal"
                    placeholder={(balance / 100).toFixed(2)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                {method !== "comp" && (
                  <div>
                    <label className="mb-1.5 block text-xs text-muted-foreground">
                      Tip
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[0, ...tips].map((t, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant={tip === t ? "default" : "outline"}
                          onClick={() => setTip(t)}
                          className="tabular"
                        >
                          {t === 0 ? "No tip" : formatCurrency(t)}
                          {t > 0 && balance > 0 && (
                            <span className="ml-1 opacity-70">
                              {Math.round((t / balance) * 100)}%
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <TabsContent value="card" className="mt-0 space-y-2">
                  <Input
                    placeholder="Last 4 (optional)"
                    value={last4}
                    maxLength={4}
                    onChange={(e) =>
                      setLast4(e.target.value.replace(/\D/g, ""))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Quantum Payments capture under {settings.name}. Guest sees
                    the host brand, not individual operators.
                  </p>
                </TabsContent>

                <TabsContent value="cash" className="mt-0 space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Cash tendered
                  </label>
                  <Input
                    inputMode="decimal"
                    placeholder={((amountCents + tip) / 100).toFixed(2)}
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[...cashPresets, ...quickCash]
                      .filter((v, i, a) => a.indexOf(v) === i && v > 0)
                      .slice(0, 8)
                      .map((v) => (
                        <Button
                          key={v}
                          size="sm"
                          variant="outline"
                          className="tabular"
                          onClick={() => setTendered((v / 100).toFixed(2))}
                        >
                          {formatCurrency(v)}
                        </Button>
                      ))}
                  </div>
                </TabsContent>

                <TabsContent value="gift_card" className="mt-0 space-y-2">
                  <Input
                    placeholder="Gift card code"
                    value={giftCode}
                    onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
                  />
                  <p className="text-xs text-muted-foreground">
                    Try GIFT-2500, GIFT-5000, or GIFT-1000
                  </p>
                </TabsContent>

                <TabsContent value="comp" className="mt-0">
                  <p className="text-xs text-muted-foreground">
                    Comps the payment amount as house. Manager approval
                    recommended for large comps.
                  </p>
                </TabsContent>
              </div>
            </Tabs>

            {error && (
              <p className="text-center text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <div
              className={cn(
                "flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm",
              )}
            >
              <span className="text-muted-foreground">Charging</span>
              <span className="text-lg font-semibold tabular">
                {formatCurrency(Math.min(amountCents, balance) + tip)}
              </span>
            </div>

            <Button className="w-full" size="xl" onClick={pay}>
              {method === "card" && "Charge card"}
              {method === "cash" && "Take cash"}
              {method === "gift_card" && "Redeem gift card"}
              {method === "comp" && "Apply comp"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
