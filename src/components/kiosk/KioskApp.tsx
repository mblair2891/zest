import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { ClipboardList, DoorOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SummexMark } from "@/components/brand/SummexMark";
import { usePosStore } from "@/lib/pos/store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { printedItemPriceCents } from "@/lib/pos/calculations";
import { formatCurrency } from "@/lib/utils";
import { parsePaymentMethods, payConfigForProcessor } from "@/lib/pos/payment-methods";
import {
  bookReservationFn,
  checkInReservationFn,
  getKioskSnapshotFn,
  joinWaitlistFn,
} from "@/lib/front/api";
import type { FrontSettings, KioskMode, WaitEstimate } from "@/lib/front/types";
import { WAITLIST_REASON_LABEL } from "@/lib/front/types";
import { useNotifyStore } from "@/lib/pos/notify-store";
import { cn } from "@/lib/utils";
import { getDemoType, isProspectDemo, parseDemoType } from "@/lib/demo/session";
import { useDemoDeviceStore } from "@/lib/demo/device-session";
import { DemoDeviceSwitcher } from "@/components/demo/DemoDeviceSwitcher";
import { HelpButton } from "@/components/help/HelpPanel";
import { LoginOnboardingHost } from "@/components/onboarding/LoginOnboardingHost";
import { NetworkBanner, NetworkWatcher } from "@/components/pos/NetworkStatus";
import { useDemoLiveSync } from "@/lib/demo/live-sync";
import { useNetworkStore } from "@/lib/pos/network-store";
import { guestMayAddItem, isServerlessFood } from "@/lib/pos/serverless-food";
import type { MenuItem, SelectedModifier } from "@/lib/pos/types";

type Pane = "home" | "order" | "waitlist" | "checkin" | "book";

function locationIdFromPage(): string {
  if (typeof window === "undefined") return "loc_kiosk";
  const q = new URLSearchParams(window.location.search).get("loc");
  if (q) return q;
  return usePosStore.getState().tenantLocationId || "loc_kiosk";
}

function kioskSignals() {
  const s = usePosStore.getState();
  const openKitchenTickets = s.tickets.filter(
    (t) => t.station === "kitchen" && t.status !== "bumped",
  ).length;
  const openTables = s.tables.filter((t) => t.status === "available").length;
  const occupiedTables = s.tables.filter((t) => t.status !== "available").length;
  return { openKitchenTickets, openTables, occupiedTables };
}

