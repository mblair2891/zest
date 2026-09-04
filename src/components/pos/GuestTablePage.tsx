import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { cn, formatCurrency } from "@/lib/utils";
import { parseTicketQrToken, qrTokenMatchesLocation } from "@/lib/pos/qr-table";
import { isEmptyTable } from "@/lib/pos/floor-status";
import { computeTotals, linePrintedCents, tipSuggestions } from "@/lib/pos/calculations";
import { captureIsSandbox } from "@/lib/lifecycle/store";
import type { MenuItem, Order, OrderLine, Table } from "@/lib/pos/types";
import { groupLinesByEntity } from "@/lib/payments/entity-split";
import {
  parseQrPolicy,
  qrCanOpenCheck,
  qrCanPay,
  qrCanReorder,
  qrItemAllowed,
  qrNeedsAgeAffirm,
  qrPolicySummary,
} from "@/lib/pos/qr-policy";

type CartLine = { menuItemId: string; name: string; unitPriceCents: number; qty: number };

export function GuestTablePage({
  label,
  token,
  checkToken,
  payOnly,
  demoHint,
  seat,
}: {
  label?: string;
  token?: string;
  checkToken?: string;
  payOnly?: boolean;
  demoHint?: string;
  seat?: number;
}) {
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paid, setPaid] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [tip, setTip] = useState(0);
  const [giftCode, setGiftCode] = useState("");
  const [payMethod, setPayMethod] = useState<"card" | "gift_card">("card");
  const [pickedLineIds, setPickedLineIds] = useState<string[]>([]);
  const [pickedSeats, setPickedSeats] = useState<number[]>([]);
  const [evenWays, setEvenWays] = useState(2);

  const menuItems = usePosStore((s) => s.menuItems);
  const tables = usePosStore((s) => s.tables);
  const orders = usePosStore((s) => s.orders);
  const settings = usePosStore((s) => s.settings);
  const tenantLocationId = usePosStore((s) => s.tenantLocationId) || "";
  const vendors = usePosStore((s) => s.vendors);
  const guestAddToTable = usePosStore((s) => s.guestAddToTable);
  const guestSendOrder = usePosStore((s) => s.guestSendOrder);
  const guestPayOrder = usePosStore((s) => s.guestPayOrder);
  const policy = parseQrPolicy(settings.qrPolicy, settings.qrMode);

  useEffect(() => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      setReady(true);
    };
    const u1 = usePosStore.persist.onFinishHydration(done);
    void usePosStore.persist.rehydrate();
    if (usePosStore.persist.hasHydrated()) done();
    const t = window.setTimeout(done, 1600);
    return () => {
      u1();
      window.clearTimeout(t);
    };
  }, []);

  const ticket = useMemo(() => {
    if (!checkToken) return null;
    return parseTicketQrToken(checkToken, tenantLocationId);
  }, [checkToken, tenantLocationId]);

  const table: Table | null = useMemo(() => {
    if (token) {
      const hit = tables.find((t) => t.qrToken === token) ?? null;
      if (!hit) return null;
      if (tenantLocationId && hit.locationId && hit.locationId !== tenantLocationId) {
        return null;
      }
      if (tenantLocationId && !qrTokenMatchesLocation(token, tenantLocationId)) {
        return null;
      }
      return hit;
    }
    if (!label) return null;
    return tables.find((t) => t.label === label || t.label === String(label)) ?? null;
  }, [tables, label, token, tenantLocationId]);

  const orderFromTicket: Order | undefined = ticket
    ? orders.find((o) => o.id === ticket.orderId)
    : undefined;
  const tableFromTicket = orderFromTicket?.tableId
    ? tables.find((t) => t.id === orderFromTicket.tableId) ?? null
    : null;
  const resolvedTable = table ?? tableFromTicket;
  const order = orderFromTicket
    ?? (resolvedTable?.orderId ? orders.find((o) => o.id === resolvedTable.orderId) : undefined);
  const totals = order ? computeTotals(order, settings, { tender: "card" }) : null;

  const items = useMemo(() => {
    return menuItems.filter(
      (e) => e.available && e.online !== false && qrItemAllowed(e, policy.orderAllow),
    );
  }, [menuItems, policy.orderAllow]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      const v = it.vendorId ? vendors.find((x) => x.id === it.vendorId) : undefined;
      const key = v?.shortName ?? v?.name ?? settings.name;
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [items, vendors, settings.name]);

  const cartTotal = cart.reduce((s, i) => s + i.unitPriceCents * i.qty, 0);
  const ticketExpired = Boolean(ticket?.expired);
  const canPay = qrCanPay(policy) && !!order && order.status === "open" && !ticketExpired;
  const staffCheckOpen = Boolean(order && order.status === "open");
  const canOrder =
    qrCanReorder(policy) &&
    policy.orderAllow !== "none" &&
    (qrCanOpenCheck(policy) || staffCheckOpen) &&
    !ticketExpired;
  const displayLabel = resolvedTable?.label ?? label ?? token ?? "check";
  const needAge = qrNeedsAgeAffirm(policy);
  const showMenu = canOrder && (!needAge || ageOk);
  const payOnlyView = payOnly || (!qrCanReorder(policy) && qrCanPay(policy));

  const splitAmount = (lines: OrderLine[], balance: number): number => {
    if (policy.split === "off" || !order) return balance;
    if (policy.split === "even") {
      const n = Math.max(2, evenWays);
      return Math.ceil(balance / n);
    }
    if (policy.split === "by_seat") {
      const seats = pickedSeats.length ? pickedSeats : [];
      if (!seats.length) return balance;
      const share = lines
        .filter((l) => !l.voided && !l.comped && l.seat != null && seats.includes(l.seat))
        .reduce((s, l) => s + linePrintedCents(l), 0);
      return Math.min(balance, Math.max(0, share));
    }
    if (policy.split === "by_item") {
      const ids = pickedLineIds;
      if (!ids.length) return balance;
      const share = lines
        .filter((l) => !l.voided && ids.includes(l.id))
        .reduce((s, l) => s + linePrintedCents(l), 0);
      return Math.min(balance, Math.max(0, share));
    }
    return balance;
  };

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-muted-foreground">
        Loading table…
      </div>
    );
  }

  if (ticket && !order) {
    return (
      <GuestDone
        title={ticketExpired ? "This pay code expired" : "Check not found"}
        body="Ask staff to print a fresh check QR. This code is only for one ticket."
      />
    );
  }

  if (!resolvedTable && !order) {
    return (
      <GuestDone
        title="Unknown table"
        body={
          demoHint
            ? "This demo QR only works on the matching demo house."
            : "This token is not bound to a table at this location."
        }
      />
    );
  }

  const addCart = (item: MenuItem) => {
    setCart((prev) => {
      const hit = prev.find((l) => l.menuItemId === item.id);
      if (hit) {
        return prev.map((l) =>
          l.menuItemId === item.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          unitPriceCents: item.priceCents,
          qty: 1,
        },
      ];
    });
  };

  const sendCart = () => {
    if (!resolvedTable) {
      setMsg("See your server");
      return;
    }
    if (!canOrder) {
      setMsg(
        qrCanOpenCheck(policy)
          ? "Could not open a check"
          : "See your server",
      );
      return;
    }
    if (!staffCheckOpen && !qrCanOpenCheck(policy)) {
      setMsg("See your server");
      return;
    }
    for (const line of cart) {
      for (let i = 0; i < line.qty; i++) {
        const res = guestAddToTable(resolvedTable.id, line.menuItemId, {
          seat: seat && seat > 0 ? seat : undefined,
        });
        if (!res.ok) {
          setMsg(res.error ?? "Could not add");
          return;
        }
      }
    }
    const sent = guestSendOrder(resolvedTable.id);
    if (!sent.ok) {
      setMsg(sent.error ?? "Could not send");
      return;
    }
    setCart([]);
    setMsg(`Sent to ${settings.name}${name ? ` · ${name}` : ""}`);
  };

  const pay = () => {
    const oid = order?.id;
    if (!oid) {
      setMsg("No open check to pay");
      return;
    }
    if (ticketExpired) {
      setMsg("This pay code expired. Ask staff to print a fresh check.");
      return;
    }
    let sandbox = true;
    try {
      sandbox = captureIsSandbox();
    } catch {
      sandbox = true;
    }
    if (!sandbox && payMethod === "card") {
      setMsg(
        "Live cards are taken on a Quantum reader at the stand. Ask staff — gift still works if it is on.",
      );
      return;
    }
    const due = totals?.balanceCents ?? 0;
    const amount = splitAmount(order.lines, due);
    const res = guestPayOrder(oid, {
      amountCents: amount,
      tipCents: policy.tip ? tip : 0,
      method: payMethod,
      giftCode: payMethod === "gift_card" ? giftCode : undefined,
    });
    if (!res.ok) {
      setMsg(res.error ?? "Pay failed");
      return;
    }
    setPaid(true);
    setMsg(
      payMethod === "gift_card"
        ? "Paid with gift"
        : "Paid with Quantum Payments",
    );
  };

  if (paid) {
    const keep = policy.afterPay === "keep_open_for_reorder";
    return (
      <GuestDone
        title="Thank you"
        body={
          keep
            ? `Table ${displayLabel} is still open under ${settings.name}. Scan again to add more.`
            : `Table ${displayLabel} is closed out under ${settings.name}. Staff will bus when you leave.`
        }
        brand
      />
    );
  }

  const balance = totals?.balanceCents ?? 0;
  const charge = order ? splitAmount(order.lines, balance) : 0;
  const tips = policy.tip && charge > 0 ? tipSuggestions(charge) : [];

  return (
    <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="border-b border-border bg-surface px-4 py-4">
        <div className="mx-auto max-w-lg">
          <Badge variant="info">{checkToken ? "Check QR" : "Table QR"}</Badge>
          <h1 className="mt-1 text-2xl font-black tracking-tight">
            Table {displayLabel}
            {seat ? ` · seat ${seat}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {resolvedTable?.section ?? ""} · {settings.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{qrPolicySummary(policy)}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {ticketExpired && (
          <p className="rounded-2xl border border-warn/40 bg-warn/15 p-4 text-sm">
            This check QR expired. Ask staff to print a fresh one.
          </p>
        )}

        {order && totals && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-medium">Open check #{order.number}</p>
            <VendorCheck order={order} hostName={settings.name} />
            <p className="mt-2 text-lg font-semibold tabular">
              Due {formatCurrency(totals.balanceCents || totals.totalCents)}
            </p>
            {canPay && totals.balanceCents > 0 && (
              <PayPanel
                policy={policy}
                charge={charge}
                tip={tip}
                setTip={setTip}
                tips={tips}
                payMethod={payMethod}
                setPayMethod={setPayMethod}
                giftCode={giftCode}
                setGiftCode={setGiftCode}
                evenWays={evenWays}
                setEvenWays={setEvenWays}
                order={order}
                pickedLineIds={pickedLineIds}
                setPickedLineIds={setPickedLineIds}
                pickedSeats={pickedSeats}
                setPickedSeats={setPickedSeats}
                onPay={pay}
              />
            )}
          </div>
        )}

        {payOnlyView && !order && (
          <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            See your server. This QR pays an open check — it does not start a new ticket.
          </p>
        )}

        {!payOnlyView && !canOrder && (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
            {qrCanOpenCheck(policy)
              ? "Could not open a check on this QR."
              : isEmptyTable(resolvedTable?.status ?? "empty")
                ? "See your server"
                : "See your server — a staff-opened check is required before you can add items."}
          </p>
        )}

        {needAge && canOrder && !ageOk && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-medium">Drinks are on this menu</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirm you are of legal drinking age to see drink items.
            </p>
            <Button className="mt-3 w-full" onClick={() => setAgeOk(true)}>
              I am of legal drinking age
            </Button>
          </div>
        )}

        {showMenu && (
          <>
            {grouped.map(([vendor, list]) => (
              <div key={vendor}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {vendor}
                </p>
                <div className="grid gap-2">
                  {list.slice(0, 24).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addCart(item)}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:border-primary/50"
                    >
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm tabular text-muted-foreground">
                        {formatCurrency(item.priceCents)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="sticky bottom-4 rounded-2xl border border-border bg-surface p-4 shadow-lg">
              <p className="mb-2 text-sm font-medium">
                Cart · Table {displayLabel}{" "}
                <span className="text-muted-foreground">
                  ({cart.reduce((s, i) => s + i.qty, 0)} items)
                </span>
              </p>
              <Input
                className="mb-2"
                placeholder="Name for the order"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="mb-2 text-lg font-semibold tabular">
                {formatCurrency(cartTotal)}
              </p>
              <Button className="w-full" disabled={!cart.length} onClick={sendCart}>
                Send
              </Button>
            </div>
          </>
        )}

        {msg && (
          <p className="text-center text-xs text-primary" role="status">
            {msg}
          </p>
        )}
      </main>
    </div>
  );
}

function GuestDone({
  title,
  body,
  brand,
}: {
  title: string;
  body: string;
  brand?: boolean;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
      {brand ? <Badge variant="secondary">Quantum Payments</Badge> : null}
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function VendorCheck({ order, hostName }: { order: Order; hostName: string }) {
  const groups = groupLinesByEntity(
    order.lines.filter((l) => !l.voided),
    hostName,
  );
  const multi = groups.length > 1;
  return (
    <div className="mt-2 space-y-2 text-sm">
      {groups.map((g) => (
        <div key={g.entityId}>
          {multi ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {g.displayName}
            </p>
          ) : null}
          <ul className="space-y-1">
            {g.lines.slice(0, 16).map((l) => (
              <li
                key={l.id}
                className={cn("flex justify-between gap-2", multi && "pl-2")}
              >
                <span>
                  {l.quantity}× {l.name}
                  {l.seat ? ` · seat ${l.seat}` : ""}
                </span>
                <span className="tabular">{formatCurrency(linePrintedCents(l))}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {multi ? (
        <p className="text-[11px] text-muted-foreground">
          One check. Card: one authorization, split to the vendors above. Quantum
          Payments · Summex.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Quantum Payments · Summex. One guest check.
        </p>
      )}
    </div>
  );
}

function PayPanel({
  policy,
  charge,
  tip,
  setTip,
  tips,
  payMethod,
  setPayMethod,
  giftCode,
  setGiftCode,
  evenWays,
  setEvenWays,
  order,
  pickedLineIds,
  setPickedLineIds,
  pickedSeats,
  setPickedSeats,
  onPay,
}: {
  policy: ReturnType<typeof parseQrPolicy>;
  charge: number;
  tip: number;
  setTip: (n: number) => void;
  tips: number[];
  payMethod: "card" | "gift_card";
  setPayMethod: (m: "card" | "gift_card") => void;
  giftCode: string;
  setGiftCode: (s: string) => void;
  evenWays: number;
  setEvenWays: (n: number) => void;
  order: Order;
  pickedLineIds: string[];
  setPickedLineIds: (ids: string[]) => void;
  pickedSeats: number[];
  setPickedSeats: (n: number[]) => void;
  onPay: () => void;
}) {
  const giftOn = policy.payAllow === "gift" || policy.payAllow === "both";
  const cardOn = policy.payAllow === "card" || policy.payAllow === "both";
  const seats = [
    ...new Set(
      order.lines.filter((l) => !l.voided && l.seat != null).map((l) => l.seat as number),
    ),
  ].sort((a, b) => a - b);

  return (
    <div className="mt-3 space-y-3">
      {policy.split === "even" && (
        <label className="block text-xs text-muted-foreground">
          Split even ways
          <Input
            className="mt-1"
            type="number"
            min={2}
            max={12}
            value={evenWays}
            onChange={(e) => setEvenWays(Math.max(2, Number(e.target.value) || 2))}
          />
        </label>
      )}
      {policy.split === "by_item" && (
        <ul className="space-y-1 text-sm">
          {order.lines
            .filter((l) => !l.voided)
            .map((l) => (
              <li key={l.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={pickedLineIds.includes(l.id)}
                    onChange={(e) =>
                      setPickedLineIds(
                        e.target.checked
                          ? [...pickedLineIds, l.id]
                          : pickedLineIds.filter((id) => id !== l.id),
                      )
                    }
                  />
                  <span className="flex-1">
                    {l.quantity}× {l.name}
                  </span>
                  <span className="tabular">{formatCurrency(linePrintedCents(l))}</span>
                </label>
              </li>
            ))}
        </ul>
      )}
      {policy.split === "by_seat" && (
        <div className="flex flex-wrap gap-2">
          {seats.length === 0 ? (
            <p className="text-xs text-muted-foreground">No seats tagged on this check.</p>
          ) : (
            seats.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={pickedSeats.includes(s)}
                  onChange={(e) =>
                    setPickedSeats(
                      e.target.checked
                        ? [...pickedSeats, s]
                        : pickedSeats.filter((n) => n !== s),
                    )
                  }
                />
                Seat {s}
              </label>
            ))
          )}
        </div>
      )}
      {policy.tip && (
        <div className="flex flex-wrap gap-2">
          {[0, ...tips].map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tip === t ? "default" : "outline"}
              onClick={() => setTip(t)}
            >
              {t === 0 ? "No tip" : formatCurrency(t)}
            </Button>
          ))}
        </div>
      )}
      {giftOn && cardOn && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={payMethod === "card" ? "default" : "outline"}
            onClick={() => setPayMethod("card")}
          >
            Card
          </Button>
          <Button
            size="sm"
            variant={payMethod === "gift_card" ? "default" : "outline"}
            onClick={() => setPayMethod("gift_card")}
          >
            Gift
          </Button>
        </div>
      )}
      {payMethod === "gift_card" && giftOn && (
        <Input
          placeholder="Gift code"
          value={giftCode}
          onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
        />
      )}
      <p className="text-sm tabular">
        Charging {formatCurrency(charge + (policy.tip ? tip : 0))}
      </p>
      <Button className="w-full" onClick={onPay}>
        {payMethod === "gift_card" ? "Redeem gift" : "Pay with Quantum Payments"}
      </Button>
    </div>
  );
}
