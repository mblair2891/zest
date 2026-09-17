import { useEffect, useMemo, useState } from "react";
import { CreditCard, Banknote, Gift, Percent, Mail, Printer, Ban, FileText, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { usePosStore } from "@/lib/pos/store";
import { useNetworkStore } from "@/lib/pos/network-store";
import { useMarketingStore } from "@/lib/pos/marketing-store";
import { computeDualTotals, tipSuggestions } from "@/lib/pos/calculations";
import { cn, formatCurrency } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/pos/types";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { captureIsSandbox } from "@/lib/lifecycle/store";
import { captureCardPresentFn, getPaymentsStatusFn, sendGuestReceiptFn } from "@/lib/payments/api";
import {
  buildGuestCheckView,
  guestCheckHtml,
  guestCheckText,
} from "@/lib/payments/check-by-vendor";
import { GuestCheckByVendor } from "./GuestCheckByVendor";
import { printGuestCheck, printGuestReceipt } from "@/lib/print/from-store";
import {
  currentStationDeviceId,
  payAtCopy,
  stationHasBoundReceiptPrinter,
} from "@/lib/print/receipt-printer";
import { issueGiftCardFn, lookupGiftCardFn, redeemGiftCardFn } from "@/lib/gift/api";
import { defaultGiftIssuer, fulfillingIssuer } from "@/lib/pos/gift-issuer";
import { giftNeedsManagerPin, giftSellBlockedReason, parseGiftLimits } from "@/lib/pos/gift-limits";
import { ManagerPinDialog } from "./ManagerPinDialog";
import type { PaymentsStatus } from "@/lib/payments/types";
import { uid } from "@/lib/utils";
import { readTenantPosContext } from "@/lib/saas/pos-context";
import { canEmployee } from "@/lib/access/permissions";
import { splitTenderByEntity } from "@/lib/payments/entity-split";
import { cashRoleFromSession, parseCashHandling } from "@/lib/pos/cash-handling";
import { currentCashSink, useCashSessionStore } from "@/lib/pos/cash-session";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { deviceRoleFromSessionMode, parseStationQuery } from "@/lib/pos/device-roles";
import { odsBlocksTender } from "@/lib/pos/loss-prevention";
import { useStationLayout } from "@/lib/ui/station-layout";
import {
  enabledPayMethods,
  firstEnabledMethod,
  methodEnabled,
  methodLabel,
  parsePaymentMethods,
} from "@/lib/pos/payment-methods";
import { isManagerCash } from "@/lib/pos/cash-handling";
import { findStaffByPin } from "@/lib/pos/pin";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function PaymentDialog({ open, onOpenChange }: Props) {
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));
  const settings = usePosStore((s) => s.settings);
  const takePayment = usePosStore((s) => s.takePayment);
  const printCheck = usePosStore((s) => s.printCheck);
  const wanOnline = useNetworkStore((s) => s.wanOnline());
  const clearTable = usePosStore((s) => s.clearTable);
  const setView = usePosStore((s) => s.setView);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const canPay = canEmployee(emp, "payments:take");
  const payCfg = parsePaymentMethods(settings.paymentMethods);
  const giftOk = canPay && payCfg.giftCard;
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
  const layout = useStationLayout();
  const payMethods = enabledPayMethods(payCfg);
  const locationDevices = usePosStore((s) => s.locationDevices);
  const activeDeviceId = usePosStore((s) => s.activeDeviceId);
  const hasBoundReceipt = stationHasBoundReceiptPrinter(
    locationDevices,
    activeDeviceId || currentStationDeviceId(),
  );
  const payHere = payAtCopy(locationDevices);

  const [method, setMethod] = useState<PaymentMethod>(() =>
    firstEnabledMethod(payCfg, wanOnline ? "card" : "cash"),
  );
  const [checkLast4, setCheckLast4] = useState("");
  const [checkWitness, setCheckWitness] = useState("");
  const [compReason, setCompReason] = useState("");
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
  const [giftSellAmt, setGiftSellAmt] = useState("50");
  const [giftSellTender, setGiftSellTender] = useState<"cash" | "card">("card");
  const [giftNote, setGiftNote] = useState<string | null>(null);
  const [giftMgrOpen, setGiftMgrOpen] = useState(false);
  const issueGiftCard = usePosStore((s) => s.issueGiftCard);
  const giftCards = usePosStore((s) => s.giftCards);
  const hasManagerAuth = usePosStore((s) => s.hasManagerAuth);
  const [last4, setLast4] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payStatus, setPayStatus] = useState<PaymentsStatus | null>(null);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [receiptMsg, setReceiptMsg] = useState<string | null>(null);
  const [receiptChoice, setReceiptChoice] = useState<"choose" | "email">("choose");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [checkPrintMsg, setCheckPrintMsg] = useState<string | null>(null);
  const [checkPrintBusy, setCheckPrintBusy] = useState(false);

  useEffect(() => {
    const cfg = parsePaymentMethods(settings.paymentMethods);
    if (!methodEnabled(cfg, method)) {
      setMethod(firstEnabledMethod(cfg, wanOnline ? "card" : "cash"));
    }
  }, [settings.paymentMethods, method, wanOnline]);

  const amountCents = amount
    ? Math.round(parseFloat(amount) * 100)
    : balance;

  const tips = tipSuggestions(balance);

  useEffect(() => {
    if (!wanOnline && method === "card") {
      const cfg = parsePaymentMethods(settings.paymentMethods);
      setMethod(firstEnabledMethod(cfg, "cash"));
    }
  }, [wanOnline, method, settings.paymentMethods]);

  useEffect(() => {
    if (!giftOk && method === "gift_card") {
      const cfg = parsePaymentMethods(settings.paymentMethods);
      setMethod(firstEnabledMethod(cfg, wanOnline ? "card" : "cash"));
    }
  }, [giftOk, method, wanOnline, settings.paymentMethods]);

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
  const giftLimits = parseGiftLimits(settings);

  const sellGiftOnStation = (opts?: { skipManager?: boolean }) => {
    const dollars = parseFloat(giftSellAmt);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setGiftNote("Enter a valid amount");
      return;
    }
    const cents = Math.round(dollars * 100);
    const cap = giftSellBlockedReason(cents, 0, giftLimits);
    if (cap) {
      setGiftNote(cap);
      return;
    }
    if (!opts?.skipManager && giftNeedsManagerPin(cents, giftLimits) && !hasManagerAuth()) {
      setGiftMgrOpen(true);
      setGiftNote("High-value sell needs a manager PIN.");
      return;
    }
    const issuer = defaultGiftIssuer(emp ?? null, settings, usePosStore.getState().vendors);
    void (async () => {
      const loc =
        usePosStore.getState().tenantLocationId ||
        readTenantPosContext()?.locationId ||
        "";
      try {
        if (loc && wanOnline) {
          try {
            const res = await issueGiftCardFn({
              data: {
                locationId: loc,
                amountCents: cents,
                issuerId: issuer.id,
                issuerKind: issuer.kind,
                issuerName: issuer.name,
                tender: giftSellTender,
                soldByEmployeeId: emp?.id,
                soldByOperatorId: emp?.operatorId,
              },
            });
            if (res.ok) {
              setGiftNote(
                `Sold ${res.plaintextCode} · $${dollars.toFixed(2)} · issuer ${issuer.name}. Not sold online.`,
              );
              return;
            }
            if (res.error?.includes("Max ")) {
              setGiftNote(res.error);
              return;
            }
          } catch {
            /* isolated demo — local ledger */
          }
        }
        const res = issueGiftCard({
          amountCents: cents,
          issuerId: issuer.id,
          tender: giftSellTender,
        });
        if (res.ok && res.code) {
          setGiftNote(`Sold ${res.code} · $${dollars.toFixed(2)}. Not sold online.`);
        } else setGiftNote(res.error ?? "Could not sell gift card");
      } catch (e) {
        setGiftNote(e instanceof Error ? e.message : "Could not sell gift card");
      }
    })();
  };

  const checkGiftBalance = () => {
    const code = giftCode.trim();
    if (!code) {
      setGiftNote("Enter a gift card code");
      return;
    }
    const loc =
      usePosStore.getState().tenantLocationId ||
      readTenantPosContext()?.locationId ||
      "";
    void (async () => {
      try {
        if (loc && wanOnline) {
          const res = await lookupGiftCardFn({ data: { locationId: loc, code } });
          if (!res.ok) {
            setGiftNote(res.error ?? "Card not found");
            return;
          }
          setGiftNote(`Balance ${formatCurrency(res.card.balanceCents)} · ${res.card.status}`);
          return;
        }
        const needle = code.replace(/[\s-]/g, "").toUpperCase();
        const gc = giftCards.find(
          (g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle,
        );
        if (!gc) {
          setGiftNote("Card not found");
          return;
        }
        setGiftNote(`Balance ${formatCurrency(gc.balanceCents)} · ${gc.status ?? "active"}`);
      } catch (e) {
        setGiftNote(e instanceof Error ? e.message : "Lookup failed");
      }
    })();
  };

  const pay = () => {
    void (async () => {
    setError(null);
    if (!methodEnabled(payCfg, method)) {
      setError("This tender is off at this venue.");
      return;
    }
    if (odsBlocksTender(deviceRole, method)) {
      setError("ODS cannot tender cash or gift. Use an order or host station.");
      return;
    }
    if (method === "comp" && !compReason.trim()) {
      setError("Comp requires a reason.");
      return;
    }
    if (method === "check" && payCfg.checkLast4 && checkLast4.replace(/\D/g, "").length < 4) {
      setError("Enter the check last 4.");
      return;
    }
    if (method === "check" && payCfg.checkManagerWitness) {
      const w = findStaffByPin(
        usePosStore.getState().employees,
        checkWitness,
        usePosStore.getState().tenantLocationId || "",
      );
      if (!w || !isManagerCash(w.role)) {
        setError("Manager witness PIN required for check.");
        return;
      }
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
      if (emp && !useCashSessionStore.getState().hasPossession(emp.id)) {
        setError(
          sink.type === "bank"
            ? "Open your bank first (declare opening cash)."
            : "Take the drawer first (declare opening cash).",
        );
        return;
      }
      const { useTillCloseoutStore } = await import("@/lib/pos/till-closeout-store");
      const blocked = useTillCloseoutStore.getState().cashBlockedFor(
        sink.type === "drawer" ? sink.drawer.id : `bank:${emp?.id ?? ""}`,
        sink.type === "bank" ? emp?.id ?? null : null,
      );
      if (blocked) {
        setError("This till is closing. New cash sales are blocked until a manager opens it again.");
        return;
      }
    }
    if ((method === "card" || method === "room_charge") && !wanOnline) {
      setError("Card requires connection. Take another enabled tender or keep the check open.");
      setMethod(firstEnabledMethod(payCfg, "cash"));
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
            "Live cards require an enrolled Quantum reader supplied through Summex. Take cash or keep the check open.",
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
    setReceiptChoice("choose");
    setReceiptMsg(null);
    setReceiptEmail("");
    onOpenChange(false);
    setView("floor");
  };

  const runPrintReceipt = async () => {
    if (!order) return;
    setReceiptBusy(true);
    setReceiptMsg(null);
    try {
      const res = await printGuestReceipt(order.id);
      if (!res.ok) {
        setReceiptMsg(res.error || "Print failed");
        setReceiptBusy(false);
        return;
      }
      finish();
    } catch {
      setReceiptMsg("Print failed. Check the mapped receipt printer.");
      setReceiptBusy(false);
    }
  };

  const runEmailReceipt = async () => {
    if (!order) return;
    const loc =
      usePosStore.getState().tenantLocationId ||
      readTenantPosContext()?.locationId ||
      "";
    const view = buildGuestCheckView({
      order,
      settings,
      hostName: settings.name,
      operatorName: (id) =>
        usePosStore.getState().vendors.find((v) => v.id === id)?.name ?? id,
    });
    setReceiptBusy(true);
    setReceiptMsg(null);
    try {
      const r = await sendGuestReceiptFn({
        data: {
          locationId: loc,
          to: receiptEmail,
          subject: `${settings.name} receipt #${order.number}`,
          text: guestCheckText(view),
          html: guestCheckHtml(view),
        },
      });
      if (!r.ok) {
        setReceiptMsg(r.error || "Email is down. Print the receipt instead.");
        setReceiptBusy(false);
        return;
      }
      finish();
    } catch {
      setReceiptMsg("Email is down. Print the receipt instead.");
      setReceiptBusy(false);
    }
  };

  if (!order || !totals || !dual) return null;

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setDone(false);
          setChange(null);
          setError(null);
          setReceiptEmail("");
          setReceiptMsg(null);
          setReceiptChoice("choose");
          setCheckPrintMsg(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent
        className={cn(
          layout.handheld
            ? "h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 left-0 top-0 rounded-none max-h-none"
            : "max-w-md",
        )}
      >
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
            TRAINING — Quantum Payments sandbox. Not a live card capture. Cash and gift still work without a reader.
          </p>
        )}
        {method === "card" && payStatus?.mode === "live" && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium">
            Live Quantum Payments · present the card on a Finix/Quantum reader. Handhelds
            are not Square or Stripe terminals. Cash and gift work without a reader.{" "}
            {payStatus.liveReady ? "" : payStatus.message}
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
            {(() => {
              const view = buildGuestCheckView({
                order,
                settings,
                hostName: settings.name,
                operatorName: (id) =>
                  usePosStore.getState().vendors.find((v) => v.id === id)?.name ?? id,
              });
              return (
                <div className="rounded-xl border border-border bg-bg p-3 text-left">
                  <GuestCheckByVendor view={view} compact />
                  {view.vendors.length > 1 ? (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {view.allocations.map((a) => (
                        <li key={a.entityId} className="flex justify-between gap-2">
                          <span>{a.displayName}</span>
                          <span className="tabular">{formatCurrency(a.totalCents)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-2 text-[11px] text-muted-foreground">{view.splitNote}</p>
                </div>
              );
            })()}
            <p className="text-sm text-muted-foreground">
              Charged as{" "}
              {order.payments[order.payments.length - 1]?.chargeBrand ||
                settings.name}{" "}
              {order.payments[order.payments.length - 1]?.method === "card"
                ? "via Quantum Payments"
                : order.payments[order.payments.length - 1]?.method === "cash"
                  ? "cash"
                  : order.payments[order.payments.length - 1]?.method === "gift_card"
                    ? "gift"
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
            <p className="text-sm font-medium">Receipt</p>
            {receiptChoice === "choose" && (
              <div className="grid gap-2">
                <Button
                  size="lg"
                  className="station-touch min-h-12 w-full"
                  onClick={() => {
                    setReceiptChoice("email");
                    setReceiptMsg(null);
                  }}
                >
                  <Mail className="h-5 w-5" />
                  Email
                </Button>
                <Button
                  size="lg"
                  className="station-touch min-h-12 w-full"
                  variant="outline"
                  disabled={receiptBusy}
                  onClick={() => void runPrintReceipt()}
                >
                  <Printer className="h-5 w-5" />
                  Print
                </Button>
                <Button
                  size="lg"
                  className="station-touch min-h-12 w-full"
                  variant="outline"
                  onClick={finish}
                >
                  <Ban className="h-5 w-5" />
                  No receipt
                </Button>
              </div>
            )}
            {receiptChoice === "email" && (
              <div className="space-y-2 text-left">
                <Input
                  type="email"
                  placeholder="Guest email"
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  autoFocus
                />
                <Button
                  className="station-touch min-h-12 w-full"
                  size="lg"
                  disabled={!receiptEmail.trim() || receiptBusy}
                  onClick={() => void runEmailReceipt()}
                >
                  Send email
                </Button>
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => {
                    setReceiptChoice("choose");
                    setReceiptMsg(null);
                  }}
                >
                  Back
                </Button>
              </div>
            )}
            {receiptMsg ? (
              <p className="text-sm text-danger" role="status">
                {receiptMsg}
              </p>
            ) : null}
            {receiptMsg && /print/i.test(receiptMsg) && (
              <Button
                className="station-touch min-h-12 w-full"
                size="lg"
                variant="outline"
                disabled={receiptBusy}
                onClick={() => void runPrintReceipt()}
              >
                <Printer className="h-5 w-5" />
                Print instead
              </Button>
            )}
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
        ) : !hasBoundReceipt ? (
          <div className="space-y-3">
            <p
              className="rounded-lg bg-warn/15 px-3 py-2 text-center text-sm font-semibold text-warn"
              role="status"
              data-pay-at
            >
              {payHere}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {!wanOnline && (
              <p className="rounded-xl border border-warn/40 bg-warn/15 px-3 py-2 text-xs text-foreground">
                Card requires connection. Take cash or keep the check open. Gift
                and comps still work on this device. Card is not queued.
              </p>
            )}
            <Button
              size="lg"
              className="station-touch min-h-12 w-full"
              disabled={
                checkPrintBusy ||
                order.lines.filter((l) => !l.voided).length === 0
              }
              onClick={() => {
                setCheckPrintBusy(true);
                setCheckPrintMsg(null);
                printCheck();
                void printGuestCheck(order.id)
                  .then((r) => {
                    setCheckPrintMsg(
                      r.ok
                        ? r.viaStation
                          ? `Printed via ${r.viaStation}`
                          : "Printed"
                        : r.error || "Print failed",
                    );
                  })
                  .catch(() => setCheckPrintMsg("Print failed"))
                  .finally(() => setCheckPrintBusy(false));
              }}
            >
              <Printer className="h-5 w-5" />
              Print check
            </Button>
            {checkPrintMsg && (
              <p className="text-center text-xs text-muted-foreground" role="status">
                {checkPrintMsg}
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
                  Cash {formatCurrency(dual.cash.totalCents)} · Card{" "}
                  {formatCurrency(dual.card.totalCents)}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {cashOn
                  ? "Cash is the entered till price. Card is marked up and rounded up."
                  : "Guest charge brand is the host. Card runs on Quantum Payments only."}
              </p>
            </div>

            <Tabs
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
            >
              <div className="flex flex-col gap-2">
                {payMethods.map((m) => {
                  const Icon =
                    m === "card"
                      ? CreditCard
                      : m === "cash"
                        ? Banknote
                        : m === "gift_card"
                          ? Gift
                          : m === "comp"
                            ? Percent
                            : m === "house_account"
                              ? Building2
                              : FileText;
                  const blockedCash = m === "cash" && (!cashAllowed || odsBlocked);
                  const blockedGift = m === "gift_card" && odsBlocked;
                  const blockedCard = m === "card" && !wanOnline;
                  return (
                    <Button
                      key={m}
                      size="lg"
                      className="station-touch min-h-12 w-full justify-start text-base"
                      variant={method === m ? "default" : "outline"}
                      disabled={blockedCash || blockedGift || blockedCard}
                      title={
                        blockedCard
                          ? "Card requires connection"
                          : blockedGift
                            ? "ODS cannot tender gift"
                            : blockedCash
                              ? odsBlocked
                                ? "ODS cannot tender cash"
                                : cashSink.type === "blocked"
                                  ? cashSink.reason
                                  : undefined
                              : undefined
                      }
                      onClick={() => setMethod(m)}
                    >
                      <Icon className="h-5 w-5" />
                      {methodLabel(payCfg, m)}
                    </Button>
                  );
                })}
              </div>

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

                <TabsContent value="gift_card" className="mt-0 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    First-party ledger. Sell and redeem on this paired station with a staff PIN.
                    No public website purchase. No shipping. No third-party gift networks.
                  </p>
                  <div className="space-y-2 rounded-lg border border-border p-2" data-demo="gift-sell">
                    <p className="text-xs font-medium">Sell gift card</p>
                    <Input
                      placeholder="Amount USD"
                      value={giftSellAmt}
                      inputMode="decimal"
                      onChange={(e) => setGiftSellAmt(e.target.value)}
                    />
                    <select
                      className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
                      value={giftSellTender}
                      onChange={(e) => setGiftSellTender(e.target.value as "cash" | "card")}
                    >
                      <option value="card">Card (Quantum Payments)</option>
                      <option value="cash">Cash</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      Max sell ${(giftLimits.maxSellPerTxnCents / 100).toFixed(2)} per transaction.
                    </p>
                    <Button size="sm" type="button" onClick={() => sellGiftOnStation()}>
                      Sell gift card
                    </Button>
                  </div>
                  <div className="space-y-2" data-demo="gift-redeem">
                    <p className="text-xs font-medium">Redeem / balance check</p>
                    <Input
                      placeholder="Gift card code"
                      value={giftCode}
                      onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
                    />
                    <Button size="sm" variant="outline" type="button" onClick={checkGiftBalance}>
                      Check balance
                    </Button>
                  </div>
                  {giftNote && (
                    <p className="text-xs text-muted-foreground" role="status">
                      {giftNote}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="comp" className="mt-0 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Comp is not a guest tender. Reason required.
                  </p>
                  <Input
                    placeholder="Reason"
                    value={compReason}
                    onChange={(e) => setCompReason(e.target.value)}
                  />
                </TabsContent>

                <TabsContent value="check" className="mt-0 space-y-2">
                  {payCfg.checkLast4 && (
                    <Input
                      placeholder="Check last 4"
                      value={checkLast4}
                      maxLength={4}
                      inputMode="numeric"
                      onChange={(e) => setCheckLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  )}
                  {payCfg.checkManagerWitness && (
                    <Input
                      placeholder="Manager witness PIN"
                      value={checkWitness}
                      maxLength={4}
                      inputMode="numeric"
                      onChange={(e) => setCheckWitness(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  )}
                  {payCfg.checkPhoto && (
                    <p className="text-xs text-muted-foreground">Photo optional — attach from the check bag later if needed.</p>
                  )}
                </TabsContent>

                <TabsContent value="house_account" className="mt-0">
                  <p className="text-xs text-muted-foreground">Charge to company / house account. Not a card capture.</p>
                </TabsContent>

                <TabsContent value="other" className="mt-0">
                  <p className="text-xs text-muted-foreground">
                    {payCfg.otherLabel || "Other"} — counted in closeout. Not Quantum Payments.
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
              {!busy && method === "check" && "Take check"}
              {!busy && method === "house_account" && "Charge house account"}
              {!busy && method === "other" && `Take ${payCfg.otherLabel || "other"}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <ManagerPinDialog
      open={giftMgrOpen}
      onOpenChange={setGiftMgrOpen}
      title="Manager PIN · gift sell"
      description="High-value gift sell needs a manager PIN."
      onVerified={() => {
        setGiftMgrOpen(false);
        sellGiftOnStation({ skipManager: true });
      }}
    />
    </>
  );
}
