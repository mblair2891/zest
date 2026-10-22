import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { issueGiftCardFn, lookupGiftCardFn, reloadGiftCardFn } from "@/lib/gift/api";
import { hydrateGift } from "@/lib/gift/sync";
import { setPreferredMsrGiftAction, type MsrSwipeEvent } from "@/lib/pos/elo-msr";
import { defaultGiftIssuer, resolveGiftIssuer } from "@/lib/pos/gift-issuer";
import { giftNeedsManagerPin, giftSellBlockedReason, parseGiftLimits } from "@/lib/pos/gift-limits";
import {
  giftActionError,
  resolveGiftAccess,
  venueGiftRules,
  type GiftSettingsShape,
} from "@/lib/pos/gift-policy";
import { usePosStore } from "@/lib/pos/store";
import type { GiftCard } from "@/lib/pos/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { UsbGiftMsrNote } from "./EloMsrStation";
import { ManagerPinDialog } from "./ManagerPinDialog";

type Mode = "balance" | "load" | "reload";

type Shown = {
  code: string;
  balanceCents: number;
  status: string;
  activity: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  frozen: "Frozen",
  void: "Void",
  zeroed: "Zero balance",
  closed: "Closed",
};

function activityLine(card: GiftCard): string {
  const row = [...(card.ledger ?? [])].sort((a, b) => b.at - a.at)[0];
  if (!row) {
    return card.issuedAt ? `Issued ${formatDateTime(card.issuedAt)}` : "No activity yet";
  }
  const label =
    row.kind === "issue"
      ? "Load"
      : row.kind === "reload"
        ? "Reload"
        : row.kind === "redeem"
          ? "Redeem"
          : row.kind === "status"
            ? "Status"
            : "Adjust";
  const when = row.at ? formatDateTime(row.at) : "";
  return `${label} ${formatCurrency(Math.abs(row.amountCents))}${when ? ` · ${when}` : ""}`;
}

function shownFrom(card: GiftCard, typed: string): Shown {
  return {
    code: typed || card.code,
    balanceCents: card.balanceCents,
    status: STATUS_LABEL[card.status || "active"] || card.status || "Active",
    activity: activityLine(card),
  };
}

function offMessage(settings: GiftSettingsShape, entityId: string | null, role: string | null): string {
  const access = resolveGiftAccess({
    venue: venueGiftRules(settings),
    entity: entityId ? settings.entityGiftPolicy?.[entityId] ?? null : null,
    hasEntity: Boolean(entityId),
    role,
  });
  if (!access.venueOn) return "Gift cards are off in Settings → Gift cards.";
  if (!access.entityEnabled) return "Gift cards are off for this entity.";
  return "This role cannot sell or redeem gift cards.";
}

/**
 * Payments → Gift cards. Balance, load, and reload for the venue or one entity.
 * A swipe on a station with the USB reader checked fills the card number.
 */
