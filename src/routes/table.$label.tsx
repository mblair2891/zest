import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { formatCurrency } from "@/lib/utils";

export const Route = createFileRoute("/table/$label")({
  ssr: false,
  component: TableQrOrderPage,
});

/**
 * Table QR landing — guest scans sticker on table.
 * Flow A: order from table (dine_in_qr) → kitchen per settings (usually immediate).
 * Flow B: already ordered ahead → enter claim code → link to this table → fire kitchen.
 */
function TableQrOrderPage() {
  const { label } = Route.useParams();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"order" | "checkin">("order");
  const [claim, setClaim] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const menuItems = usePosStore((s) => s.menuItems);
  const tables = usePosStore((s) => s.tables);
  const cart = usePlatformStore((s) => s.onlineCart);
  const add = usePlatformStore((s) => s.addToOnlineCart);
  const place = usePlatformStore((s) => s.placeOnlineOrder);
  const setGuestName = usePlatformStore((s) => s.setOnlineGuestName);
  const markArrived = usePlatformStore((s) => s.markGuestArrived);
  const findClaim = usePlatformStore((s) => s.findOrderByClaim);
  const settings = usePlatformStore((s) => s.fulfillmentSettings);

  const table = useMemo(
    () =>
      tables.find(
        (t) => t.label === label || t.label === String(label),
      ) ?? null,
    [tables, label],
  );

  useEffect(() => {
    let left = 2;
    const done = () => {
      left -= 1;
      if (left <= 0) setReady(true);
    };
    const u1 = usePosStore.persist.onFinishHydration(done);
    const u2 = usePlatformStore.persist.onFinishHydration(done);
    void usePosStore.persist.rehydrate();
    void usePlatformStore.persist.rehydrate();
    if (usePosStore.persist.hasHydrated()) done();
    if (usePlatformStore.persist.hasHydrated()) done();
    const t = window.setTimeout(() => setReady(true), 1500);
    return () => {
      u1();
      u2();
      window.clearTimeout(t);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-muted-foreground">
        Loading table…
      </div>
    );
  }

  const items = menuItems.filter((e) => e.available && e.online !== false);
  const total = cart.reduce((s, i) => s + i.unitPriceCents * i.qty, 0);

  return (
    <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="border-b border-border bg-surface px-4 py-4">
        <div className="mx-auto max-w-lg">
          <Badge variant="info">Table QR</Badge>
          <h1 className="mt-1 text-2xl font-black tracking-tight">
            Table {label}
          </h1>
          <p className="text-sm text-muted-foreground">
            {table
              ? `${table.section} · ${table.seats} seats`
              : "Scan confirmed"}{" "}
            · Order here or check in an order-ahead
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "order" ? "default" : "outline"}
            onClick={() => setMode("order")}
            className="flex-1"
          >
            Order at table
          </Button>
          <Button
            size="sm"
            variant={mode === "checkin" ? "default" : "outline"}
            onClick={() => setMode("checkin")}
            className="flex-1"
          >
            I ordered ahead
          </Button>
        </div>

        {mode === "checkin" && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-2 text-sm font-medium">
              Link your order to table {label}
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Enter the claim code from your order confirmation. Kitchen will{" "}
              {settings.defaultFireModeOrderAhead === "on_arrival"
                ? "start when you check in"
                : "follow the restaurant fire rules"}
              .
            </p>
            <Input
              placeholder="Claim code (e.g. A7K2)"
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              className="mb-2"
            />
            <Button
              className="w-full"
              onClick={() => {
                const o = findClaim(claim);
                if (!o) {
                  setMsg("Order not found");
                  return;
                }
                const res = markArrived(o.id, {
                  tableLabel: label,
                  tableId: table?.id,
                });
                if (!res.ok) {
                  setMsg(res.error ?? "Failed");
                  return;
                }
                setMsg(`Checked in · #${o.number} linked to table ${label}`);
                void navigate({
                  to: "/order/$orderId",
                  params: { orderId: o.id },
                });
              }}
            >
              Check in & fire kitchen
            </Button>
          </div>
        )}

        {mode === "order" && (
          <>
            <div className="grid gap-2">
              {items.slice(0, 24).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    add({
                      menuItemId: item.id,
                      name: item.name,
                      unitPriceCents: item.priceCents,
                    })
                  }
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:border-primary/50"
                >
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-sm tabular text-muted-foreground">
                    {formatCurrency(item.priceCents)}
                  </span>
                </button>
              ))}
            </div>
            <div className="sticky bottom-4 rounded-2xl border border-border bg-surface p-4 shadow-lg">
              <p className="mb-2 text-sm font-medium">
                Cart · Table {label}{" "}
                <span className="text-muted-foreground">
                  ({cart.reduce((s, i) => s + i.qty, 0)} items)
                </span>
              </p>
              <Input
                className="mb-2"
                placeholder="Name for the order"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setGuestName(e.target.value);
                }}
              />
              <p className="mb-2 text-lg font-semibold tabular">
                {formatCurrency(total)}
              </p>
              <Button
                className="w-full"
                disabled={!cart.length}
                onClick={() => {
                  const res = place({
                    guestName: name || `Table ${label}`,
                    type: "dine_in_qr",
                    channel: "qr",
                    tableLabel: label,
                    tableId: table?.id,
                    kitchenFireMode: settings.defaultFireModeQrTable,
                  });
                  if (res.ok && res.orderId) {
                    // QR table: accept + fire if immediate
                    const st = usePlatformStore.getState();
                    st.acceptOnlineOrder(res.orderId);
                    void navigate({
                      to: "/order/$orderId",
                      params: { orderId: res.orderId },
                    });
                  } else setMsg(res.error ?? "Failed");
                }}
              >
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

        <p className="text-center text-[11px] text-muted-foreground">
          <Link to="/online" className="underline">
            Full online menu
          </Link>
          {" · "}
          Staff can also type the table number on the Online board
        </p>
      </main>
    </div>
  );
}
