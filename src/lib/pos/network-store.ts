import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";

export type FabricPolicy = "wifi_only" | "wifi_preferred" | "wired_ok";
export type DeviceRole = "hub" | "satellite";
export type OutboxKind =
  | "card_capture"
  | "online_order_pull"
  | "gift_cloud"
  | "loyalty"
  | "payout"
  | "menu_publish"
  | "receipt_email";

export interface LanPeer {
  id: string;
  name: string;
  kind: "pos" | "kds" | "printer" | "terminal" | "kiosk" | "handheld";
  lastSeenAt: number;
}

export interface OutboxItem {
  id: string;
  at: number;
  kind: OutboxKind;
  label: string;
  detail: string;
  status: "queued" | "sent";
  amountCents?: number;
}

export const OUTBOX_KIND_LABEL: Record<OutboxKind, string> = {
  card_capture: "Card capture",
  online_order_pull: "Online order pull",
  gift_cloud: "Gift / stored value",
  loyalty: "Loyalty",
  payout: "Vendor payout",
  menu_publish: "Menu publish",
  receipt_email: "Email receipt",
};

function seedPeers(now: number): LanPeer[] {
  return [
    { id: "peer_hub", name: "Counter 1 · hub", kind: "pos", lastSeenAt: now },
    {
      id: "peer_hh",
      name: "Handheld · Jordan",
      kind: "handheld",
      lastSeenAt: now - 8_000,
    },
    { id: "peer_kds", name: "Kitchen KDS", kind: "kds", lastSeenAt: now - 3_000 },
    {
      id: "peer_print",
      name: "Bar printer",
      kind: "printer",
      lastSeenAt: now - 12_000,
    },
    {
      id: "peer_term",
      name: "Stripe reader",
      kind: "terminal",
      lastSeenAt: now - 5_000,
    },
  ];
}

interface NetworkState {
  policy: FabricPolicy;
  deviceRole: DeviceRole;
  houseSsid: string;
  guestSsid: string;
  isolatedGuest: boolean;
  /** Real browser WAN, before the demo override */
  browserOnline: boolean;
  simulateWanDown: boolean;
  simulateLanDown: boolean;
  lastWanAt: number;
  lastSyncAt: number | null;
  outbox: OutboxItem[];
  peers: LanPeer[];

  wanOnline: () => boolean;
  lanOnline: () => boolean;
  /** House can still run: local store + WiFi between devices */
  houseAlive: () => boolean;
  pendingCount: () => number;

  setPolicy: (p: FabricPolicy) => void;
  setDeviceRole: (r: DeviceRole) => void;
  setSsids: (house: string, guest: string) => void;
  setIsolatedGuest: (on: boolean) => void;
  setBrowserOnline: (on: boolean) => void;
  setSimulateWanDown: (on: boolean) => void;
  setSimulateLanDown: (on: boolean) => void;
  enqueue: (item: Omit<OutboxItem, "id" | "at" | "status">) => void;
  flushOutbox: () => number;
  pingPeers: () => void;
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      policy: "wifi_only",
      deviceRole: "hub",
      houseSsid: "Summex-House",
      guestSsid: "Summex-Guest",
      isolatedGuest: true,
      browserOnline: true,
      simulateWanDown: false,
      simulateLanDown: false,
      lastWanAt: Date.now(),
      lastSyncAt: Date.now(),
      outbox: [],
      peers: seedPeers(Date.now()),

      wanOnline: () =>
        get().browserOnline && !get().simulateWanDown,
      lanOnline: () => !get().simulateLanDown,
      houseAlive: () => get().lanOnline() || get().deviceRole === "hub",
      pendingCount: () =>
        get().outbox.filter((o) => o.status === "queued").length,

      setPolicy: (policy) => set({ policy }),
      setDeviceRole: (deviceRole) => set({ deviceRole }),
      setSsids: (houseSsid, guestSsid) => set({ houseSsid, guestSsid }),
      setIsolatedGuest: (isolatedGuest) => set({ isolatedGuest }),
      setBrowserOnline: (browserOnline) =>
        set({
          browserOnline,
          lastWanAt: browserOnline ? Date.now() : get().lastWanAt,
        }),
      setSimulateWanDown: (simulateWanDown) => {
        const wasDown = !get().wanOnline();
        set({ simulateWanDown });
        if (wasDown && get().wanOnline()) {
          get().flushOutbox();
        }
      },
      setSimulateLanDown: (simulateLanDown) => set({ simulateLanDown }),

      enqueue: (item) =>
        set({
          outbox: [
            {
              ...item,
              id: uid("ob"),
              at: Date.now(),
              status: "queued" as const,
            },
            ...get().outbox,
          ].slice(0, 80),
        }),

      flushOutbox: () => {
        const pending = get().outbox.filter((o) => o.status === "queued");
        if (!get().wanOnline() || pending.length === 0) return 0;
        set({
          outbox: get().outbox.map((o) =>
            o.status === "queued" ? { ...o, status: "sent" } : o,
          ),
          lastSyncAt: Date.now(),
        });
        return pending.length;
      },

      pingPeers: () => {
        if (!get().lanOnline()) return;
        const now = Date.now();
        set({
          peers: get().peers.map((p) => ({
            ...p,
            lastSeenAt: now - Math.floor(Math.random() * 12_000),
          })),
        });
      },
    }),
    {
      name: "summex-net-v1",
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
    "Handhelds and KDS talking to the house hub over WiFi",
    "Clock in/out and section assignments",
  ];
}

export function waitsForInternet(): string[] {
  return [
    "Card captures settle with the processor",
    "New online / marketplace orders",
    "Cloud gift and loyalty balance checks",
    "Email / SMS receipts and campaigns",
    "Vendor payouts and SaaS billing",
  ];
}
