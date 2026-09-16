import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { useMarketingStore } from "@/lib/pos/marketing-store";
import { formatCurrency } from "@/lib/utils";
import { computeTotals } from "@/lib/pos/calculations";
import { defaultGiftIssuer } from "@/lib/pos/gift-issuer";
import { parsePaymentMethods } from "@/lib/pos/payment-methods";
import { giftNeedsManagerPin, giftSellBlockedReason, parseGiftLimits } from "@/lib/pos/gift-limits";
import { issueGiftCardFn } from "@/lib/gift/api";
import { ManagerPinDialog } from "./ManagerPinDialog";

/** Paired station + staff PIN: sell face-value gift or redeem on the open check. */
export function StationGiftJob() {
  const settings = usePosStore((s) => s.settings);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));
  const giftCards = usePosStore((s) => s.giftCards);
  const issueGiftCard = usePosStore((s) => s.issueGiftCard);
  const takePayment = usePosStore((s) => s.takePayment);
  const hasManagerAuth = usePosStore((s) => s.hasManagerAuth);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const logGiftTxn = useMarketingStore((s) => s.logGiftTxn);
  const giftOn = parsePaymentMethods(settings.paymentMethods).giftCard;
  const limits = parseGiftLimits(settings);

  const [tab, setTab] = useState<"sell" | "redeem">("sell");
  const [amt, setAmt] = useState("50");
  const [tender, setTender] = useState<"cash" | "card">("card");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [mgrOpen, setMgrOpen] = useState(false);

  const sell = (skipMgr = false) => {
    const dollars = parseFloat(amt);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setNote("Enter a valid amount");
      return;
    }
    const cents = Math.round(dollars * 100);
    const cap = giftSellBlockedReason(cents, 0, limits);
    if (cap) {
      setNote(cap);
      return;
    }
    if (!skipMgr && giftNeedsManagerPin(cents, limits) && !hasManagerAuth()) {
      setMgrOpen(true);
      setNote("High-value sell needs a manager PIN.");
      return;
    }
    const issuer = defaultGiftIssuer(emp, settings, usePosStore.getState().vendors);
    void (async () => {
      try {
        if (locId) {
          try {
            const res = await issueGiftCardFn({
              data: {
                locationId: locId,
                amountCents: cents,
                issuerId: issuer.id,
                issuerKind: issuer.kind,
                issuerName: issuer.name,
                tender,
                soldByEmployeeId: emp?.id,
                soldByOperatorId: emp?.operatorId,
              },
            });
            if (res.ok) {
              logGiftTxn({
                giftCardId: res.card.id,
                type: "issue",
                amountCents: cents,
                note: res.plaintextCode,
              });
              setNote(
                `Sold ${res.plaintextCode} · $${dollars.toFixed(2)} face value. Print or show this code.`,
              );
              return;
            }
            if (res.error?.includes("Max ")) {
              setNote(res.error);
              return;
            }
          } catch {
            /* local ledger */
          }
        }
        const res = issueGiftCard({ amountCents: cents, issuerId: issuer.id, tender });
        if (res.ok && res.code) {
          logGiftTxn({ giftCardId: res.code, type: "issue", amountCents: cents, note: res.code });
          setNote(`Sold ${res.code} · $${dollars.toFixed(2)} face value. Print or show this code.`);
        } else setNote(res.error ?? "Could not sell");
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not sell");
      }
    })();
  };

  const redeem = () => {
    const needle = code.replace(/[\s-]/g, "").toUpperCase();
    if (!needle) {
      setNote("Enter a gift card code");
      return;
    }
    const gc = giftCards.find(
      (g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle && g.active && g.status !== "void",
    );
    if (!gc) {
      setNote("Card not found");
      return;
    }
    if (!order || order.status !== "open") {
      setNote(`Balance ${formatCurrency(gc.balanceCents)}. Open a check to redeem.`);
      return;
    }
    const due = computeTotals(order, settings, { tender: "gift_card" }).balanceCents;
    const apply = Math.min(gc.balanceCents, due);
    if (apply <= 0) {
      setNote(`Balance ${formatCurrency(gc.balanceCents)}. Nothing due on this check.`);
      return;
    }
    const res = takePayment({
      method: "gift_card",
      amountCents: apply,
      giftCardCode: gc.code,
    });
    if (!res.ok) {
      setNote(res.error ?? "Redeem failed");
      return;
    }
    logGiftTxn({ giftCardId: gc.code, type: "redeem", amountCents: apply, note: gc.code });
    setNote(`Redeemed ${formatCurrency(apply)}. Remaining ${formatCurrency(gc.balanceCents - apply)}.`);
  };

  if (!giftOn) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Gift cards are off in Settings → Payment methods.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4" data-demo="station-gift-job">
      <div className="flex gap-2">
        <Button
          className="flex-1"
          variant={tab === "sell" ? "default" : "outline"}
          onClick={() => setTab("sell")}
        >
          Sell gift card
        </Button>
        <Button
          className="flex-1"
          variant={tab === "redeem" ? "default" : "outline"}
          onClick={() => setTab("redeem")}
        >
          Redeem
        </Button>
      </div>
      {tab === "sell" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Face value. Cash-discount markup does not apply to a gift load. Paired station + PIN
            only. Not sold online.
          </p>
          <Input placeholder="Amount USD" value={amt} inputMode="decimal" onChange={(e) => setAmt(e.target.value)} />
          <select
            className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
            value={tender}
            onChange={(e) => setTender(e.target.value as "cash" | "card")}
          >
            <option value="card">Card (Quantum Payments)</option>
            <option value="cash">Cash</option>
          </select>
          <Button className="w-full" size="lg" onClick={() => sell()}>
            Sell gift card
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Scan or type the code. Applies to the open check and cannot exceed the card balance.
          </p>
          <Input
            placeholder="Gift card code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button className="w-full" size="lg" onClick={redeem}>
            Redeem
          </Button>
        </div>
      )}
      {note && (
        <p className="text-sm text-muted-foreground" role="status">
          {note}
        </p>
      )}
      <ManagerPinDialog
        open={mgrOpen}
        onOpenChange={setMgrOpen}
        title="Manager PIN · gift sell"
        onVerified={() => {
          setMgrOpen(false);
          sell(true);
        }}
      />
    </div>
  );
}
