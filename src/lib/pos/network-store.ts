import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import {
  MAX_ATTEMPTS,
  OUTBOX_KIND_LABEL,
  type OutboxItem,
  type OutboxKind,
} from "@/lib/offline/types";
import {
  idbClearLocation,
  idbGetOutbox,
  idbMark,
  idbPutOutbox,
  idbPutSnapshot,
} from "@/lib/offline/idb";
import { flushOfflineMutationsFn } from "@/lib/offline/api";
import { activeLocationId } from "@/lib/offline/scope";
import { lanBroadcastOps, lanHello, subscribeLanPeers } from "@/lib/offline/lan";

export type { OutboxItem, OutboxKind } from "@/lib/offline/types";
export { OUTBOX_KIND_LABEL } from "@/lib/offline/types";

export type FabricPolicy = "wifi_only" | "wifi_preferred" | "wired_ok";
export type DeviceRole = "hub" | "satellite";

export interface LanPeer {
  id: string;
  name: string;
  kind: "pos" | "kds" | "printer" | "terminal" | "kiosk" | "handheld";
  lastSeenAt: number;
}

function seedPeers(now: number): LanPeer[] {
  return [
    { id: "peer_hub", name: "Counter 1 · hub", kind: "pos", lastSeenAt: now },
    { id: "peer_hh", name: "Handheld · floor", kind: "handheld", lastSeenAt: now - 8_000 },
    { id: "peer_kds", name: "Kitchen ODS", kind: "kds", lastSeenAt: now - 3_000 },
    { id: "peer_print", name: "Bar printer", kind: "printer", lastSeenAt: now - 12_000 },
    { id: "peer_term", name: "Quantum reader", kind: "terminal", lastSeenAt: now - 5_000 },
  ];
}

interface NetworkState {
  policy: FabricPolicy;
  deviceRole: DeviceRole;
  houseSsid: string;
  guestSsid: string;
  isolatedGuest: boolean;
  browserOnline: boolean;
  healthOk: boolean;
  lastHealthAt: number | null;
  simulateWanDown: boolean;
  simulateLanDown: boolean;
  lastWanAt: number;
  lastSyncAt: number | null;
  syncing: boolean;
  outbox: OutboxItem[];
  peers: LanPeer[];

  wanOnline: () => boolean;
  lanOnline: () => boolean;
  houseAlive: () => boolean;
  pendingCount: () => number;
  deadCount: () => number;

  setPolicy: (p: FabricPolicy) => void;
  setDeviceRole: (r: DeviceRole) => void;
  setSsids: (house: string, guest: string) => void;
  setIsolatedGuest: (on: boolean) => void;
  setBrowserOnline: (on: boolean) => void;
  setHealthOk: (on: boolean) => void;
  setSimulateWanDown: (on: boolean) => void;
  setSimulateLanDown: (on: boolean) => void;
  enqueue: (
    item: Omit<OutboxItem, "id" | "at" | "status" | "clientMutationId" | "locationId" | "attempts" | "payload"> & {
      payload?: Record<string, unknown>;
      locationId?: string;
      clientMutationId?: string;
    },
  ) => string;
  hydrateOutbox: () => Promise<void>;
  flushOutbox: () => number;
  flushOutboxNow: () => Promise<number>;
  pingPeers: () => void;
  rememberSnapshot: (snap: { name: string; menuItemCount: number; tableCount: number; staffCount: number }) => void;
  clearLocationCache: (locationId?: string) => Promise<void>;
  noteLanPeer: (id: string, at: number) => void;
}

