import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { useMarketingStore } from "@/lib/pos/marketing-store";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { computeTotals } from "@/lib/pos/calculations";
import { defaultGiftIssuer, fulfillingIssuer } from "@/lib/pos/gift-issuer";
import { parsePaymentMethods } from "@/lib/pos/payment-methods";
import {
  giftEntityIdForCheck,
  giftEntityIdForStation,
  resolveGiftAccess,
  venueGiftRules,
} from "@/lib/pos/gift-policy";
import { giftNeedsManagerPin, giftSellBlockedReason, parseGiftLimits } from "@/lib/pos/gift-limits";
import { issueGiftCardFn, lookupGiftCardFn, redeemGiftCardFn, reloadGiftCardFn } from "@/lib/gift/api";
import { setPreferredMsrGiftAction, type MsrSwipeEvent } from "@/lib/pos/elo-msr";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { UsbGiftMsrNote } from "./EloMsrStation";
import type { GiftCard } from "@/lib/pos/types";

type GiftTab = "balance" | "sell" | "reload" | "redeem";

function giftActivity(card: GiftCard): string {
  const row = [...(card.ledger ?? [])].sort((a, b) => b.at - a.at)[0];
  if (!row) return card.issuedAt ? `Issued ${formatDateTime(card.issuedAt)}` : "No activity yet";
  const label =
    row.kind === "reload" ? "Reload" : row.kind === "redeem" ? "Redeem" : row.kind === "issue" ? "Load" : "Activity";
  return `${label} ${formatCurrency(Math.abs(row.amountCents))}${row.at ? ` · ${formatDateTime(row.at)}` : ""}`;
}

