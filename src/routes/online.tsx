import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import type {
  KitchenFireMode,
  OnlineOrderType,
} from "@/lib/pos/platform-types";
import { formatCurrency } from "@/lib/utils";

export const Route = createFileRoute("/online")({
  ssr: false,
  component: OnlineOrderingPage,
});

const TYPE_OPTS: {
  id: OnlineOrderType;
  label: string;
  blurb: string;
}[] = [
  {
    id: "order_ahead",
    label: "Order ahead",
    blurb: "Order now, seat & check in when you arrive",
  },
  {
    id: "takeout",
    label: "Pickup / to-go",
    blurb: "Counter pickup",
  },
  {
    id: "curbside",
    label: "Curbside",
    blurb: "We bring it to your car",
  },
  {
    id: "delivery",
    label: "Delivery",
    blurb: "Delivered to your address",
  },
];

function OnlineOrderingPage() {
  const [ready, setReady] = useState(false);
  const menuItems = usePosStore((s) => s.menuItems);
  const categories = usePosStore((s) => s.categories);
  const cart = usePlatformStore((s) => s.onlineCart);
  const add = usePlatformStore((s) => s.addToOnlineCart);
  const place = usePlatformStore((s) => s.placeOnlineOrder);
  const guestName = usePlatformStore((s) => s.onlineGuestName);
  const setGuestName = usePlatformStore((s) => s.setOnlineGuestName);
  const promo = usePlatformStore((s) => s.onlinePromo);
  const setPromo = usePlatformStore((s) => s.setOnlinePromo);
  const settings = usePlatformStore((s) => s.fulfillmentSettings);
  const loc =
    usePlatformStore(
      (s) =>
        s.locations.find((l) => l.id === s.activeLocationId) ??
        s.locations[0] ??
        null,
    );
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [type, setType] = useState<OnlineOrderType>("order_ahead");
  const [catId, setCatId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [fireMode, setFireMode] = useState<KitchenFireMode | "">("");
  const [delayMin, setDelayMin] = useState(String(settings.defaultDelayMinutes));
  const [claimLookup, setClaimLookup] = useState("");

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

  useEffect(() => {
    setDelayMin(String(settings.defaultDelayMinutes));
  }, [settings.defaultDelayMinutes]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-muted-foreground">
        Loading menu…
      </div>
    );
  }

  const items = menuItems.filter(
    (e) =>
      e.available && e.online !== false && (!catId || e.categoryId === catId),
  );
  const total = cart.reduce((s, i) => s + i.unitPriceCents * i.qty, 0);

  const fireHelp =
    type === "order_ahead"
      ? "Kitchen holds until you check in at your table (or after a delay you choose)."
      : type === "curbside"
        ? "Kitchen can hold until you arrive / text that you're in the lot."
        : type === "takeout"
          ? "To-go can fire immediately or wait until you arrive."
          : "Delivery typically fires when accepted.";

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="border-b border-border bg-surface px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Order online</h1>
            <p className="truncate text-xs text-muted-foreground">
              {loc?.name ?? "Zest"} · ahead · pickup · curbside · delivery
            </p>
          </div>
          <div className="flex shrink-0 gap-3 text-xs">
            <Link
              to="/table/$label"
              params={{ label: "12" }}
              className="text-primary underline-offset-2 hover:underline"
            >
              Table QR demo
            </Link>
            <Link
              to="/"
              className="text-muted-foreground underline-offset-2 hover:underline"
            >
              Staff POS
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl gap-4 p-4 min-w-0 lg:grid-cols-[1fr_20rem]">
        <section className="min-w-0">
          {/* Already ordered? */}
          <div className="mb-4 rounded-2xl border border-border bg-surface p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Already ordered ahead?
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Claim code or order #"
                value={claimLookup}
                onChange={(e) => setClaimLookup(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const o = usePlatformStore
                    .getState()
                    .findOrderByClaim(claimLookup);
                  if (o) {
                    void navigate({
                      to: "/order/$orderId",
                      params: { orderId: o.id },
                    });
                  } else setStatus("Order not found — check code");
                }}
              >
                Check in
              </Button>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPE_OPTS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                className={`rounded-xl border p-2.5 text-left transition ${
                  type === opt.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <p className="text-xs font-semibold">{opt.label}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {opt.blurb}
                </p>
              </button>
            ))}
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">{fireHelp}</p>

          <div className="mb-3 flex max-w-full gap-1 overflow-x-auto pb-1">
            <Button
              size="sm"
              variant={catId ? "outline" : "default"}
              onClick={() => setCatId(null)}
            >
              All
            </Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={catId === c.id ? "default" : "outline"}
                onClick={() => setCatId(c.id)}
                className="shrink-0"
              >
                {c.name}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
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
                className="rounded-xl border border-border bg-surface p-3 text-left hover:border-border-strong"
              >
                <p className="text-sm font-medium">{item.name}</p>
                <p className="mt-1 text-sm tabular text-muted-foreground">
                  {formatCurrency(item.priceCents)}
                </p>
              </button>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium">Your order</p>
          <Badge variant="info" className="mb-2 capitalize">
            {type.replaceAll("_", " ")}
          </Badge>
          <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto text-sm">
            {cart.map((line, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {line.qty}× {line.name}
                </span>
                <span className="tabular">
                  {formatCurrency(line.unitPriceCents * line.qty)}
                </span>
              </li>
            ))}
            {cart.length === 0 && (
              <li className="text-muted-foreground">Cart empty</li>
            )}
          </ul>
          <Input
            className="mb-2"
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
          />
          <Input
            className="mb-2"
            placeholder="Mobile phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {type === "curbside" && (
            <>
              <Input
                className="mb-2"
                placeholder="Vehicle (e.g. Honda CR-V)"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
              />
              <Input
                className="mb-2"
                placeholder="Color"
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
              />
            </>
          )}
          {settings.allowGuestChooseFireMode &&
            ["order_ahead", "takeout", "curbside"].includes(type) && (
              <div className="mb-2 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  When should kitchen start?
                </p>
                <select
                  className="w-full rounded-md border border-border bg-bg px-2 py-2 text-xs"
                  value={fireMode}
                  onChange={(e) =>
                    setFireMode(e.target.value as KitchenFireMode | "")
                  }
                >
                  <option value="">Use restaurant default</option>
                  <option value="on_arrival">Wait until I arrive</option>
                  <option value="delay_after_order">
                    Delay after I order
                  </option>
                  <option value="delay_after_arrival">
                    Delay after I arrive
                  </option>
                  <option value="immediate">Start ASAP</option>
                </select>
                {(fireMode === "delay_after_order" ||
                  fireMode === "delay_after_arrival" ||
                  (!fireMode &&
                    settings.defaultFireModeOrderAhead.includes("delay"))) && (
                  <Input
                    type="number"
                    className="h-9"
                    placeholder="Delay minutes"
                    value={delayMin}
                    onChange={(e) => setDelayMin(e.target.value)}
                  />
                )}
              </div>
            )}
          <Input
            className="mb-2"
            placeholder="Promo code (try WELCOME10)"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
          />
          <p className="mb-3 text-lg font-semibold tabular">
            {formatCurrency(total)}
          </p>
          <Button
            className="w-full"
            disabled={!cart.length}
            onClick={() => {
              const res = place({
                guestName,
                type,
                channel: type === "curbside" ? "app" : "web",
                promoCode: promo,
                guestPhone: phone || undefined,
                address:
                  type === "delivery" ? "Guest delivery address" : undefined,
                kitchenFireMode: fireMode || undefined,
                delayMinutes: parseInt(delayMin, 10) || undefined,
                vehicleDescription: vehicle || undefined,
                vehicleColor: vehicleColor || undefined,
              });
              if (res.ok && res.orderId) {
                setStatus(
                  `Order #${res.number} · claim ${res.claimCode}`,
                );
                void navigate({
                  to: "/order/$orderId",
                  params: { orderId: res.orderId },
                });
              } else {
                setStatus(res.error ?? "Failed");
              }
            }}
          >
            Place order
          </Button>
          {status && (
            <p className="mt-2 text-xs text-success" role="status">
              {status}
            </p>
          )}
          <p className="mt-3 text-[10px] leading-snug text-muted-foreground">
            Table QR: scan the code on your table or open{" "}
            <code className="text-foreground">/table/12</code> to order for that
            seat. Order-ahead guests check in with their claim code when seated.
          </p>
        </aside>
      </main>
    </div>
  );
}