export function KioskApp() {
  useDemoLiveSync();
  const demoEntered = useDemoDeviceStore((s) => s.entered);
  const demoType = getDemoType();
  const [ready, setReady] = useState(false);
  const [pane, setPane] = useState<Pane>("home");
  const [settings, setSettings] = useState<FrontSettings | null>(null);
  const [estimate, setEstimate] = useState<WaitEstimate | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loc = useMemo(() => locationIdFromPage(), []);

  const refresh = async () => {
    try {
      const snap = await getKioskSnapshotFn({
        data: { locationId: loc, ...kioskSignals() },
      });
      setSettings(snap.settings);
      setEstimate(snap.estimate);
      setWaitingCount(snap.waitingCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kiosk is not ready");
    }
  };

  useEffect(() => {
    let left = 2;
    const finish = () => {
      left -= 1;
      if (left <= 0) setReady(true);
    };
    const u1 = usePosStore.persist.onFinishHydration(finish);
    const u2 = usePlatformStore.persist.onFinishHydration(finish);
    void usePosStore.persist.rehydrate();
    void usePlatformStore.persist.rehydrate();
    if (usePosStore.persist.hasHydrated()) finish();
    if (usePlatformStore.persist.hasHydrated()) finish();
    const t = window.setTimeout(() => setReady(true), 1500);
    return () => {
      u1();
      u2();
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const onPane = (e: Event) => {
      const next = (e as CustomEvent).detail as Pane;
      if (
        next === "home" ||
        next === "order" ||
        next === "waitlist" ||
        next === "checkin" ||
        next === "book"
      ) {
        setPane(next);
      }
    };
    window.addEventListener("summex:kiosk-pane", onPane);
    return () => window.removeEventListener("summex:kiosk-pane", onPane);
  }, []);

  useEffect(() => {
    if (!ready) return;
    void refresh();
    const t = window.setInterval(() => void refresh(), 45_000);
    return () => window.clearInterval(t);
  }, [ready, loc]);

  const posSettings = usePosStore((s) => s.settings);
  const serverless = isServerlessFood(posSettings.serviceStyle);
  const mode: KioskMode = serverless ? "order" : (settings?.kioskMode ?? "combined");
  const waitOn = serverless ? false : !!settings?.waitlistEnabled;

  useEffect(() => {
    if (!settings) return;
    if (mode === "order") setPane("order");
    else if (mode === "checkin") setPane("home");
  }, [settings?.kioskMode, mode]);

  const demoVenue = parseDemoType(demoType ?? undefined);
  if (isProspectDemo() && !demoEntered && demoVenue) {
    return <Navigate to="/demo/$type" params={{ type: demoVenue }} />;
  }

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-muted-foreground">
        Starting kiosk…
      </div>
    );
  }

  const house = usePosStore.getState().settings.name || "Summex";

  return (
    <div
      data-demo="kiosk-home"
      data-kiosk-lock={serverless ? "serverless" : undefined}
      className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)] text-foreground"
    >
      {isProspectDemo() && demoEntered ? <LoginOnboardingHost /> : null}
      <NetworkWatcher />
      <NetworkBanner />
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <SummexMark className="h-9 w-9 text-foreground" />
          <div>
            <p className="text-xl font-semibold leading-tight">{house}</p>
            <p className="text-xs text-muted-foreground">Guest kiosk</p>
          </div>
        </div>
        {isProspectDemo() && demoEntered ? (
          <div className="flex items-center gap-2">
            <HelpButton surface="kiosk" />
            <DemoDeviceSwitcher />
          </div>
        ) : serverless ? null : (
          <Link
            to="/login"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Staff
          </Link>
        )}
      </header>

      {mode === "combined" && !serverless && (
        <nav className="grid grid-cols-3 gap-px border-b border-border bg-border">
          <KioskTab
            active={pane === "order"}
            onClick={() => setPane("order")}
            icon={ClipboardList}
            label="Order"
            demo="kiosk-order"
          />
          <KioskTab
            active={pane === "checkin" || pane === "book"}
            onClick={() => setPane("checkin")}
            icon={DoorOpen}
            label="Check in"
            demo="kiosk-checkin"
          />
          <KioskTab
            active={pane === "waitlist" || pane === "home"}
            onClick={() => setPane(waitOn ? "waitlist" : "home")}
            icon={Users}
            label="Waitlist"
            demo="kiosk-waitlist"
          />
        </nav>
      )}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
        {error && (
          <p className="mb-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {!serverless &&
          (pane === "home" || (mode === "checkin" && pane !== "checkin" && pane !== "book")) &&
          mode !== "order" && (
            <HomePane
              waitOn={waitOn}
              estimate={estimate}
              reason={settings?.waitlistReason ?? null}
              waitingCount={waitingCount}
              onWaitlist={() => setPane("waitlist")}
              onCheckin={() => setPane("checkin")}
              onBook={() => setPane("book")}
              onOrder={() => setPane("order")}
              showOrder={mode === "combined"}
            />
          )}
        {(pane === "order" || serverless) && <OrderPane />}
        {!serverless && pane === "waitlist" && waitOn && (
          <WaitlistPane
            loc={loc}
            estimate={estimate}
            reason={settings?.waitlistReason ?? null}
            onDone={() => {
              void refresh();
              setPane("home");
            }}
          />
        )}
        {!serverless && pane === "checkin" && (
          <CheckInPane
            loc={loc}
            onBack={() => setPane("home")}
          />
        )}
        {!serverless && pane === "book" && (
          <BookPane loc={loc} onBack={() => setPane("checkin")} />
        )}
      </main>
    </div>
  );
}

