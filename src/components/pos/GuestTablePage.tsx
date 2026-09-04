import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { cn, formatCurrency } from "@/lib/utils";
import { parseQrMode, QR_MODE_LABEL, qrTokenMatchesLocation } from "@/lib/pos/qr-table";
import { isEmptyTable } from "@/lib/pos/floor-status";
import { computeTotals, linePrintedCents } from "@/lib/pos/calculations";
import { captureIsSandbox } from "@/lib/lifecycle/store";
import type { MenuItem, Table } from "@/lib/pos/types";
import { groupLinesByEntity } from "@/lib/payments/entity-split";

type CartLine = { menuItemId: string; name: string; unitPriceCents: number; qty: number };

export function GuestTablePage({
  label,
  token,
  payOnly,
  demoHint,
}: {
  label?: string;
  token?: string;
  payOnly?: boolean;
  demoHint?: string;
}) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paid, setPaid] = useState(false);

  const menuItems = usePosStore((s) => s.menuItems);
  const tables = usePosStore((s) => s.tables);
  const orders = usePosStore((s) => s.orders);
  const settings = usePosStore((s) => s.settings);
  const tenantLocationId = usePosStore((s) => s.tenantLocationId) || "";
  const vendors = usePosStore((s) => s.vendors);
  const guestAddToTable = usePosStore((s) => s.guestAddToTable);
  const guestSendOrder = usePosStore((s) => s.guestSendOrder);
  const guestPayOrder = usePosStore((s) => s.guestPayOrder);
  const qrMode = parseQrMode(settings.qrMode);

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
    return (
      tables.find((t) => t.label === label || t.label === String(label)) ?? null
    );
  }, [tables, label, token, tenantLocationId]);

  const order = table?.orderId
    ? orders.find((o) => o.id === table.orderId)
    : undefined;
  const totals = order ? computeTotals(order, settings, { tender: "card" }) : null;

  const items = useMemo(() => {
    const available = menuItems.filter((e) => e.available && e.online !== false);
    if (!settings.hostMultiOperator) return available;
    return available;
  }, [menuItems, settings.hostMultiOperator]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      const v = it.vendorId
        ? vendors.find((x) => x.id === it.vendorId)
        : undefined;
      const key = v?.shortName ?? v?.name ?? "House";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [items, vendors]);

  const cartTotal = cart.reduce((s, i) => s + i.unitPriceCents * i.qty, 0);
  const wantPay = payOnly || qrMode === "pay_only";
  const canOrder =
    qrMode === "full" ||
    (qrMode === "hybrid" && table && !isEmptyTable(table.status) && !!table.orderId);
  const displayLabel = table?.label ?? label ?? token ?? "—";

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-muted-foreground">
        Loading table…
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
        <p className="text-lg font-semibold">Unknown table</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {demoHint
            ? "This demo QR only works on the matching demo house. Open the demo first, then scan again."
            : "This token is not bound to a table at this location."}
        </p>
        <Link to="/" className="text-sm underline">
          Home
        </Link>
      </div>
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
    if (!canOrder) {
      setMsg(
        qrMode === "pay_only"
          ? "This table QR is pay only — ask staff to order"
          : "Ask staff to seat you first, then add follow-ups here",
      );
      return;
    }
    for (const line of cart) {
      for (let i = 0; i < line.qty; i++) {
        const res = guestAddToTable(table.id, line.menuItemId);
        if (!res.ok) {
          setMsg(res.error ?? "Could not add");
          return;
        }
      }
    }
    const sent = guestSendOrder(table.id);
    if (!sent.ok) {
      setMsg(sent.error ?? "Could not send");
      return;
    }
    setCart([]);
    setMsg(`Sent to ${settings.name}${name ? ` · ${name}` : ""}`);
  };

  const pay = () => {
    const live = usePosStore.getState().tables.find((t) => t.id === table.id);
    const oid = live?.orderId;
    if (!oid) {
      setMsg("No open check to pay");
      return;
    }
    let sandbox = true;
    try {
      sandbox = captureIsSandbox();
    } catch {
      sandbox = true;
    }
    if (!sandbox) {
      setMsg(
        "Live cards are taken on a Quantum reader at the stand. Ask staff — cash still works.",
      );
      return;
    }
    const res = guestPayOrder(oid);
    if (!res.ok) {
      setMsg(res.error ?? "Pay failed");
      return;
    }
    setPaid(true);
    setMsg("Paid with Quantum Payments sandbox");
  };

  if (paid) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
        <Badge variant="secondary">Quantum Payments</Badge>
        <h1 className="text-2xl font-black">Thank you</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Table {displayLabel} is closed out under {settings.name}. Staff will bus when you leave.
        </p>
        <Button onClick={() => void navigate({ to: "/" })}>Done</Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="border-b border-border bg-surface px-4 py-4">
        <div className="mx-auto max-w-lg">
          <Badge variant="info">Table QR</Badge>
          <h1 className="mt-1 text-2xl font-black tracking-tight">
            Table {displayLabel}
          </h1>
          <p className="text-sm text-muted-foreground">
            {table.section} · {table.seats} seats · {settings.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{QR_MODE_LABEL[qrMode]}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {order && totals && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-medium">Open check #{order.number}</p>
            <div className="mt-2 space-y-2 text-sm">
              {(() => {
                const groups = groupLinesByEntity(
                  order.lines.filter((l) => !l.voided),
                  settings.name,
                );
                const multi = groups.length > 1;
                return groups.map((g) => (
                  <div key={g.entityId}>
                    {multi ? (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.displayName}
                      </p>
                    ) : null}
                    <ul className="space-y-1">
                      {g.lines.slice(0, 12).map((l) => (
                        <li
                          key={l.id}
                          className={cn("flex justify-between gap-2", multi && "pl-2")}
                        >
                          <span>
                            {l.quantity}× {l.name}
                          </span>
                          <span className="tabular">
                            {formatCurrency(linePrintedCents(l))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ));
              })()}
            </div>
            <p className="mt-2 text-lg font-semibold tabular">
              Due {formatCurrency(totals.balanceCents || totals.totalCents)}
            </p>
            {order.lines.some((l) => l.vendorId) &&
            new Set(order.lines.filter((l) => !l.voided).map((l) => l.vendorId || "host")).size >
              1 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                One check. Card: one authorization, split to the vendors above. Quantum
                Payments · Summex.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Quantum Payments · Summex. One guest check.
              </p>
            )}
            <Button className="mt-3 w-full" onClick={pay}>
              Pay with Quantum Payments
            </Button>
          </div>
        )}

        {wantPay && !order && (
          <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            Staff will start the check. When it is open, scan again to pay with Quantum Payments.
          </p>
        )}

        {!wantPay && !canOrder && (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
            Hybrid QR: ask the host to seat this table first. Follow-up food and drinks appear here on the open check.
          </p>
        )}

        {!wantPay && canOrder && (
          <>
            {grouped.map(([vendor, list]) => (
              <div key={vendor}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {vendor}
                  {vendors.length > 1 ? " · tagged on the host check" : ""}
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
                Send to kitchen
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
