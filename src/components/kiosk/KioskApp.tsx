import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardList, DoorOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SummexMark } from "@/components/brand/SummexMark";
import { usePosStore } from "@/lib/pos/store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { formatCurrency } from "@/lib/utils";
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
    if (!ready) return;
    void refresh();
    const t = window.setInterval(() => void refresh(), 45_000);
    return () => window.clearInterval(t);
  }, [ready, loc]);

  const mode: KioskMode = settings?.kioskMode ?? "combined";
  const waitOn = !!settings?.waitlistEnabled;

  useEffect(() => {
    if (!settings) return;
    if (mode === "order") setPane("order");
    else if (mode === "checkin") setPane("home");
  }, [settings?.kioskMode]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-muted-foreground">
        Starting kiosk…
      </div>
    );
  }

  const house = usePosStore.getState().settings.name || "Summex";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <SummexMark className="h-9 w-9 text-foreground" />
          <div>
            <p className="text-xl font-semibold leading-tight">{house}</p>
            <p className="text-xs text-muted-foreground">Guest kiosk</p>
          </div>
        </div>
        <Link
          to="/"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Staff
        </Link>
      </header>

      {mode === "combined" && (
        <nav className="grid grid-cols-3 gap-px border-b border-border bg-border">
          <KioskTab
            active={pane === "order"}
            onClick={() => setPane("order")}
            icon={ClipboardList}
            label="Order"
          />
          <KioskTab
            active={pane === "checkin" || pane === "book"}
            onClick={() => setPane("checkin")}
            icon={DoorOpen}
            label="Check in"
          />
          <KioskTab
            active={pane === "waitlist" || pane === "home"}
            onClick={() => setPane(waitOn ? "waitlist" : "home")}
            icon={Users}
            label="Waitlist"
          />
        </nav>
      )}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
        {error && (
          <p className="mb-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {(pane === "home" || (mode === "checkin" && pane !== "checkin" && pane !== "book")) &&
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
        {pane === "order" && <OrderPane />}
        {pane === "waitlist" && waitOn && (
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
        {pane === "checkin" && (
          <CheckInPane
            loc={loc}
            onBack={() => setPane("home")}
          />
        )}
        {pane === "book" && (
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
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
}) {
  return (
    <button
      type="button"
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
  const cart = usePlatformStore((s) => s.onlineCart);
  const add = usePlatformStore((s) => s.addToOnlineCart);
  const place = usePlatformStore((s) => s.placeOnlineOrder);
  const clear = usePlatformStore((s) => s.clearOnlineCart);
  const [done, setDone] = useState<string | null>(null);
  const items = menuItems.filter((e) => e.available).slice(0, 12);
  const total = cart.reduce((s, i) => s + i.unitPriceCents * i.qty, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="grid grid-cols-2 gap-3">
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
          {!cart.length && <li className="text-muted-foreground">Tap items to add</li>}
        </ul>
        <p className="mb-4 text-2xl font-semibold tabular">{formatCurrency(total)}</p>
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
      const r = await joinWaitlistFn({
        data: {
          locationId: loc,
          name,
          phone,
          partySize: Number(party) || 2,
          ...kioskSignals(),
        },
      });
      useNotifyStore.getState().pushNotice({
        kind: "waitlist_update",
        title: "Waitlist",
        body: `${r.entry.name} · ${r.entry.partySize} joined the waitlist`,
      });
      setMsg(
        `You're on the list. ${r.estimateLabel}. A text was ${r.provider === "sandbox" ? "logged (sandbox)" : "sent"} with a remove link.`,
      );
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
