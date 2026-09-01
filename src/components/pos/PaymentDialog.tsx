import { useEffect, useMemo, useState } from "react";
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
import { computeDualTotals, tipSuggestions } from "@/lib/pos/calculations";
import { cn, formatCurrency } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/pos/types";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { captureIsSandbox } from "@/lib/lifecycle/store";
import { captureCardPresentFn, getPaymentsStatusFn } from "@/lib/payments/api";
import { redeemGiftCardFn } from "@/lib/gift/api";
import { fulfillingIssuer } from "@/lib/pos/gift-issuer";
import type { PaymentsStatus } from "@/lib/payments/types";
import { uid } from "@/lib/utils";
import { readTenantPosContext } from "@/lib/saas/pos-context";
import { canEmployee } from "@/lib/access/permissions";
import { splitTenderByEntity } from "@/lib/payments/entity-split";
import { cashRoleFromSession, parseCashHandling } from "@/lib/pos/cash-handling";
import { currentCashSink } from "@/lib/pos/cash-session";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { deviceRoleFromSessionMode, parseStationQuery } from "@/lib/pos/device-roles";
import { odsBlocksTender } from "@/lib/pos/loss-prevention";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function PaymentDialog({ open, onOpenChange }: Props) {
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));
  const settings = usePosStore((s) => s.settings);
  const takePayment = usePosStore((s) => s.takePayment);
  const wanOnline = useNetworkStore((s) => s.wanOnline());
  const clearTable = usePosStore((s) => s.clearTable);
  const setView = usePosStore((s) => s.setView);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const canPay = canEmployee(emp, "payments:take");
  const giftOk = canPay && settings.giftHouseIssuerEnabled !== false;
  const cashSink = currentCashSink({
    cfg: parseCashHandling(settings.cashHandling),
    emp: emp ?? null,
    deviceRole: cashRoleFromSession(useStationSessionStore.getState().assignment.kind),
    deviceId: usePosStore((s) => s.activeDeviceId),
    order: order ?? null,
  });
  const cashAllowed = cashSink.type !== "blocked";
  const deviceRole = (() => {
    try {
      const q = parseStationQuery(new URLSearchParams(window.location.search).get("station"));
      if (q) return q;
      return deviceRoleFromSessionMode(useStationSessionStore.getState().assignment.kind);
    } catch {
      return null;
    }
  })();
  const odsBlocked = deviceRole === "ods";

  const [method, setMethod] = useState<PaymentMethod>(wanOnline ? "card" : "cash");
  const dual = useMemo(
    () => (order ? computeDualTotals(order, settings) : null),
    [order, settings],
  );
  const totals = dual?.card ?? null;
  const cashOn = Boolean(dual?.enabled && method === "cash");
  const balance = cashOn
    ? (dual?.cash.balanceCents ?? 0)
    : (totals?.balanceCents ?? 0);
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState(0);
  const [tendered, setTendered] = useState("");
  const [giftCode, setGiftCode] = useState("");
  const [last4, setLast4] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payStatus, setPayStatus] = useState<PaymentsStatus | null>(null);

  const amountCents = amount
    ? Math.round(parseFloat(amount) * 100)
    : balance;

  const tips = tipSuggestions(balance);

  useEffect(() => {
    if (!wanOnline && method === "card") setMethod("cash");
  }, [wanOnline, method]);

  useEffect(() => {
    if (!giftOk && method === "gift_card") setMethod(wanOnline ? "card" : "cash");
  }, [giftOk, method, wanOnline]);

  useEffect(() => {
    if (!open) return;
    const loc =
      usePosStore.getState().tenantLocationId ||
      readTenantPosContext()?.locationId ||
      "";
    if (!loc || !wanOnline) {
      setPayStatus(null);
      return;
    }
    void getPaymentsStatusFn({ data: { locationId: loc } })
      .then(setPayStatus)
      .catch(() => setPayStatus(null));
  }, [open, wanOnline]);

  const sandbox = captureIsSandbox({
    operatorId: order?.lines.find((l) => l.vendorId)?.vendorId,
    vendorIds: order?.lines.map((l) => l.vendorId).filter(Boolean) as string[],
  });
  const cashPresets = [balance, balance + tip].filter(Boolean);
  const quickCash = [5, 10, 20, 50, 100].map((d) => d * 100);

  const pay = () => {
    void (async () => {
    setError(null);
    if (odsBlocksTender(deviceRole, method)) {
      setError("ODS cannot tender cash or gift. Use an order or host station.");
      return;
    }
    if (method === "cash") {
      const cfg = parseCashHandling(settings.cashHandling);
      const sink = currentCashSink({
        cfg,
        emp: emp ?? null,
        deviceRole: cashRoleFromSession(useStationSessionStore.getState().assignment.kind),
        deviceId: usePosStore.getState().activeDeviceId,
        order,
      });
      if (sink.type === "blocked") {
        setError(sink.reason);
        return;
      }
    }
    if ((method === "card" || method === "room_charge") && !wanOnline) {
      setError("Card requires connection. Take cash or keep the check open.");
      setMethod("cash");
      return;
    }
    let cardLast4 = method === "card" ? last4 || undefined : undefined;
    if (method === "card") {
      const ctx = readTenantPosContext();
      const locationId =
        usePosStore.getState().tenantLocationId || ctx?.locationId || "";
      const orgId = ctx?.orgId || "";
      if (!locationId || !orgId) {
        setError("Card requires connection. Take cash or keep the check open.");
        return;
      }
      if (payStatus && payStatus.mode === "live" && !payStatus.liveReady) {
        setError(
          payStatus.message ||
            "Card requires a Quantum reader. Take cash or keep the check open.",
        );
        return;
      }
      const tend = Math.min(amountCents, balance);
      const entities = order
        ? splitTenderByEntity({
            order,
            settings,
            amountCents: tend,
            tipCents: tip,
            hostName: settings.name,
            operatorName: (id) =>
              usePosStore.getState().vendors.find((v) => v.id === id)?.name ?? id,
          }).map((s) => ({ ...s, amountCents: s.totalCents }))
        : [];
      const merchants = payStatus?.entityMerchants ?? [];
      const training = Boolean(payStatus?.lifecycleForcesSandbox || payStatus?.mode === "sandbox");
      if (!training && merchants.length) {
        const blocked = entities.find((e) => {
          const m = merchants.find((x) => x.entityId === e.entityId);
          return m ? !m.canCapture : true;
        });
        if (blocked) {
          setError(
            `${blocked.displayName} is not approved for live cards. Use cash or keep the check open.`,
          );
          return;
        }
      }
      setBusy(true);
      try {
        const cap = await captureCardPresentFn({
          data: {
            orgId,
            locationId,
            amountCents: tend + tip,
            checkId: order?.id,
            hostBrand: settings.name,
            clientMutationId: uid("mut"),
            sandboxLast4: payStatus?.mode === "sandbox" ? last4 || "4242" : undefined,
            entities,
          },
        });
        if (!cap.ok) {
          setError(
            cap.error || "Card requires connection. Take cash or keep the check open.",
          );
          setBusy(false);
          return;
        }
        cardLast4 = cap.last4 || cardLast4;
      } catch {
        setError("Card requires connection. Take cash or keep the check open.");
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    let serverGift = false;
    if (method === "gift_card") {
      const loc =
        usePosStore.getState().tenantLocationId ||
        readTenantPosContext()?.locationId ||
        "";
      if (loc && wanOnline) {
        const emp = usePosStore.getState().getCurrentEmployee?.();
        const fulfiller = fulfillingIssuer(emp, settings, usePosStore.getState().vendors);
        setBusy(true);
        try {
          const red = await redeemGiftCardFn({
            data: {
              locationId: loc,
              code: giftCode,
              amountCents: Math.min(amountCents, balance) + tip,
              fulfillerId: fulfiller.id,
              fulfillerKind: fulfiller.kind,
              checkId: order?.id,
            },
          });
          if (!red.ok) {
            setError(red.error || "Gift card failed");
            setBusy(false);
            return;
          }
          serverGift = true;
          const { hydrateGift } = await import("@/lib/gift/sync");
          await hydrateGift(loc);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Gift card failed");
          setBusy(false);
          return;
        }
        setBusy(false);
      }
    }
    const res = takePayment({
      method,
      amountCents: Math.min(amountCents, balance),
      tipCents: tip,
      tenderedCents:
        method === "cash"
          ? Math.round(parseFloat(tendered || "0") * 100) ||
            amountCents + tip
          : undefined,
      last4: cardLast4,
      giftCardCode: method === "gift_card" ? giftCode : undefined,
      serverGift,
    });
    if (!res.ok) {
      setError(res.error ?? "Payment failed");
      return;
    }
    if (method === "gift_card") {
      useMarketingStore.getState().logGiftTxn({
        giftCardId: giftCode,
        type: "redeem",
        amountCents: Math.min(amountCents, balance) + tip,
        note: giftCode,
      });
    }
    if (res.changeCents != null && res.changeCents > 0) {
      setChange(res.changeCents);
    }
    const o = usePosStore.getState().getActiveOrder();
    if (!o || o.status === "closed") {
      setDone(true);
    } else {
      setTip(0);
      setAmount("");
      setTendered("");
    }
    })();
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

  if (!order || !totals || !dual) return null;

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
            <GuideLearnLink
              topicId={method === "cash" ? "cash-discount" : "quantum-payments"}
              compact
            >
              {method === "cash" ? "Cash discount" : "Quantum Payments"}
            </GuideLearnLink>
          </DialogTitle>
        </DialogHeader>
        {method === "card" && (payStatus?.mode === "sandbox" || sandbox) && (
          <p className="rounded-lg bg-warn/15 px-3 py-2 text-xs font-medium text-warn">
            TRAINING — Quantum Payments sandbox. Not a live card capture. Cash still works.
          </p>
        )}
        {method === "card" && payStatus?.mode === "live" && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium">
            Live Quantum Payments · present the card on a supplied reader. Tablets are not
            card terminals. {payStatus.liveReady ? "" : payStatus.message}
          </p>
        )}

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
              {order.payments[order.payments.length - 1]?.method === "card"
                ? "via Quantum Payments"
                : order.payments[order.payments.length - 1]?.method === "cash"
                  ? "cash"
                  : ""}
              . Tip recorded: {formatCurrency(tip)}
            </p>
            {dual.enabled && (
              <p className="text-xs text-muted-foreground">
                Card {formatCurrency(dual.card.totalCents)} · Cash{" "}
                {formatCurrency(dual.cash.totalCents)}
                {order.payments.some((p) => p.method === "cash")
                  ? " · Cash discount applied"
                  : ""}
              </p>
            )}
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
                Card requires connection. Take cash or keep the check open. Gift
                and comps still work on this device. Card is not queued.
              </p>
            )}
            <div className="rounded-xl border border-border bg-bg p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {cashOn ? "Cash due" : "Card due"} · {settings.name}
              </p>
              <p className="text-3xl font-semibold tabular">
                {formatCurrency(balance)}
              </p>
              {dual.enabled && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Card {formatCurrency(dual.card.totalCents)} · Cash{" "}
                  {formatCurrency(dual.cash.totalCents)}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {cashOn
                  ? "Cash price is the printed amount, discounted and rounded up."
                  : "Guest charge brand is the host. Card runs on Quantum Payments only."}
              </p>
            </div>

            <Tabs
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
            >
              <TabsList className={cn("grid w-full", giftOk ? "grid-cols-4" : "grid-cols-3")}>
                <TabsTrigger value="card" disabled={!wanOnline} title={!wanOnline ? "Card requires connection" : undefined}>
                  <CreditCard className="h-3.5 w-3.5" />
                </TabsTrigger>
                <TabsTrigger
                  value="cash"
                  disabled={!cashAllowed || odsBlocked}
                  title={
                    odsBlocked
                      ? "ODS cannot tender cash"
                      : !cashAllowed && cashSink.type === "blocked"
                        ? cashSink.reason
                        : undefined
                  }
                >
                  <Banknote className="h-3.5 w-3.5" />
                </TabsTrigger>
                {giftOk && (
                <TabsTrigger value="gift_card" disabled={odsBlocked} title={odsBlocked ? "ODS cannot tender gift" : undefined}>
                  <Gift className="h-3.5 w-3.5" />
                </TabsTrigger>
                )}
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

                {odsBlocked && (
                  <p className="rounded-lg bg-warn/15 px-3 py-2 text-xs">
                    This station is ODS. Cash and gift tenders are off. Use an order or host
                    device.
                  </p>
                )}
                {method !== "comp" && (
                  <div>
                    <label className="mb-1.5 block text-xs text-muted-foreground">
                      {method === "card"
                        ? "Tip (from the reader / processor — not typed)"
                        : "Tip"}
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
                  {!wanOnline && (
                    <p className="rounded-lg bg-warn/15 px-3 py-2 text-xs font-medium">
                      Card requires connection. Take cash or keep the check open. Card is
                      not queued.
                    </p>
                  )}
                  {(payStatus?.mode === "sandbox" || sandbox) && (
                    <Input
                      placeholder="Last 4 (sandbox receipt only)"
                      value={last4}
                      maxLength={4}
                      onChange={(e) =>
                        setLast4(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  )}
                  {payStatus?.mode === "live" && (
                    <p className="text-xs text-muted-foreground">
                      Present the card on the Quantum reader. PAN/CVV are never
                      typed into Summex.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    One guest tender through Quantum Payments. Each brand on the
                    check is its own payments account — the guest still gets one
                    charge.
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

            <Button className="w-full" size="xl" onClick={pay} disabled={busy}>
              {busy && "Present card on Quantum reader…"}
              {!busy && method === "card" && "Charge card"}
              {!busy && method === "cash" && "Take cash"}
              {!busy && method === "gift_card" && "Redeem gift card"}
              {!busy && method === "comp" && "Apply comp"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