let flushInFlight: Promise<number> | null = null;

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      policy: "wifi_only",
      deviceRole: "hub",
      houseSsid: "Summex-House",
      guestSsid: "Summex-Guest",
      isolatedGuest: true,
      browserOnline: true,
      healthOk: true,
      lastHealthAt: Date.now(),
      simulateWanDown: false,
      simulateLanDown: false,
      lastWanAt: Date.now(),
      lastSyncAt: Date.now(),
      syncing: false,
      outbox: [],
      peers: seedPeers(Date.now()),

      wanOnline: () =>
        get().browserOnline && get().healthOk && !get().simulateWanDown,
      lanOnline: () => !get().simulateLanDown,
      houseAlive: () => get().lanOnline() || get().deviceRole === "hub",
      pendingCount: () =>
        get().outbox.filter((o) => o.status === "queued" || o.status === "syncing").length,
      deadCount: () => get().outbox.filter((o) => o.status === "dead").length,

      setPolicy: (policy) => set({ policy }),
      setDeviceRole: (deviceRole) => set({ deviceRole }),
      setSsids: (houseSsid, guestSsid) => set({ houseSsid, guestSsid }),
      setIsolatedGuest: (isolatedGuest) => set({ isolatedGuest }),
      setBrowserOnline: (browserOnline) =>
        set({
          browserOnline,
          lastWanAt: browserOnline ? Date.now() : get().lastWanAt,
        }),
      setHealthOk: (healthOk) =>
        set({
          healthOk,
          lastHealthAt: Date.now(),
          lastWanAt: healthOk ? Date.now() : get().lastWanAt,
        }),
      setSimulateWanDown: (simulateWanDown) => {
        const wasDown = !get().wanOnline();
        set({ simulateWanDown });
        if (wasDown && get().wanOnline()) {
          void get().flushOutboxNow();
        }
      },
      setSimulateLanDown: (simulateLanDown) => set({ simulateLanDown }),

      enqueue: (item) => {
        const locationId = item.locationId || activeLocationId();
        const clientMutationId = item.clientMutationId || uid("cm");
        const row: OutboxItem = {
          id: uid("ob"),
          clientMutationId,
          at: Date.now(),
          kind: item.kind,
          label: item.label,
          detail: item.detail,
          status: "queued",
          amountCents: item.amountCents,
          locationId,
          payload: item.payload ?? {},
          attempts: 0,
        };
        set({
          outbox: [row, ...get().outbox.filter((o) => o.clientMutationId !== clientMutationId)].slice(0, 120),
        });
        void idbPutOutbox(row);
        if (get().lanOnline()) lanBroadcastOps();
        return clientMutationId;
      },

      hydrateOutbox: async () => {
        try {
          const rows = await idbGetOutbox(activeLocationId());
          if (rows.length === 0) return;
          const byId = new Map(get().outbox.map((o) => [o.clientMutationId, o]));
          for (const r of rows) byId.set(r.clientMutationId, r);
          set({
            outbox: [...byId.values()].sort((a, b) => b.at - a.at).slice(0, 120),
          });
        } catch {
          /* private mode / no IDB */
        }
      },

      flushOutbox: () => {
        void get().flushOutboxNow();
        return get().pendingCount();
      },

      flushOutboxNow: async () => {
        if (flushInFlight) return flushInFlight;
        flushInFlight = (async () => {
          if (!get().wanOnline()) {
            set({ syncing: false });
            return 0;
          }
          const loc = activeLocationId();
          const now = Date.now();
          const pending = get()
            .outbox.filter(
              (o) =>
                (o.status === "queued" || o.status === "syncing") &&
                o.locationId === loc &&
                (o.nextAttemptAt ?? 0) <= now,
            )
            .sort((a, b) => a.at - b.at)
            .slice(0, 40);
          if (pending.length === 0) {
            set({ syncing: false });
            return 0;
          }
          set({
            syncing: true,
            outbox: get().outbox.map((o) =>
              pending.some((p) => p.clientMutationId === o.clientMutationId)
                ? { ...o, status: "syncing" as const }
                : o,
            ),
          });
          try {
            const { results } = await flushOfflineMutationsFn({
              data: {
                items: pending.map((p) => ({
                  clientMutationId: p.clientMutationId,
                  locationId: p.locationId,
                  kind: p.kind,
                  payload: p.payload,
                  label: p.label,
                })),
              },
            });
            const byId = new Map(results.map((r) => [r.clientMutationId, r]));
            const next = get().outbox.map((o) => {
              const r = byId.get(o.clientMutationId);
              if (!r) return o;
              if (r.status === "applied" || r.status === "duplicate") {
                void idbMark(o.clientMutationId, { status: "sent", lastError: undefined });
                return { ...o, status: "sent" as const, lastError: undefined };
              }
              if (r.status === "conflict") {
                void idbMark(o.clientMutationId, {
                  status: "dead",
                  lastError: r.error,
                  attempts: (o.attempts ?? 0) + 1,
                });
                return {
                  ...o,
                  status: "dead" as const,
                  lastError: r.error,
                  attempts: (o.attempts ?? 0) + 1,
                };
              }
              const attempts = (o.attempts ?? 0) + 1;
              const dead = attempts >= MAX_ATTEMPTS;
              const status = dead ? ("dead" as const) : ("queued" as const);
              const nextAttemptAt = now + Math.min(30_000, 2_000 * 2 ** Math.min(attempts, 4));
              void idbMark(o.clientMutationId, {
                status,
                attempts,
                lastError: r.error,
                nextAttemptAt,
              });
              return { ...o, status, attempts, lastError: r.error, nextAttemptAt };
            });
            set({ outbox: next, lastSyncAt: Date.now(), syncing: false });
            return pending.length;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "sync failed";
            const next = get().outbox.map((o) => {
              if (!pending.some((p) => p.clientMutationId === o.clientMutationId)) return o;
              const attempts = (o.attempts ?? 0) + 1;
              const dead = attempts >= MAX_ATTEMPTS;
              const status = dead ? ("dead" as const) : ("queued" as const);
              const nextAttemptAt = Date.now() + Math.min(30_000, 2_000 * 2 ** Math.min(attempts, 4));
              void idbMark(o.clientMutationId, { status, attempts, lastError: msg, nextAttemptAt });
              return { ...o, status, attempts, lastError: msg, nextAttemptAt };
            });
            set({ outbox: next, syncing: false });
            return 0;
          } finally {
            flushInFlight = null;
          }
        })();
        return flushInFlight;
      },

      pingPeers: () => {
        if (!get().lanOnline()) return;
        lanHello();
        const now = Date.now();
        set({
          peers: get().peers.map((p) =>
            p.id.startsWith("lan:")
              ? p
              : { ...p, lastSeenAt: now - Math.floor(Math.random() * 12_000) },
          ),
        });
      },

      rememberSnapshot: (snap) => {
        const locationId = activeLocationId();
        void idbPutSnapshot({
          locationId,
          savedAt: Date.now(),
          name: snap.name,
          menuItemCount: snap.menuItemCount,
          tableCount: snap.tableCount,
          staffCount: snap.staffCount,
        });
      },

      clearLocationCache: async (locationId) => {
        const loc = locationId || activeLocationId();
        await idbClearLocation(loc, { keepQueued: true });
      },

      noteLanPeer: (id, at) => {
        const key = `lan:${id}`;
        const peers = get().peers.filter((p) => p.id !== key);
        const peer: LanPeer = {
          id: key,
          name: `Station · ${id.slice(-4)}`,
          kind: "pos",
          lastSeenAt: at,
        };
        set({
          peers: [peer, ...peers].slice(0, 12),
        });
      },
    }),
    {
      name: "summex-net-v2",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        policy: s.policy,
        deviceRole: s.deviceRole,
        houseSsid: s.houseSsid,
        guestSsid: s.guestSsid,
        isolatedGuest: s.isolatedGuest,
        simulateWanDown: s.simulateWanDown,
        simulateLanDown: s.simulateLanDown,
        outbox: s.outbox,
        lastSyncAt: s.lastSyncAt,
      }),
    },
  ),
);

export function worksWithoutInternet(): string[] {
  return [
    "Open / close tables and enter orders",
    "Kitchen and bar tickets, bump, expo",
    "Cash, comps, house accounts, local gift cards",
    "Seat cached tables; waitlist queued locally (SMS pending)",
    "Handhelds and ODS on the same device, and on-LAN tabs when Wi‑Fi is up",
  ];
}

export function waitsForInternet(): string[] {
  return [
    "Card charges via Quantum Payments (need a live connection)",
    "SMS / email send",
    "Cloud reporting AI",
    "Marketplace / online order pull",
    "SaaS platform admin and billing",
  ];
}

export function enqueueMutation(
  kind: OutboxKind,
  label: string,
  detail: string,
  payload: Record<string, unknown> = {},
  extra?: { amountCents?: number },
): string {
  return useNetworkStore.getState().enqueue({
    kind,
    label,
    detail,
    payload,
    amountCents: extra?.amountCents,
  });
}

/** Wire LAN peer sightings once per app session. */
export function startLanPeerWatch(): () => void {
  return subscribeLanPeers((id, at) => {
    useNetworkStore.getState().noteLanPeer(id, at);
  });
}
