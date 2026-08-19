import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/order/$orderId")({
  ssr: false,
  component: OrderTrackingPage,
});

function OrderTrackingPage() {
  const { orderId } = Route.useParams();
  const [ready, setReady] = useState(false);
  const [tableInput, setTableInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const order = usePlatformStore((s) =>
    s.onlineOrders.find((o) => o.id === orderId),
  );
  const markArrived = usePlatformStore((s) => s.markGuestArrived);
  const processQueue = usePlatformStore((s) => s.processKitchenFireQueue);
  const tables = usePosStore((s) => s.tables);

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

  // Poll fire queue for delay modes
  useEffect(() => {
    const id = window.setInterval(() => processQueue(), 5000);
    return () => window.clearInterval(id);
  }, [processQueue]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-muted-foreground">
        Loading order…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg px-4">
        <p className="font-semibold">Order not found</p>
        <Link to="/online">
          <Button size="sm">Order online</Button>
        </Link>
      </div>
    );
  }

  const needsCheckIn =
    (order.type === "order_ahead" || order.type === "curbside") &&
    order.arrivalStatus === "awaiting" &&
    order.kitchenStatus !== "fired";

  const fireLabel =
    order.kitchenStatus === "fired"
      ? `In kitchen · ${order.firedToKitchenAt ? formatDateTime(order.firedToKitchenAt) : ""}`
      : order.kitchenFireMode === "on_arrival"
        ? "Kitchen waiting until you check in"
        : order.fireAt
          ? `Kitchen fires at ${formatDateTime(order.fireAt)}`
          : "Kitchen pending";

  return (
    <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="border-b border-border bg-surface px-4 py-5">
        <div className="mx-auto max-w-md text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Order confirmation
          </p>
          <h1 className="mt-1 text-3xl font-black tabular">#{order.number}</h1>
          <p className="mt-1 text-sm">
            Claim code{" "}
            <span className="font-mono text-lg font-bold text-primary">
              {order.claimCode ?? "—"}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Badge variant="info" className="capitalize">
              {order.type.replaceAll("_", " ")}
            </Badge>
            <Badge
              variant={
                order.status === "ready"
                  ? "success"
                  : order.status === "preparing"
                    ? "warn"
                    : "secondary"
              }
            >
              {order.status.replaceAll("_", " ")}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="font-medium">{order.guestName}</p>
          <p className="text-xs text-muted-foreground">
            {fireLabel}
            {order.tableLabel ? ` · Table ${order.tableLabel}` : ""}
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {order.items.map((i, idx) => (
              <li key={idx} className="flex justify-between">
                <span>
                  {i.qty}× {i.name}
                </span>
                <span className="tabular text-muted-foreground">
                  {formatCurrency(i.unitPriceCents * i.qty)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-right text-lg font-semibold tabular">
            {formatCurrency(order.totalCents)}
          </p>
        </div>

        {needsCheckIn && (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
            <h2 className="text-sm font-semibold">I'm here</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {order.type === "curbside"
                ? "Tell us you've arrived (and vehicle if needed). Kitchen will start per settings."
                : "Scan the table QR or type your table number so staff can deliver to you."}
            </p>
            {order.type !== "curbside" && (
              <Input
                className="mt-3"
                placeholder="Table number"
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
              />
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  const t = tables.find(
                    (x) => x.label === tableInput.trim(),
                  );
                  const res = markArrived(order.id, {
                    tableLabel:
                      order.type === "curbside"
                        ? undefined
                        : tableInput.trim() || order.tableLabel,
                    tableId: t?.id,
                  });
                  setMsg(res.ok ? "Checked in — kitchen notified" : res.error ?? "Failed");
                }}
              >
                Check in
              </Button>
              {order.type !== "curbside" && (
                <Link
                  to="/table/$label"
                  params={{ label: tableInput.trim() || "12" }}
                >
                  <Button variant="outline">Open table QR</Button>
                </Link>
              )}
            </div>
            {order.type === "order_ahead" && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Tip: sit down, scan the QR on the table, choose “I ordered
                ahead”, enter{" "}
                <span className="font-mono text-foreground">
                  {order.claimCode}
                </span>
                .
              </p>
            )}
          </div>
        )}

        {order.type === "curbside" && order.vehicleDescription && (
          <p className="text-center text-xs text-muted-foreground">
            Vehicle: {order.vehicleColor} {order.vehicleDescription}
          </p>
        )}

        {msg && (
          <p className="text-center text-sm text-primary" role="status">
            {msg}
          </p>
        )}

        <div className="flex justify-center gap-3 text-xs">
          <Link to="/online" className="underline text-muted-foreground">
            Order more
          </Link>
          <Link to="/" className="underline text-muted-foreground">
            Staff POS
          </Link>
        </div>
      </main>
    </div>
  );
}