function KioskTab({
  active,
  onClick,
  icon: Icon,
  label,
  demo,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
  demo?: string;
}) {
  return (
    <button
      type="button"
      data-demo={demo}
      onClick={onClick}
      className={cn(
        "flex min-h-16 items-center justify-center gap-2 bg-surface text-base font-semibold",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function HomePane({
  waitOn,
  estimate,
  reason,
  waitingCount,
  onWaitlist,
  onCheckin,
  onBook,
  onOrder,
  showOrder,
}: {
  waitOn: boolean;
  estimate: WaitEstimate | null;
  reason: FrontSettings["waitlistReason"];
  waitingCount: number;
  onWaitlist: () => void;
  onCheckin: () => void;
  onBook: () => void;
  onOrder: () => void;
  showOrder: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      {waitOn && (
        <div className="rounded-3xl border border-border bg-surface px-6 py-10 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Estimated wait
          </p>
          <p className="mt-3 font-display text-5xl font-medium tracking-tight sm:text-6xl">
            {estimate?.label ?? "a short wait"}
          </p>
          {reason && (
            <p className="mt-3 text-sm text-muted-foreground">
              {WAITLIST_REASON_LABEL[reason]}
              {waitingCount > 0 ? ` · ${waitingCount} ahead` : ""}
            </p>
          )}
          <Button
            className="mt-8 h-20 w-full text-xl"
            onClick={onWaitlist}
          >
            Add me to waitlist
          </Button>
        </div>
      )}
      <Button className="h-16 w-full text-lg" variant="outline" onClick={onCheckin}>
        Reservation check-in
      </Button>
      <Button className="h-14 w-full text-base" variant="ghost" onClick={onBook}>
        Book a table
      </Button>
      {showOrder && (
        <Button className="h-14 w-full text-base" variant="ghost" onClick={onOrder}>
          Order
        </Button>
      )}
    </div>
  );
}

function OrderPane() {
  const menuItems = usePosStore((s) => s.menuItems);
  const modifierGroups = usePosStore((s) => s.modifierGroups);
  const vendors = usePosStore((s) => s.vendors);
  const settings = usePosStore((s) => s.settings);
  const openKioskOrder = usePosStore((s) => s.openKioskOrder);
  const cart = usePlatformStore((s) => s.onlineCart);
  const add = usePlatformStore((s) => s.addToOnlineCart);
  const place = usePlatformStore((s) => s.placeOnlineOrder);
  const clear = usePlatformStore((s) => s.clearOnlineCart);
  const [done, setDone] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [draft, setDraft] = useState<MenuItem | null>(null);
  const [picks, setPicks] = useState<SelectedModifier[]>([]);
  const [localCart, setLocalCart] = useState<
    { menuItemId: string; name: string; unitPriceCents: number; qty: number; modifiers?: SelectedModifier[] }[]
  >([]);
  const serverless = isServerlessFood(settings.serviceStyle);
  const payCfg = payConfigForProcessor(parsePaymentMethods(settings.paymentMethods), settings.cardProcessor);
  const kioskTenders = (
    [
      payCfg.card ? "card" : null,
      payCfg.cash ? "cash" : null,
      payCfg.giftCard ? "gift_card" : null,
    ] as const
  ).filter((m): m is "card" | "cash" | "gift_card" => Boolean(m));
  const [kioskMethod, setKioskMethod] = useState<"card" | "cash" | "gift_card">(
    kioskTenders[0] ?? "card",
  );
  const shownCart = serverless ? localCart : cart;
  const total = shownCart.reduce((s, i) => s + i.unitPriceCents * i.qty, 0);
  const addFood = (item: MenuItem, modifiers?: SelectedModifier[]) => {
    setLocalCart((prev) => {
      const key = `${item.id}:${(modifiers ?? []).map((m) => m.optionId).join(",")}`;
      const hit = prev.find((l) => `${l.menuItemId}:${(l.modifiers ?? []).map((m) => m.optionId).join(",")}` === key);
      if (hit) {
        return prev.map((l) =>
          l === hit ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      const extra = (modifiers ?? []).reduce((s, m) => s + m.priceCents, 0);
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          unitPriceCents: item.priceCents + extra,
          qty: 1,
          modifiers,
        },
      ];
    });
  };
  const items = menuItems.filter((e) => {
    if (!e.available) return false;
    if (!serverless) return true;
    const vendor = e.vendorId ? vendors.find((v) => v.id === e.vendorId) : undefined;
    return guestMayAddItem(
      { station: e.station, taxCategory: e.taxCategory, vendorStation: vendor?.stationType },
      settings,
    );
  }).slice(0, 24);
  const activeKiosk = kioskTenders.includes(kioskMethod)
    ? kioskMethod
    : (kioskTenders[0] ?? "card");
  const payLabel =
    activeKiosk === "cash"
      ? "Send — pay cash at pickup"
      : activeKiosk === "gift_card"
        ? "Pay with gift & send"
        : "Pay with card & send";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              const groups = modifierGroups.filter((g) => item.modifierGroupIds?.includes(g.id));
              if (serverless && groups.length) {
                setDraft(item);
                setPicks([]);
                return;
              }
              if (serverless) {
                addFood(item);
                return;
              }
              add({
                menuItemId: item.id,
                name: item.name,
                unitPriceCents: item.priceCents,
              });
            }}
            className="min-h-28 rounded-2xl border-2 border-border bg-surface p-4 text-left text-lg font-medium active:scale-[0.98]"
          >
            {item.name}
            <span className="mt-2 block text-base tabular text-muted-foreground">
              {(() => {
                const dual = printedItemPriceCents(item.priceCents, settings);
                if (dual.showBoth && payCfg.cash && payCfg.card) {
                  return `${formatCurrency(dual.cash)} cash · ${formatCurrency(dual.card)} card`;
                }
                return formatCurrency(payCfg.card && !payCfg.cash ? dual.card : dual.cash);
              })()}
            </span>
          </button>
        ))}
      </div>
      <aside className="h-fit rounded-2xl border border-border bg-surface p-5">
        {serverless && (
          <div className="mb-4 grid gap-2" data-kiosk-guest="">
            <Input
              data-kiosk-name=""
              placeholder="Name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
            <Input
              data-kiosk-phone=""
              placeholder="Phone"
              inputMode="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
            />
          </div>
        )}
        {draft && serverless && (
          <div className="mb-4 grid gap-2" data-kiosk-modifiers="">
            <p className="text-sm font-medium">{draft.name}</p>
            {modifierGroups
              .filter((g) => draft.modifierGroupIds?.includes(g.id))
              .map((g) => (
                <div key={g.id} className="grid gap-1">
                  <p className="text-xs text-muted-foreground">{g.name}</p>
                  {g.options.map((opt) => (
                    <Button
                      key={opt.id}
                      type="button"
                      size="sm"
                      variant={picks.some((p) => p.optionId === opt.id) ? "default" : "outline"}
                      onClick={() =>
                        setPicks((prev) => [
                          ...prev.filter((p) => p.groupId !== g.id),
                          {
                            groupId: g.id,
                            groupName: g.name,
                            optionId: opt.id,
                            optionName: opt.name,
                            priceCents: opt.priceCents,
                          },
                        ])
                      }
                    >
                      {opt.name}
                    </Button>
                  ))}
                </div>
              ))}
            <Button
              type="button"
              onClick={() => {
                addFood(draft, picks);
                setDraft(null);
                setPicks([]);
              }}
            >
              Add {draft.name}
            </Button>
          </div>
        )}
        <p className="mb-3 text-lg font-semibold">Cart</p>
        <ul className="mb-4 max-h-64 space-y-2 overflow-y-auto text-sm">
          {shownCart.map((line, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {line.qty}× {line.name}
              </span>
              <span className="tabular">
                {formatCurrency(line.unitPriceCents * line.qty)}
              </span>
            </li>
          ))}
          {!shownCart.length && <li className="text-muted-foreground">Tap items to add</li>}
        </ul>
        <p className="mb-4 text-2xl font-semibold tabular">{formatCurrency(total)}</p>
        {kioskTenders.length > 1 && (
          <div className="mb-3 grid gap-2">
            {kioskTenders.map((m) => (
              <Button
                key={m}
                size="lg"
                className="h-14 w-full text-base"
                variant={activeKiosk === m ? "default" : "outline"}
                onClick={() => setKioskMethod(m)}
              >
                {m === "card" ? "Card" : m === "cash" ? "Cash at counter" : "Gift"}
              </Button>
            ))}
          </div>
        )}
        <Button
          className="mb-2 h-14 w-full text-base"
          data-kiosk-pay=""
          disabled={!shownCart.length}
          onClick={() => {
            if (serverless) {
              const res = openKioskOrder({
                name: guestName,
                phone: guestPhone,
                tender: activeKiosk,
                lines: localCart.map((l) => ({
                  menuItemId: l.menuItemId,
                  qty: l.qty,
                  modifiers: l.modifiers,
                })),
              });
              if (!res.ok) {
                setDone(res.error ?? "Could not send");
                return;
              }
              setLocalCart([]);
              setGuestName("");
              setGuestPhone("");
              setDone(
                res.number
                  ? `${res.number} · ${
                      activeKiosk === "cash"
                        ? "pay cash at the counter"
                        : "pickup when we text you"
                    }`
                  : "Order placed",
              );
              return;
            }
            const lines = cart.map((l) => ({ ...l }));
            const res = place({
              guestName: "Kiosk guest",
              type: "takeout",
              channel: "kiosk",
            });
            if (isProspectDemo()) {
              const pos = usePosStore.getState();
              pos.openTakeout("Kiosk guest");
              for (const line of lines) {
                for (let n = 0; n < line.qty; n += 1) pos.addItem(line.menuItemId);
              }
              pos.sendOrder();
            }
            if (res.ok || isProspectDemo()) {
              setDone(
                activeKiosk === "cash"
                  ? "Order placed — pay cash at pickup"
                  : "Order placed — pickup when ready",
              );
            }
          }}
        >
          {payLabel}
        </Button>
        <Button
          className="h-12 w-full"
          variant="outline"
          onClick={() => {
            clear();
            setLocalCart([]);
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
    </div>
  );
}

