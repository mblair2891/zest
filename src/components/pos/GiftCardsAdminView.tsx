import { useEffect, useMemo, useState } from "react";
import { Ban, Gift, Plus, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { useMarketingStore } from "@/lib/pos/marketing-store";
import { useDemoOperatingEntityId } from "@/lib/demo/use-demo-operating-entity";
import { isProspectDemo } from "@/lib/demo/session";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  defaultGiftIssuer,
  liabilityByIssuer,
  listGiftIssuers,
  resolveGiftIssuer,
} from "@/lib/pos/gift-issuer";
import { parsePaymentMethods } from "@/lib/pos/payment-methods";
import { giftNeedsManagerPin, giftSellBlockedReason, parseGiftLimits } from "@/lib/pos/gift-limits";
import { saveLocationSettingsFn } from "@/lib/access/api";
import { issueGiftCardFn, setGiftStatusFn } from "@/lib/gift/api";
import { hydrateGift } from "@/lib/gift/sync";
import { summitHallDemoGiftCards } from "@/lib/saas/summit-hall";
import type { GiftCardStatus } from "@/lib/pos/types";
import { ManagerPinDialog } from "./ManagerPinDialog";

export function GiftCardsAdminView({ write = true }: { write?: boolean }) {
  const settings = usePosStore((s) => s.settings);
  const vendors = usePosStore((s) => s.vendors);
  const giftCards = usePosStore((s) => s.giftCards);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const orgId = useSaasStore((s) => s.org.id);
  const issueGiftCard = usePosStore((s) => s.issueGiftCard);
  const setGiftCardStatus = usePosStore((s) => s.setGiftCardStatus);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const hasManagerAuth = usePosStore((s) => s.hasManagerAuth);
  const giftTxns = useMarketingStore((s) => s.giftTxns);
  const logGiftTxn = useMarketingStore((s) => s.logGiftTxn);
  const demoScope = useDemoOperatingEntityId();
  const peer = Boolean(settings.peerVenue || settings.operatingModel === "peer_venue");
  const giftOn = parsePaymentMethods(settings.paymentMethods).giftCard;
  const issuers = listGiftIssuers(settings, vendors);
  const defaultIssuer = defaultGiftIssuer(emp, settings, vendors);
  const limits = parseGiftLimits(settings);

  const [q, setQ] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [amt, setAmt] = useState("50");
  const [tender, setTender] = useState<"cash" | "card">("card");
  const [issuerId, setIssuerId] = useState(defaultIssuer.id);
  const [msg, setMsg] = useState<string | null>(null);
  const [mgrOpen, setMgrOpen] = useState(false);
  const [pending, setPending] = useState<{
    id: string;
    code: string;
    status: GiftCardStatus;
  } | null>(null);

  useEffect(() => {
    const s = usePosStore.getState();
    if (!(s.settings.isDemo || s.settings.demoIsolated)) return;
    if (s.giftCards.length > 0) return;
    usePosStore.setState({ giftCards: summitHallDemoGiftCards() });
  }, []);

  useEffect(() => {
    if (locId) void hydrateGift(locId);
  }, [locId]);

  const scoped = useMemo(() => {
    let rows = giftCards.filter((g) => g.status !== "closed");
    if (demoScope) rows = rows.filter((g) => (g.issuerId || "") === demoScope);
    const needle = q.replace(/[\s-]/g, "").toUpperCase();
    if (needle) {
      rows = rows.filter((g) => {
        const code = g.code.replace(/[\s-]/g, "").toUpperCase();
        return code.includes(needle) || code.slice(-4) === needle.slice(-4);
      });
    }
    return rows;
  }, [giftCards, demoScope, q]);

  const outstanding = scoped
    .filter((g) => g.active && g.status !== "void" && !g.breakageProcessedAt)
    .reduce((s, g) => s + g.balanceCents, 0);
  const liability = liabilityByIssuer(scoped, settings, vendors);
  const issues = giftTxns.filter((t) => t.type === "issue" || t.type === "reload");
  const redeems = giftTxns.filter((t) => t.type === "redeem");

  const persistLimits = (patch: {
    giftMaxLoadCents?: number;
    giftMaxBalanceCents?: number;
    giftMaxSellPerTxnCents?: number;
  }) => {
    updateSettings(patch);
    if (!write || isProspectDemo() || !orgId || !locId) return;
    void saveLocationSettingsFn({
      data: { orgId, locationId: locId, setup: patch },
    }).catch(() => undefined);
  };

  const sell = (skipMgr = false) => {
    const dollars = parseFloat(amt);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setMsg("Enter a valid amount");
      return;
    }
    const cents = Math.round(dollars * 100);
    const cap = giftSellBlockedReason(cents, 0, limits);
    if (cap) {
      setMsg(cap);
      return;
    }
    if (!skipMgr && giftNeedsManagerPin(cents, limits) && !hasManagerAuth()) {
      setMgrOpen(true);
      setMsg("High-value sell needs a manager PIN.");
      return;
    }
    const issuer = resolveGiftIssuer(issuerId, settings, vendors);
    void (async () => {
      try {
        if (locId) {
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
            await hydrateGift(locId);
            setMsg(`Issued ${res.plaintextCode} · $${dollars.toFixed(2)} face value. Not sold online.`);
            setIssueOpen(false);
            return;
          }
          if (res.error?.includes("Max ")) {
            setMsg(res.error);
            return;
          }
        }
        const res = issueGiftCard({
          amountCents: cents,
          issuerId: issuer.id,
          tender,
        });
        if (res.ok && res.code) {
          logGiftTxn({ giftCardId: res.code, type: "issue", amountCents: cents, note: res.code });
          setMsg(`Issued ${res.code} · $${dollars.toFixed(2)} face value.`);
          setIssueOpen(false);
        } else setMsg(res.error ?? "Could not issue");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not issue");
      }
    })();
  };

  const applyStatus = (id: string, code: string, status: GiftCardStatus) => {
    setGiftCardStatus(id, status);
    logGiftTxn({
      giftCardId: code,
      type: status === "frozen" ? "freeze" : status === "void" ? "void" : "adjust",
      amountCents: 0,
    });
    if (locId) {
      void setGiftStatusFn({ data: { locationId: locId, cardId: id, status } }).catch(() => undefined);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-1" data-demo="gift-cards-tab">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold" data-checklist-focus="gift" tabIndex={-1}>
          Gift cards
        </h2>
        <Badge variant={giftOn ? "success" : "secondary"}>{giftOn ? "Accepting" : "Off"}</Badge>
        <GuideLearnLink topicId="gift-cards" compact>
          Learn
        </GuideLearnLink>
        {giftOn && write && (
          <Button size="sm" className="ml-auto" onClick={() => setIssueOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Issue
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        First-party in-person ledger only. No third-party gift networks, no open-loop Visa/MC gift,
        no public website purchase, no shipping. Sell and redeem on a paired station with a staff PIN.
        {peer ? " Issuer is the selling entity. House view lists every card." : ""}
      </p>
      {msg && (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          {msg}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-2">
        <p className="text-sm font-medium">Limits</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Max load / balance ($)</span>
            <Input
              type="number"
              disabled={!write}
              value={String(limits.maxBalanceCents / 100)}
              onChange={(e) => {
                const cents = Math.max(100, Math.round((parseFloat(e.target.value) || 500) * 100));
                persistLimits({ giftMaxLoadCents: cents, giftMaxBalanceCents: cents });
              }}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Max sell per transaction ($)</span>
            <Input
              type="number"
              disabled={!write}
              value={String(limits.maxSellPerTxnCents / 100)}
              onChange={(e) => {
                const cents = Math.max(100, Math.round((parseFloat(e.target.value) || 500) * 100));
                persistLimits({ giftMaxSellPerTxnCents: cents });
              }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Outstanding liability</p>
        <p className="mt-1 text-2xl font-semibold tabular">{formatCurrency(outstanding)}</p>
        {liability.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {liability.map((row) => (
              <li key={row.issuerId} className="flex justify-between gap-2">
                <span>{row.issuerName}</span>
                <span className="tabular">{formatCurrency(row.outstandingCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Issue / sell log</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {issues.slice(0, 8).map((t) => (
              <li key={t.id}>
                {t.type} · {formatCurrency(t.amountCents)}
                {t.note ? ` · ${t.note}` : ""}
              </li>
            ))}
            {issues.length === 0 && <li>No issues yet.</li>}
          </ul>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Redeem log</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {redeems.slice(0, 8).map((t) => (
              <li key={t.id}>
                Redeem · {formatCurrency(t.amountCents)}
                {t.note ? ` · ${t.note}` : ""}
              </li>
            ))}
            {redeems.length === 0 && <li>No redemptions yet.</li>}
          </ul>
        </section>
      </div>

      <Input
        placeholder="Lookup by code or last 4"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {scoped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center" data-demo="gift-empty">
          <Gift className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No gift cards yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Issue a first-party card here or on a paired station. Not sold online.
          </p>
          {giftOn && write && (
            <Button className="mt-3" size="sm" onClick={() => setIssueOpen(true)}>
              Issue
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2" data-demo="gift-admin">
          {scoped.map((g) => (
            <div key={g.id} className="rounded-xl border border-border bg-surface p-3">
              <p className="font-mono text-sm">{g.code}</p>
              <p className="mt-1 text-lg font-semibold tabular">{formatCurrency(g.balanceCents)}</p>
              <p className="text-xs text-muted-foreground">
                {g.status || "active"}
                {g.issuerName ? ` · issuer ${g.issuerName}` : ""}
              </p>
              {g.issuedAt && (
                <p className="text-[11px] text-muted-foreground">Issued {formatDateTime(g.issuedAt)}</p>
              )}
              {g.ledger && g.ledger.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
                  {g.ledger.slice(-4).reverse().map((row, i) => (
                    <li key={`${g.id}-led-${i}`}>
                      {row.kind} · {formatCurrency(row.afterCents)}
                    </li>
                  ))}
                </ul>
              )}
              {write && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {g.status !== "frozen" && g.active && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setPending({ id: g.id, code: g.code, status: "frozen" });
                        setMgrOpen(true);
                      }}
                    >
                      <Snowflake className="h-3 w-3" />
                      Freeze
                    </Button>
                  )}
                  {g.status === "frozen" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setPending({ id: g.id, code: g.code, status: "active" });
                        setMgrOpen(true);
                      }}
                    >
                      Unfreeze
                    </Button>
                  )}
                  {g.status !== "void" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setPending({ id: g.id, code: g.code, status: "void" });
                        setMgrOpen(true);
                      }}
                    >
                      <Ban className="h-3 w-3" />
                      Void
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue gift card</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Face value — cash-discount markup does not apply to a gift load. Paired station + PIN
            also sells. Not sold online.
          </p>
          <Input placeholder="Amount USD" value={amt} onChange={(e) => setAmt(e.target.value)} />
          {peer && (
            <select
              className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
              value={issuerId}
              onChange={(e) => setIssuerId(e.target.value)}
            >
              {issuers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
            value={tender}
            onChange={(e) => setTender(e.target.value as "cash" | "card")}
          >
            <option value="card">Card (Quantum Payments)</option>
            <option value="cash">Cash</option>
          </select>
          <Button onClick={() => sell()}>Issue</Button>
        </DialogContent>
      </Dialog>
      <ManagerPinDialog
        open={mgrOpen}
        onOpenChange={setMgrOpen}
        title="Manager PIN · gift"
        description="Freeze, void, or high-value sell needs a manager PIN."
        onVerified={() => {
          setMgrOpen(false);
          if (pending) {
            applyStatus(pending.id, pending.code, pending.status);
            setPending(null);
          } else sell(true);
        }}
      />
    </div>
  );
}