export function PaymentsGiftDesk({
  entityId,
  write,
}: {
  entityId: string | null;
  write: boolean;
}) {
  const settings = usePosStore((s) => s.settings);
  const vendors = usePosStore((s) => s.vendors);
  const giftCards = usePosStore((s) => s.giftCards);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const issueGiftCard = usePosStore((s) => s.issueGiftCard);
  const reloadGiftCard = usePosStore((s) => s.reloadGiftCard);
  const hasManagerAuth = usePosStore((s) => s.hasManagerAuth);
  const role = emp?.role ?? null;
  const access = resolveGiftAccess({
    venue: venueGiftRules(settings),
    entity: entityId ? settings.entityGiftPolicy?.[entityId] ?? null : null,
    hasEntity: Boolean(entityId),
    role,
  });
  const sellDenied = giftActionError({
    settings,
    entityId,
    role,
    action: "sell",
  });
  const limits = parseGiftLimits(settings);

  const [mode, setMode] = useState<Mode>("balance");
  const [code, setCode] = useState("");
  const [amt, setAmt] = useState("50");
  const [tender, setTender] = useState<"cash" | "card">("card");
  const [note, setNote] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [mgrOpen, setMgrOpen] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const lookupRef = useRef<(raw: string) => void>(() => undefined);

  const rememberLocal = (needle: string, card: GiftCard): GiftCard => {
    if (card.ledger?.length) return card;
    const local = giftCards.find(
      (g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle && g.status !== "closed",
    );
    const latest = [...(local?.ledger ?? [])].sort((a, b) => b.at - a.at)[0];
    return latest ? { ...card, ledger: [latest], issuedAt: card.issuedAt || local?.issuedAt } : card;
  };

  lookupRef.current = (raw: string) => {
    const needle = raw.replace(/[\s-]/g, "").toUpperCase();
    if (!needle) {
      setNote("Enter a card number");
      setShown(null);
      return;
    }
    const showLocal = () => {
      const local = giftCards.find(
        (g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle && g.status !== "closed",
      );
      if (!local) {
        setShown(null);
        setNote("Card not found");
        return;
      }
      setShown(shownFrom(local, needle));
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
        setShown(shownFrom(rememberLocal(needle, res.card), needle));
        setNote(null);
      })
      .catch(() => showLocal());
  };

  useEffect(() => {
    if (!access.visible) return;
    setPreferredMsrGiftAction(mode === "balance" ? "balance" : "load");
    const onSwipe = (ev: Event) => {
      const detail = (ev as CustomEvent<MsrSwipeEvent>).detail;
      if (!detail?.code) return;
      setCode(detail.code);
      codeRef.current?.focus();
      lookupRef.current(detail.code);
    };
    window.addEventListener("summex-msr-swipe", onSwipe);
    return () => {
      window.removeEventListener("summex-msr-swipe", onSwipe);
      setPreferredMsrGiftAction("balance");
    };
  }, [access.visible, mode]);

  const sell = (skipMgr = false) => {
    if (!access.sell || !write) {
      setNote(sellDenied || "This role cannot sell gift cards.");
      return;
    }
    const dollars = parseFloat(amt);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setNote("Enter a valid amount");
      return;
    }
    const cents = Math.round(dollars * 100);
    const needle = code.replace(/[\s-]/g, "").toUpperCase();
    if (mode === "reload" && !needle) {
      setNote("Enter a card number");
      return;
    }
    const current = shown && mode === "reload" ? shown.balanceCents : 0;
    const cap = giftSellBlockedReason(cents, mode === "reload" ? current : 0, limits);
    if (cap) {
      setNote(cap);
      return;
    }
    if (!skipMgr && giftNeedsManagerPin(cents, limits) && !hasManagerAuth()) {
      setMgrOpen(true);
      setNote("High-value sell needs a manager PIN.");
      return;
    }
    const issuer = entityId
      ? resolveGiftIssuer(entityId, settings, vendors)
      : defaultGiftIssuer(emp, settings, vendors);
    const stamp = (card: GiftCard, typed: string, kind: "issue" | "reload") => {
      const withLine: GiftCard = card.ledger?.length
        ? card
        : {
            ...card,
            ledger: [
              {
                at: Date.now(),
                kind,
                amountCents: cents,
                beforeCents: kind === "reload" ? card.balanceCents - cents : 0,
                afterCents: card.balanceCents,
              },
            ],
          };
      setShown(shownFrom(withLine, typed || card.code));
    };
    void (async () => {
      try {
        if (mode === "reload") {
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
              await hydrateGift(locId);
              stamp(res.card, needle, "reload");
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
          if (card) stamp(card, needle, "reload");
          setNote(`Reloaded ${formatCurrency(cents)}.`);
          return;
        }
        if (locId) {
          const res = await issueGiftCardFn({
            data: {
              locationId: locId,
              amountCents: cents,
              code: needle || undefined,
              issuerId: issuer.id,
              issuerKind: issuer.kind,
              issuerName: issuer.name,
              tender,
              soldByEmployeeId: emp?.id,
              soldByOperatorId: emp?.operatorId,
            },
          });
          if (res.ok) {
            await hydrateGift(locId);
            setCode(res.plaintextCode);
            stamp(res.card, res.plaintextCode, "issue");
            setNote(`Loaded ${res.plaintextCode} · ${formatCurrency(cents)}.`);
            return;
          }
          if (res.error?.includes("Max ") || res.error) {
            setNote(res.error);
            return;
          }
        }
        const res = issueGiftCard({
          amountCents: cents,
          code: needle || undefined,
          issuerId: issuer.id,
          tender,
        });
        if (res.ok && res.code) {
          setCode(res.code);
          const card = usePosStore.getState().giftCards.find((g) => g.code === res.code);
          if (card) stamp(card, res.code, "issue");
          setNote(`Loaded ${res.code} · ${formatCurrency(cents)}.`);
        } else setNote(res.error ?? "Could not load");
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not load");
      }
    })();
  };

  return (
    <section className="space-y-3 rounded-xl border border-border px-3 py-3" data-payments-gift-cards>
      <div>
        <h3 className="text-sm font-semibold">Gift cards</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Check a balance, load a new card, or reload a card. Type the card number. A station with
          USB magstripe reader attached (gift cards) fills this field on swipe.
        </p>
      </div>
      {!access.visible ? (
        <p className="text-sm" data-payments-gift-off>
          {offMessage(settings, entityId, role)}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "balance" ? "default" : "outline"}
              data-payments-gift-balance
              onClick={() => setMode("balance")}
            >
              Check balance
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "load" ? "default" : "outline"}
              data-payments-gift-load
              disabled={!access.sell || !write}
              onClick={() => setMode("load")}
            >
              Load
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "reload" ? "default" : "outline"}
              data-payments-gift-reload
              disabled={!access.sell || !write}
              onClick={() => setMode("reload")}
            >
              Reload
            </Button>
          </div>
          {!access.sell && sellDenied ? (
            <p className="text-xs text-muted-foreground" data-payments-gift-sell-off>
              {sellDenied}
            </p>
          ) : null}
          <UsbGiftMsrNote action={mode === "balance" ? "balance" : "load"} />
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Card number</span>
            <Input
              ref={codeRef}
              value={code}
              data-payments-gift-code
              autoComplete="off"
              onChange={(e) => setCode(e.target.value)}
              placeholder="Swipe or type the card number"
            />
          </label>
          {mode !== "balance" && access.sell && write ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Amount ($)</span>
                <Input
                  type="number"
                  value={amt}
                  data-payments-gift-amount
                  onChange={(e) => setAmt(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Tender</span>
                <select
                  className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
                  value={tender}
                  data-payments-gift-tender
                  onChange={(e) => setTender(e.target.value === "cash" ? "cash" : "card")}
                >
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                </select>
              </label>
            </div>
          ) : null}
          <div>
            {mode === "balance" ? (
              <Button type="button" size="sm" onClick={() => lookupRef.current(code)}>
                Check balance
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                data-payments-gift-submit
                disabled={!access.sell || !write}
                onClick={() => sell(false)}
              >
                {mode === "load" ? "Load gift card" : "Reload gift card"}
              </Button>
            )}
          </div>
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          {shown ? (
            <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm" data-payments-gift-result>
              <p>
                Balance <span className="font-semibold tabular">{formatCurrency(shown.balanceCents)}</span>
              </p>
              <p>Status {shown.status}</p>
              <p data-payments-gift-activity>Last activity {shown.activity}</p>
            </div>
          ) : null}
        </>
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
    </section>
  );
}