function WaitlistPane({
  loc,
  estimate,
  reason,
  onDone,
}: {
  loc: string;
  estimate: WaitEstimate | null;
  reason: FrontSettings["waitlistReason"];
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState("2");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = useNetworkStore.getState().wanOnline()
        ? await joinWaitlistFn({
            data: {
              locationId: loc,
              name,
              phone,
              partySize: Number(party) || 2,
              ...kioskSignals(),
            },
          }).catch(() => null)
        : null;
      const quoted = r?.entry.quotedMinutes ?? estimate?.minutes ?? 15;
      usePosStore.getState().addWaitlist({
        name,
        partySize: Number(party) || 2,
        phone,
        quotedMinutes: quoted,
        status: "waiting",
        smsStatus: r ? "sent" : "pending",
      });
      useNotifyStore.getState().pushNotice({
        kind: "waitlist_update",
        title: "Waitlist",
        body: `${name} · ${party} joined the waitlist`,
      });
      if (r) {
        setMsg(
          r.provider === "blocked"
            ? `You're on the list. ${r.estimateLabel}. A text was not sent (SMS off or this location is at its monthly cap). Ask the host.`
            : `You're on the list. ${r.estimateLabel}. A text was ${r.provider === "sandbox" ? "logged (sandbox)" : "sent"} with a remove link.`,
        );
      } else {
        setMsg(
          "You're on the list. SMS is pending send until internet returns. Staff see you on Host stand.",
        );
      }
      window.setTimeout(onDone, 3200);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <p className="text-center font-display text-4xl font-medium">
        {estimate?.label ?? "Join the waitlist"}
      </p>
      {reason && (
        <p className="text-center text-sm text-muted-foreground">
          {WAITLIST_REASON_LABEL[reason]}
        </p>
      )}
      <Input
        className="h-14 text-lg"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        className="h-14 text-lg"
        placeholder="Mobile number"
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <Input
        className="h-14 text-lg"
        placeholder="Party size"
        inputMode="numeric"
        value={party}
        onChange={(e) => setParty(e.target.value)}
      />
      <Button className="h-16 w-full text-lg" disabled={busy} onClick={() => void submit()}>
        {busy ? "Adding…" : "Add me to waitlist"}
      </Button>
      {msg && <p className="text-center text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}

function CheckInPane({ loc, onBack }: { loc: string; onBack: () => void }) {
  const [last, setLast] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await checkInReservationFn({
        data: { locationId: loc, lastName: last, code },
      });
      useNotifyStore.getState().pushNotice({
        kind: "guest_checked_in",
        title: "Guest checked in",
        body: r.notice,
      });
      setMsg(r.notice);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <p className="text-center font-display text-3xl font-medium">Check in</p>
      <p className="text-center text-sm text-muted-foreground">
        Last name and the code from your text or email.
      </p>
      <Input
        className="h-14 text-lg"
        placeholder="Last name"
        value={last}
        onChange={(e) => setLast(e.target.value)}
        autoCapitalize="words"
      />
      <Input
        className="h-14 text-lg tracking-[0.3em] uppercase"
        placeholder="CODE"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      <Button className="h-16 w-full text-lg" disabled={busy} onClick={() => void submit()}>
        {busy ? "Checking…" : "Check in"}
      </Button>
      <Button className="h-12 w-full" variant="ghost" onClick={onBack}>
        Back
      </Button>
      {msg && <p className="text-center text-sm">{msg}</p>}
      <p className="text-center text-[11px] text-muted-foreground">
        Demo: last name Blair · code K7M2
      </p>
    </div>
  );
}

function BookPane({ loc, onBack }: { loc: string; onBack: () => void }) {
  const [name, setName] = useState("");
  const [party, setParty] = useState("2");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await bookReservationFn({
        data: {
          locationId: loc,
          name,
          partySize: Number(party) || 2,
          at: new Date(when).toISOString(),
          phone: phone || undefined,
          email: email || undefined,
        },
      });
      setMsg(`Booked. Check-in code ${r.checkInCode} was sent if you left a phone or email.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not book");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      <p className="text-center font-display text-3xl font-medium">Book a table</p>
      <Input className="h-12" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input className="h-12" placeholder="Party size" value={party} onChange={(e) => setParty(e.target.value)} />
      <Input className="h-12" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      <Input className="h-12" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Input className="h-12" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button className="h-14 w-full" disabled={busy} onClick={() => void submit()}>
        {busy ? "Booking…" : "Confirm"}
      </Button>
      <Button className="h-12 w-full" variant="ghost" onClick={onBack}>
        Back
      </Button>
      {msg && <p className="text-center text-sm">{msg}</p>}
    </div>
  );
}
