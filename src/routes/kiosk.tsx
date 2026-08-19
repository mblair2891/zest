import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { formatCurrency } from "@/lib/utils";

export const Route = createFileRoute("/kiosk")({
  ssr: false,
  component: KioskPage,
});

function KioskPage() {
  const [ready, setReady] = useState(false);
  const menuItems = usePosStore((s) => s.menuItems);
  const cart = usePlatformStore((s) => s.onlineCart);
  const add = usePlatformStore((s) => s.addToOnlineCart);
  const place = usePlatformStore((s) => s.placeOnlineOrder);
  const clear = usePlatformStore((s) => s.clearOnlineCart);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let left = 2;
    const finish = () => {
      left -= 1;
      if (left <= 0) setReady(true);
    };
    const u1 = usePosStore.persist.onFinishHydration(finish);
    const u2 = usePlatformStore.persist.onFinishHydration(finish);
    usePosStore.persist.rehydrate();
    usePlatformStore.persist.rehydrate();
    if (usePosStore.persist.hasHydrated()) finish();
    if (usePlatformStore.persist.hasHydrated()) finish();
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
        Starting kiosk…
      </div>
    );
  }

  const items = menuItems.filter((e) => e.available).slice(0, 12);
  const total = cart.reduce((s, i) => s + i.unitPriceCents * i.qty, 0);

  return (
    <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-5">
        <div>
          <h1 className="text-2xl font-semibold">Self-serve kiosk</h1>
          <p className="text-sm text-muted-foreground">
            Tap to order · pay at counter or card
          </p>
        </div>
        <Link to="/" className="text-xs text-muted-foreground underline">
          Staff
        </Link>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 p-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
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
              className="min-h-28 rounded-2xl border-2 border-border bg-surface p-4 text-left text-lg font-medium active:scale-[0.98]"
            >
              {item.name}
              <span className="mt-2 block text-base tabular text-muted-foreground">
                {formatCurrency(item.priceCents)}
              </span>
            </button>
          ))}
        </div>
        <aside className="h-fit rounded-2xl border border-border bg-surface p-5">
          <p className="mb-3 text-lg font-semibold">Cart</p>
          <ul className="mb-4 max-h-64 space-y-2 overflow-y-auto text-sm">
            {cart.map((line, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  {line.qty}× {line.name}
                </span>
                <span className="tabular">
                  {formatCurrency(line.unitPriceCents * line.qty)}
                </span>
              </li>
            ))}
            {!cart.length && (
              <li className="text-muted-foreground">Tap items to add</li>
            )}
          </ul>
          <p className="mb-4 text-2xl font-semibold tabular">
            {formatCurrency(total)}
          </p>
          <Button
            className="mb-2 h-14 w-full text-base"
            disabled={!cart.length}
            onClick={() => {
              const res = place({
                guestName: "Kiosk guest",
                type: "takeout",
                channel: "kiosk",
              });
              if (res.ok) setDone("Order placed — pickup when ready");
            }}
          >
            Pay & send to kitchen
          </Button>
          <Button
            className="h-12 w-full"
            variant="outline"
            onClick={() => {
              clear();
              setDone(null);
            }}
          >
            Clear
          </Button>
          {done && (
            <p className="mt-3 text-sm text-success" role="status">
              {done}
            </p>
          )}
        </aside>
      </main>
    </div>
  );
}
