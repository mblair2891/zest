import { useEffect, useState } from "react";
import { Wifi, WifiOff, CloudOff, Router } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useNetworkStore,
  worksWithoutInternet,
  waitsForInternet,
  OUTBOX_KIND_LABEL,
} from "@/lib/pos/network-store";
import { formatTime } from "@/lib/utils";
import { usePosStore } from "@/lib/pos/store";

export function NetworkWatcher() {
  const setBrowserOnline = useNetworkStore((s) => s.setBrowserOnline);
  const wanOnline = useNetworkStore((s) => s.wanOnline);
  const flushOutbox = useNetworkStore((s) => s.flushOutbox);
  const pingPeers = useNetworkStore((s) => s.pingPeers);

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
    const id = window.setInterval(() => {
      if (wanOnline()) flushOutbox();
      pingPeers();
    }, 8000);
    return () => window.clearInterval(id);
  }, [wanOnline, flushOutbox, pingPeers]);

  return null;
}

export function NetworkChip() {
  const [open, setOpen] = useState(false);
  const wan = useNetworkStore((s) => s.wanOnline());
  const lan = useNetworkStore((s) => s.lanOnline());
  const pending = useNetworkStore((s) => s.pendingCount());
  const policy = useNetworkStore((s) => s.policy);

  const label = !lan
    ? "No WiFi"
    : !wan
      ? pending
        ? `WiFi · ${pending} queued`
        : "WiFi · no internet"
      : policy === "wifi_only"
        ? "WiFi"
        : "Online";

  return (
    <>
      <button
        type="button"
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
  const ssid = useNetworkStore((s) => s.houseSsid);
  const setView = usePosStore((s) => s.setView);

  if (lan && wan) return null;

  if (!lan) {
    return (
      <div className="border-b border-danger/40 bg-danger/15 px-3 py-1.5 text-center text-[11px] text-danger">
        House WiFi is down. This terminal still has its local checks. Other
        stations cannot sync until the access point is back.
      </div>
    );
  }

  return (
    <div className="border-b border-warn/40 bg-warn/15 px-3 py-1.5 text-center text-[11px] text-warn-foreground">
      <span className="text-foreground">
        Internet is out · <strong>{ssid}</strong> is still up. Floor, KDS, and
        cash keep running.
        {pending > 0 ? ` ${pending} cloud items queued.` : ""}
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
  const outbox = useNetworkStore((s) => s.outbox);
  const peers = useNetworkStore((s) => s.peers);
  const lastSyncAt = useNetworkStore((s) => s.lastSyncAt);
  const simulateWan = useNetworkStore((s) => s.simulateWanDown);
  const setSimulateWan = useNetworkStore((s) => s.setSimulateWanDown);
  const flush = useNetworkStore((s) => s.flushOutbox);

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
            <p className="text-sm font-semibold">House WiFi</p>
            <p className="text-xs text-muted-foreground">
              {policy === "wifi_only"
                ? "WiFi only — no wired POS drops required"
                : policy === "wifi_preferred"
                  ? "WiFi first, Ethernet optional"
                  : "Wired allowed"}
              {" · "}
              {role === "hub" ? "This device is the hub" : "Satellite"}
            </p>
          </div>
          <Badge variant={wan ? "success" : lan ? "secondary" : "danger"}>
            {wan ? "Internet" : lan ? "LAN only" : "Isolated"}
          </Badge>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          Staff devices stay on <strong className="text-foreground">{ssid}</strong>
          {isolated ? ` · guests on ${guest}` : ""}. If the ISP dies, the
          access point still bridges tablets, KDS, and printers. Checks live on
          the hub until the cloud is back.
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
              Waits for internet
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
            />
            Simulate internet outage
          </label>
          {pending > 0 && wan && (
            <Button size="sm" variant="outline" onClick={() => flush()}>
              Sync {pending} now
            </Button>
          )}
        </div>

        {outbox.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cloud queue
              {lastSyncAt ? ` · last sync ${formatTime(lastSyncAt)}` : ""}
            </p>
            <ul className="max-h-36 space-y-1 overflow-y-auto">
              {outbox.slice(0, 8).map((o) => (
                <li
                  key={o.id}
                  className="flex justify-between gap-2 text-[11px]"
                >
                  <span>
                    {OUTBOX_KIND_LABEL[o.kind]} · {o.label}
                  </span>
                  <span
                    className={
                      o.status === "queued" ? "text-warn" : "text-success"
                    }
                  >
                    {o.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
