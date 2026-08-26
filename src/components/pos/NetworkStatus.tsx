import { useEffect, useState } from "react";
import { Wifi, WifiOff, CloudOff, Router } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useNetworkStore,
  worksWithoutInternet,
  waitsForInternet,
  OUTBOX_KIND_LABEL,
  startLanPeerWatch,
} from "@/lib/pos/network-store";
import { formatTime } from "@/lib/utils";
import { usePosStore } from "@/lib/pos/store";
import { persistLocationSnapshot } from "@/lib/offline/location-snapshot";

async function pingHealth(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    const r = await fetch("/api/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return false;
    const j = (await r.json()) as { ok?: boolean };
    return j.ok === true;
  } catch {
    return false;
  }
}

export function NetworkWatcher() {
  const setBrowserOnline = useNetworkStore((s) => s.setBrowserOnline);
  const setHealthOk = useNetworkStore((s) => s.setHealthOk);
  const simulateWan = useNetworkStore((s) => s.simulateWanDown);
  const wanOnline = useNetworkStore((s) => s.wanOnline);
  const flushOutboxNow = useNetworkStore((s) => s.flushOutboxNow);
  const pingPeers = useNetworkStore((s) => s.pingPeers);
  const hydrateOutbox = useNetworkStore((s) => s.hydrateOutbox);
  const rememberSnapshot = useNetworkStore((s) => s.rememberSnapshot);
  const menuN = usePosStore((s) => s.menuItems.length);
  const tableN = usePosStore((s) => s.tables.length);
  const staffN = usePosStore((s) => s.employees.length);
  const locName = usePosStore((s) => s.settings.name);
  const ticketN = usePosStore((s) => s.tickets.length);
  const orderN = usePosStore((s) => s.orders.length);

  useEffect(() => {
    const u = useNetworkStore.persist.onFinishHydration(() => undefined);
    void useNetworkStore.persist.rehydrate();
    void hydrateOutbox();
    return () => u();
  }, [hydrateOutbox]);

  useEffect(() => startLanPeerWatch(), []);

  useEffect(() => {
    const apply = () => setBrowserOnline(navigator.onLine);
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, [setBrowserOnline]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (simulateWan) {
        setHealthOk(false);
        persistLocationSnapshot();
        return;
      }
      const ok = await pingHealth();
      if (cancelled) return;
      setHealthOk(ok);
      if (ok && wanOnline()) {
        const n = await flushOutboxNow();
        if (n > 0) {
          /* flushed */
        }
        rememberSnapshot({
          name: locName,
          menuItemCount: menuN,
          tableCount: tableN,
          staffCount: staffN,
        });
        persistLocationSnapshot();
      } else {
        persistLocationSnapshot();
      }
      pingPeers();
    };
    void tick();
    const id = window.setInterval(() => void tick(), 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    simulateWan,
    setHealthOk,
    wanOnline,
    flushOutboxNow,
    pingPeers,
    rememberSnapshot,
    locName,
    menuN,
    tableN,
    staffN,
    ticketN,
    orderN,
  ]);

  useEffect(() => {
    const onOnline = () => {
      void pingHealth().then((ok) => {
        setHealthOk(ok);
        if (ok) void flushOutboxNow();
      });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [setHealthOk, flushOutboxNow]);

  return null;
}

export function NetworkChip() {
  const [open, setOpen] = useState(false);
  const wan = useNetworkStore((s) => s.wanOnline());
  const lan = useNetworkStore((s) => s.lanOnline());
  const pending = useNetworkStore((s) => s.pendingCount());
  const syncing = useNetworkStore((s) => s.syncing);
  const policy = useNetworkStore((s) => s.policy);

  const label = !lan
    ? "No WiFi"
    : !wan
      ? pending
        ? `Offline · ${pending} queued`
        : "Offline"
      : syncing
        ? "Syncing…"
        : policy === "wifi_only"
          ? "WiFi"
          : "Online";

  return (
    <>
      <button
        type="button"
        data-demo="network-chip"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 min-w-9 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        aria-label="House network"
        title="House WiFi & offline"
      >
        {!lan ? (
          <WifiOff className="h-4 w-4 text-danger" />
        ) : !wan ? (
          <CloudOff className="h-4 w-4 text-warn" />
        ) : (
          <Wifi className="h-4 w-4 text-success" />
        )}
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && <NetworkSheet onClose={() => setOpen(false)} />}
    </>
  );
}

export function NetworkBanner() {
  const wan = useNetworkStore((s) => s.wanOnline());
  const lan = useNetworkStore((s) => s.lanOnline());
  const pending = useNetworkStore((s) => s.pendingCount());
  const dead = useNetworkStore((s) => s.deadCount());
  const syncing = useNetworkStore((s) => s.syncing);
  const healthOk = useNetworkStore((s) => s.healthOk);
  const browserOnline = useNetworkStore((s) => s.browserOnline);
  const ssid = useNetworkStore((s) => s.houseSsid);
  const setView = usePosStore((s) => s.setView);

  if (lan && wan && !syncing && dead === 0) return null;

  if (syncing && wan) {
    return (
      <div
        data-demo="network-banner"
        className="border-b border-primary/30 bg-primary/10 px-3 py-1.5 text-center text-[11px] text-foreground"
      >
        Syncing… queued changes are applying once. Cash checks will not double-capture.
      </div>
    );
  }

  if (dead > 0) {
    return (
      <div
        data-demo="network-banner"
        className="border-b border-danger/40 bg-danger/15 px-3 py-1.5 text-center text-[11px] text-danger"
      >
        Sync failed — {dead} item{dead === 1 ? "" : "s"} need a manager. Open Network to retry
        or clear. Cash on this station is still good.
        {" "}
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => setView("settings")}
        >
          Network
        </button>
      </div>
    );
  }

  if (!lan) {
    return (
      <div
        data-demo="network-banner"
        className="border-b border-danger/40 bg-danger/15 px-3 py-1.5 text-center text-[11px] text-danger"
      >
        House Wi‑Fi is down. This terminal still has its local checks. Other
        stations cannot sync until the access point is back.
      </div>
    );
  }

  const localOnly = !browserOnline || !healthOk;
  return (
    <div
      data-demo="network-banner"
      className="border-b border-warn/40 bg-warn/15 px-3 py-1.5 text-center text-[11px] text-warn-foreground"
    >
      <span className="text-foreground">
        Offline — changes will sync when back online.
        {" "}
        <strong>{ssid}</strong> still runs floor, ODS, and cash.
        {localOnly && !healthOk && browserOnline
          ? " Local app heartbeat missed (no house hub / API)."
          : " No internet uplink."}
        {pending > 0 ? ` ${pending} items queued.` : ""}
      </span>{" "}
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={() => setView("settings")}
      >
        Network
      </button>
    </div>
  );
}

