import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import {
  INTEGRATION_CATALOG,
  RETIRED_PAYMENT_PROVIDERS,
  SUMMEX_PAYMENTS_ID,
  defaultConnections,
  migrateConnections,
  type ConnectedIntegration,
  type IntegrationCategory,
  type IntegrationDef,
  type IntegrationLog,
  type IntegrationStatus,
} from "./integrations-catalog";

interface IntegrationsState {
  connections: ConnectedIntegration[];
  logs: IntegrationLog[];
  webhookUrl: string;
  apiKeys: { id: string; name: string; prefix: string; createdAt: number }[];

  getDef: (id: string) => IntegrationDef | undefined;
  getConnection: (defId: string) => ConnectedIntegration | undefined;
  isConnected: (defId: string) => boolean;
  connect: (defId: string, config?: Record<string, string>) => void;
  disconnect: (defId: string) => void;
  sync: (defId: string) => { ok: boolean; message: string };
  syncAll: () => number;
  setConfig: (defId: string, config: Record<string, string>) => void;
  setWebhookUrl: (url: string) => void;
  createApiKey: (name: string) => string;
  revokeApiKey: (id: string) => void;
  log: (
    defId: string,
    level: IntegrationLog["level"],
    message: string,
  ) => void;
  connectedByCategory: () => Record<string, number>;
  catalog: () => IntegrationDef[];
  filterCatalog: (
    q: string,
    category: IntegrationCategory | "all" | "connected",
  ) => IntegrationDef[];
}

export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set, get) => ({
      connections: defaultConnections(),
      logs: [
        {
          id: uid("log"),
          at: Date.now() - 60000,
          defId: SUMMEX_PAYMENTS_ID,
          level: "success",
          message: "Summex Payments settled 42 card captures · next-day deposit queued",
        },
        {
          id: uid("log"),
          at: Date.now() - 120000,
          defId: "doordash",
          level: "info",
          message: "Pulled 3 marketplace orders",
        },
        {
          id: uid("log"),
          at: Date.now() - 300000,
          defId: "quickbooks",
          level: "success",
          message: "Posted daily sales journal",
        },
      ],
      webhookUrl: "https://hooks.example.com/summex/pos",
      apiKeys: [
        {
          id: "key_demo",
          name: "Demo partner key",
          prefix: "summex_live_****demo",
          createdAt: Date.now() - 86400000 * 30,
        },
      ],

      catalog: () => INTEGRATION_CATALOG,

      getDef: (id) => INTEGRATION_CATALOG.find((d) => d.id === id),

      getConnection: (defId) =>
        get().connections.find((c) => c.defId === defId),

      isConnected: (defId) => {
        const c = get().getConnection(defId);
        return !!c && c.status === "connected";
      },

      connect: (defId, config = {}) => {
        if ((RETIRED_PAYMENT_PROVIDERS as readonly string[]).includes(defId)) return;
        const def = get().getDef(defId);
        if (!def) return;
        const existing = get().getConnection(defId);
        const next: ConnectedIntegration = {
          defId,
          status: "connected",
          connectedAt: Date.now(),
          lastSyncAt: Date.now(),
          config: { ...existing?.config, ...config },
          eventsSynced: existing?.eventsSynced ?? 0,
        };
        set({
          connections: [
            next,
            ...get().connections.filter((c) => c.defId !== defId),
          ],
        });
        get().log(defId, "success", `Connected ${def.name} (${def.authType})`);
      },

      disconnect: (defId) => {
        const def = get().getDef(defId);
        if (def?.platformOwned) {
          get().log(
            defId,
            "warn",
            `${def.name} is built into Summex and cannot be disconnected`,
          );
          return;
        }
        set({
          connections: get().connections.filter((c) => c.defId !== defId),
        });
        if (def) get().log(defId, "warn", `Disconnected ${def.name}`);
      },

      sync: (defId) => {
        const def = get().getDef(defId);
        const conn = get().getConnection(defId);
        if (!def || !conn || conn.status !== "connected") {
          return { ok: false, message: "Not connected" };
        }
        const fail = Math.random() < 0.05;
        if (fail) {
          set({
            connections: get().connections.map((c) =>
              c.defId === defId
                ? {
                    ...c,
                    status: "error" as IntegrationStatus,
                    lastError: "Upstream timeout",
                  }
                : c,
            ),
          });
          get().log(defId, "error", `${def.name} sync failed: upstream timeout`);
          return { ok: false, message: "Upstream timeout" };
        }
        const events = 1 + Math.floor(Math.random() * 40);
        set({
          connections: get().connections.map((c) =>
            c.defId === defId
              ? {
                  ...c,
                  status: "connected",
                  lastSyncAt: Date.now(),
                  lastError: undefined,
                  eventsSynced: c.eventsSynced + events,
                }
              : c,
          ),
        });
        get().log(
          defId,
          "success",
          `Synced ${events} events with ${def.name}`,
        );
        return { ok: true, message: `Synced ${events} events` };
      },

      syncAll: () => {
        let n = 0;
        for (const c of get().connections) {
          if (c.status === "connected") {
            get().sync(c.defId);
            n++;
          }
        }
        return n;
      },

      setConfig: (defId, config) => {
        set({
          connections: get().connections.map((c) =>
            c.defId === defId ? { ...c, config: { ...c.config, ...config } } : c,
          ),
        });
      },

      setWebhookUrl: (url) => set({ webhookUrl: url }),

      createApiKey: (name) => {
        const secret = `summex_live_${Math.random().toString(36).slice(2, 10)}`;
        set({
          apiKeys: [
            {
              id: uid("key"),
              name,
              prefix: secret.slice(0, 12) + "****",
              createdAt: Date.now(),
            },
            ...get().apiKeys,
          ],
        });
        get().log("public_api", "info", `Created API key “${name}”`);
        return secret;
      },

      revokeApiKey: (id) => {
        set({ apiKeys: get().apiKeys.filter((k) => k.id !== id) });
      },

      log: (defId, level, message) => {
        set({
          logs: [
            {
              id: uid("log"),
              at: Date.now(),
              defId,
              level,
              message,
            },
            ...get().logs,
          ].slice(0, 200),
        });
      },

      connectedByCategory: () => {
        const map: Record<string, number> = {};
        for (const c of get().connections) {
          if (c.status !== "connected") continue;
          const def = get().getDef(c.defId);
          if (!def) continue;
          map[def.category] = (map[def.category] ?? 0) + 1;
        }
        return map;
      },

      filterCatalog: (q, category) => {
        const query = q.trim().toLowerCase();
        const retired = new Set<string>(RETIRED_PAYMENT_PROVIDERS);
        return INTEGRATION_CATALOG.filter((d) => {
          if (retired.has(d.id)) return false;
          if (category === "connected" && !get().isConnected(d.id)) return false;
          if (
            category !== "all" &&
            category !== "connected" &&
            d.category !== category
          )
            return false;
          if (!query) return true;
          return (
            d.name.toLowerCase().includes(query) ||
            d.vendor.toLowerCase().includes(query) ||
            d.description.toLowerCase().includes(query) ||
            d.features.some((f) => f.toLowerCase().includes(query))
          );
        });
      },
    }),
    {
      name: "summex-integrations-v4",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<IntegrationsState>;
        return {
          ...current,
          ...p,
          connections: migrateConnections(
            p.connections ?? current.connections,
          ),
        };
      },
    },
  ),
);