/** Paired station + staff PIN: check a balance, load, reload, or redeem on the open check. */
export function StationGiftJob() {
  const settings = usePosStore((s) => s.settings);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));
  const giftCards = usePosStore((s) => s.giftCards);
  const issueGiftCard = usePosStore((s) => s.issueGiftCard);
  const reloadGiftCard = usePosStore((s) => s.reloadGiftCard);
  const takePayment = usePosStore((s) => s.takePayment);
  const hasManagerAuth = usePosStore((s) => s.hasManagerAuth);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const logGiftTxn = useMarketingStore((s) => s.logGiftTxn);
  const vendors = usePosStore((s) => s.vendors);
  const giftEntityId =
    giftEntityIdForCheck(order?.lines, emp?.operatorId) ||
    giftEntityIdForStation(
      emp?.operatorId,
      vendors.filter((v) => v.active).map((v) => v.id),
    );
  const giftAccess = resolveGiftAccess({
    venue: venueGiftRules(settings),
    entity: giftEntityId ? settings.entityGiftPolicy?.[giftEntityId] ?? null : null,
    hasEntity: Boolean(giftEntityId),
    role: emp?.role,
  });
  const giftOn = giftAccess.visible;
  const venueGiftOn = parsePaymentMethods(settings.paymentMethods).giftCard;
  const limits = parseGiftLimits(settings);

  const [tab, setTab] = useState<GiftTab>("balance");
  const [amt, setAmt] = useState("50");
  const [tender, setTender] = useState<"cash" | "card">("card");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [mgrOpen, setMgrOpen] = useState(false);
  const [cardView, setCardView] = useState<{
    balanceCents: number;
    status: string;
    activity: string;
  } | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const lookupRef = useRef<(raw: string) => void>(() => undefined);
  const accessRef = useRef(giftAccess);
  accessRef.current = giftAccess;

  useEffect(() => {
    if (!giftAccess.sell && (tab === "sell" || tab === "reload")) {
      setTab(giftAccess.redeem ? "redeem" : "balance");
    } else if (!giftAccess.redeem && tab === "redeem") {
      setTab("balance");
    }
  }, [giftAccess.sell, giftAccess.redeem, tab]);

  useEffect(() => {
    const action = tab === "sell" || tab === "reload" ? "load" : tab === "redeem" ? "redeem" : "balance";
    setPreferredMsrGiftAction(action);
    return () => setPreferredMsrGiftAction("balance");
  }, [tab]);

  useEffect(() => {
    const onSwipe = (ev: Event) => {
      const detail = (ev as CustomEvent<MsrSwipeEvent>).detail;
      if (!detail?.code) return;
      setCode(detail.code);
      codeRef.current?.focus();
      const access = accessRef.current;
      if (detail.kind === "gift_load" && access.sell) setTab("sell");
      else if (detail.kind === "gift_redeem" && access.redeem) setTab("redeem");
      else setTab("balance");
      lookupRef.current(detail.code);
      setNote(`Swipe received · ${detail.summary}`);
    };
    window.addEventListener("summex-msr-swipe", onSwipe);
    return () => window.removeEventListener("summex-msr-swipe", onSwipe);
  }, []);

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
                code: code.trim() || undefined,
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
    const redeemCached = () => {
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
    if (locId) {
      void (async () => {
        try {
          const looked = await lookupGiftCardFn({ data: { locationId: locId, code: needle } });
          if (!looked.ok) {
            setNote(looked.error || "Card not found");
            return;
          }
          if (!order || order.status !== "open") {
            setNote(`Balance ${formatCurrency(looked.card.balanceCents)}. Open a check to redeem.`);
            return;
          }
          const due = computeTotals(order, settings, { tender: "gift_card" }).balanceCents;
          const apply = Math.min(looked.card.balanceCents, due);
          if (apply <= 0) {
            setNote(`Balance ${formatCurrency(looked.card.balanceCents)}. Nothing due on this check.`);
            return;
          }
          const fulfiller = fulfillingIssuer(emp, settings, usePosStore.getState().vendors);
          const red = await redeemGiftCardFn({
            data: {
              locationId: locId,
              code: needle,
              amountCents: apply,
              fulfillerId: fulfiller.id,
              fulfillerKind: fulfiller.kind,
              checkId: order.id,
            },
          });
          if (!red.ok) {
            setNote(red.error || "Redeem failed");
            return;
          }
          const pay = takePayment({
            method: "gift_card",
            amountCents: apply,
            giftCardCode: needle,
            serverGift: true,
          });
          if (!pay.ok) {
            setNote(pay.error ?? "Redeem failed");
            return;
          }
          logGiftTxn({ giftCardId: looked.card.id, type: "redeem", amountCents: apply, note: needle });
          setNote(
            `Redeemed ${formatCurrency(apply)}. Remaining ${formatCurrency(looked.card.balanceCents - apply)}.`,
          );
        } catch {
          redeemCached();
        }
      })();
      return;
    }
    redeemCached();
  };

  lookupRef.current = (raw: string) => {
    const needle = raw.replace(/[\s-]/g, "").toUpperCase();
    if (!needle) {
      setCardView(null);
      setNote("Enter a card number");
      return;
    }
    const showLocal = () => {
      const local = giftCards.find(
        (g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle && g.status !== "closed",
      );
      if (!local) {
        setCardView(null);
        setNote("Card not found");
        return;
      }
      setCardView({
        balanceCents: local.balanceCents,
        status: local.status || "active",
        activity: giftActivity(local),
      });
      setNote(null);
    };
    if (!locId) {
      showLocal();
      return;
    }
    void lookupGiftCardFn({ data: { locationId: locId, code: needle } })
      .then((res) => {
        if (!res.ok) {
          showLocal();
          return;
        }
        const local = giftCards.find(
          (g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle && g.status !== "closed",
        );
        const card = res.card.ledger?.length ? res.card : local?.ledger?.length ? { ...res.card, ledger: local.ledger } : res.card;
        setCardView({
          balanceCents: card.balanceCents,
          status: card.status || "active",
          activity: giftActivity(card),
        });
        setNote(null);
      })
      .catch(() => showLocal());
  };

  const reload = (skipMgr = false) => {
    if (!giftAccess.sell) {
      setNote("This role cannot sell gift cards.");
      return;
    }
    const needle = code.replace(/[\s-]/g, "").toUpperCase();
    if (!needle) {
      setNote("Enter a card number");
      return;
    }
    const dollars = parseFloat(amt);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setNote("Enter a valid amount");
      return;
    }
    const cents = Math.round(dollars * 100);
    const cap = giftSellBlockedReason(cents, cardView?.balanceCents ?? 0, limits);
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
          const res = await reloadGiftCardFn({
            data: {
              locationId: locId,
              code: needle,
              amountCents: cents,
              tender,
              issuerId: issuer.id,
              issuerKind: issuer.kind,
              issuerName: issuer.name,
            },
          });
          if (res.ok) {
            setCardView({
              balanceCents: res.card.balanceCents,
              status: res.card.status || "active",
              activity: giftActivity({
                ...res.card,
                ledger: res.card.ledger?.length
                  ? res.card.ledger
                  : [
                      {
                        at: Date.now(),
                        kind: "reload",
                        amountCents: cents,
                        beforeCents: res.card.balanceCents - cents,
                        afterCents: res.card.balanceCents,
                      },
                    ],
              }),
            });
            setNote(`Reloaded ${formatCurrency(cents)}.`);
            return;
          }
          if (res.error) {
            setNote(res.error);
            return;
          }
        }
        const local = reloadGiftCard(needle, cents);
        if (!local.ok) {
          setNote(local.error ?? "Could not reload");
          return;
        }
        const card = usePosStore
          .getState()
          .giftCards.find((g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle);
        if (card) {
          setCardView({
            balanceCents: card.balanceCents,
            status: card.status || "active",
            activity: giftActivity(card),
          });
        }
        setNote(`Reloaded ${formatCurrency(cents)}.`);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not reload");
      }
    })();
  };

  if (!giftOn) {
    const offCopy = !venueGiftOn
      ? "Gift cards are off in Settings → Gift cards."
      : !giftAccess.entityEnabled
        ? "Gift cards are off for this entity."
        : "This role cannot sell or redeem gift cards.";
    return (
      <p className="p-4 text-sm text-muted-foreground" data-station-gift-off>
        {offCopy}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4" data-demo="station-gift-job">
      <UsbGiftMsrNote
        action={tab === "sell" || tab === "reload" ? "load" : tab === "redeem" ? "redeem" : "balance"}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          className="flex-1"
          variant={tab === "balance" ? "default" : "outline"}
          data-station-gift-balance
          onClick={() => setTab("balance")}
        >
          Check balance
        </Button>
        {giftAccess.sell ? (
          <Button
            className="flex-1"
            variant={tab === "sell" ? "default" : "outline"}
            data-station-gift-load
            onClick={() => setTab("sell")}
          >
            Load
          </Button>
        ) : null}
        {giftAccess.sell ? (
          <Button
            className="flex-1"
            variant={tab === "reload" ? "default" : "outline"}
            data-station-gift-reload
            onClick={() => setTab("reload")}
          >
            Reload
          </Button>
        ) : null}
        {giftAccess.redeem ? (
          <Button
            className="flex-1"
            variant={tab === "redeem" ? "default" : "outline"}
            onClick={() => setTab("redeem")}
          >
            Redeem
          </Button>
        ) : null}
      </div>
      <Input
        ref={codeRef}
        data-station-gift-code
        placeholder="Swipe or type the card number"
        value={code}
        autoComplete="off"
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      {tab === "sell" && giftAccess.sell ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Load a new card. Face value. Cash-discount markup does not apply to a gift load. Paired
            station + PIN only. Not sold online.
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
      ) : null}
      {tab === "reload" && giftAccess.sell ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Reload an issued card. Face value. Not sold online.</p>
          <Input placeholder="Amount USD" value={amt} inputMode="decimal" onChange={(e) => setAmt(e.target.value)} />
          <select
            className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
            value={tender}
            onChange={(e) => setTender(e.target.value as "cash" | "card")}
          >
            <option value="card">Card (Quantum Payments)</option>
            <option value="cash">Cash</option>
          </select>
          <Button className="w-full" size="lg" data-station-gift-reload-submit onClick={() => reload()}>
            Reload gift card
          </Button>
        </div>
      ) : null}
      {tab === "balance" ? (
        <Button className="w-full" size="lg" onClick={() => lookupRef.current(code)}>
          Check balance
        </Button>
      ) : null}
      {tab === "redeem" && giftAccess.redeem ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Scan or type the code. Applies to the open check and cannot exceed the card balance.
          </p>
          <Button className="w-full" size="lg" onClick={redeem}>
            Redeem
          </Button>
        </div>
      ) : null}
      {cardView ? (
        <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm" data-station-gift-result>
          <p>Balance {formatCurrency(cardView.balanceCents)}</p>
          <p>Status {cardView.status}</p>
          <p data-station-gift-activity>Last activity {cardView.activity}</p>
        </div>
      ) : null}
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
          if (tab === "reload") reload(true);
          else sell(true);
        }}
      />
    </div>
  );
}