function NetworkSheet({ onClose }: { onClose: () => void }) {
  const wan = useNetworkStore((s) => s.wanOnline());
  const lan = useNetworkStore((s) => s.lanOnline());
  const policy = useNetworkStore((s) => s.policy);
  const ssid = useNetworkStore((s) => s.houseSsid);
  const guest = useNetworkStore((s) => s.guestSsid);
  const isolated = useNetworkStore((s) => s.isolatedGuest);
  const role = useNetworkStore((s) => s.deviceRole);
  const pending = useNetworkStore((s) => s.pendingCount());
  const dead = useNetworkStore((s) => s.deadCount());
  const outbox = useNetworkStore((s) => s.outbox);
  const peers = useNetworkStore((s) => s.peers);
  const lastSyncAt = useNetworkStore((s) => s.lastSyncAt);
  const simulateWan = useNetworkStore((s) => s.simulateWanDown);
  const setSimulateWan = useNetworkStore((s) => s.setSimulateWanDown);
  const flush = useNetworkStore((s) => s.flushOutboxNow);
  const syncing = useNetworkStore((s) => s.syncing);
  const healthOk = useNetworkStore((s) => s.healthOk);
  const browserOnline = useNetworkStore((s) => s.browserOnline);

  const deadItems = outbox.filter((o) => o.status === "dead");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70"
        aria-label="Close network"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-surface p-4 shadow-lg sm:rounded-3xl">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Router className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">House Wi‑Fi</p>
            <p className="text-xs text-muted-foreground">
              {policy === "wifi_only"
                ? "Wi‑Fi only — no wired POS drops required"
                : policy === "wifi_preferred"
                  ? "Wi‑Fi first, Ethernet optional"
                  : "Wired allowed"}
              {" · "}
              {role === "hub" ? "This device is the hub" : "Satellite"}
            </p>
          </div>
          <Badge variant={wan ? "success" : lan ? "secondary" : "danger"}>
            {syncing ? "Syncing" : wan ? "Internet" : lan ? "LAN only" : "Isolated"}
          </Badge>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          Staff stay on <strong className="text-foreground">{ssid}</strong>
          {isolated ? ` · guests on ${guest}` : ""}. Internet is the uplink.
          No internet: cash, tickets, and seats still run on this device
          {lan ? " and on-LAN peers" : ""}. No house hub / API heartbeat
          {healthOk ? " is OK" : " is missing"}
          {browserOnline ? "" : " · browser reports offline"}.
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-bg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Still works
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-foreground">
              {worksWithoutInternet()
                .slice(0, 3)
                .map((w) => (
                  <li key={w}>{w}</li>
                ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-bg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Needs internet
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-foreground">
              {waitsForInternet()
                .slice(0, 3)
                .map((w) => (
                  <li key={w}>{w}</li>
                ))}
            </ul>
          </div>
        </div>

        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          On {ssid}
        </p>
        <ul className="mb-3 space-y-1">
          {peers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg px-1 text-xs"
            >
              <span>
                {p.name}
                <span className="ml-1 text-muted-foreground">{p.kind}</span>
              </span>
              <span className="text-muted-foreground">
                {lan ? formatTime(p.lastSeenAt) : "unreachable"}
              </span>
            </li>
          ))}
        </ul>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={simulateWan}
              onChange={(e) => setSimulateWan(e.target.checked)}
              className="h-4 w-4 rounded border-border"
              data-demo="simulate-offline"
            />
            Simulate internet outage
          </label>
          {pending > 0 && wan && (
            <Button size="sm" variant="outline" onClick={() => void flush()} disabled={syncing}>
              {syncing ? "Syncing…" : `Sync ${pending} now`}
            </Button>
          )}
        </div>

        {outbox.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Outbox
              {lastSyncAt ? ` · last sync ${formatTime(lastSyncAt)}` : ""}
            </p>
            <ul className="max-h-36 space-y-1 overflow-y-auto">
              {outbox.slice(0, 10).map((o) => (
                <li key={o.id} className="flex justify-between gap-2 text-[11px]">
                  <span>
                    {OUTBOX_KIND_LABEL[o.kind]} · {o.label}
                  </span>
                  <span
                    className={
                      o.status === "queued" || o.status === "syncing"
                        ? "text-warn"
                        : o.status === "dead"
                          ? "text-danger"
                          : "text-success"
                    }
                  >
                    {o.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {deadItems.length > 0 && (
          <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3">
            <p className="text-xs font-semibold text-danger">Failed to sync ({dead})</p>
            <ul className="mt-1 space-y-1 text-[11px] text-foreground">
              {deadItems.slice(0, 6).map((o) => (
                <li key={o.id}>
                  {o.label}
                  {o.lastError ? ` — ${o.lastError}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Manager: retry after the uplink is stable, or re-enter the check. Cash closes never drop.
            </p>
          </div>
        )}

        <Button className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
