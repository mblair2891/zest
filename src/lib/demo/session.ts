import type { StateStorage } from "zustand/middleware";
import type { VenueEntityId } from "@/lib/pos/types";
import { isVenueEntityId } from "@/lib/pos/entities";

export const DEMO_SESSION_KEY = "summex-demo-type";
export const DEMO_PREFIX = "summex-demo-persist:";

export function getDemoType(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(DEMO_SESSION_KEY);
  } catch {
    return null;
  }
}

export function isProspectDemo(): boolean {
  return Boolean(getDemoType());
}

export function enterDemoSession(type: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, type);
  } catch {
    /* ignore */
  }
}

export function exitDemoSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAllDemoPersist(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith(DEMO_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

function demoKey(name: string): string {
  const t = getDemoType();
  return t ? `${DEMO_PREFIX}${t}:${name}` : name;
}

/** Zustand persist adapter: demo sessions never write tenant POS/SaaS keys. */
export function demoPersistStorage(): StateStorage {
  const mem = new Map<string, string>();
  return {
    getItem: (name) => {
      if (typeof window === "undefined") return mem.get(name) ?? null;
      try {
        return localStorage.getItem(demoKey(name));
      } catch {
        return mem.get(name) ?? null;
      }
    },
    setItem: (name, value) => {
      if (typeof window === "undefined") {
        mem.set(name, value);
        return;
      }
      try {
        localStorage.setItem(demoKey(name), value);
      } catch {
        mem.set(name, value);
      }
    },
    removeItem: (name) => {
      if (typeof window === "undefined") {
        mem.delete(name);
        return;
      }
      try {
        localStorage.removeItem(demoKey(name));
      } catch {
        mem.delete(name);
      }
    },
  };
}

export function parseDemoType(raw: string | undefined): VenueEntityId | null {
  if (!raw) return null;
  return isVenueEntityId(raw) ? raw : null;
}
