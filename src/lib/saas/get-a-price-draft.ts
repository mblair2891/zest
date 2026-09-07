/** Get a Price draft: session-only, same-tab refresh OK, overnight / from-home is empty. */

export const GET_A_PRICE_DRAFT_KEY = "getAPrice.draft";
export const PROSPECT_TOKEN_KEY = "summex-prospect-token";
export const GET_A_PRICE_STORAGE_KEYS = [GET_A_PRICE_DRAFT_KEY, PROSPECT_TOKEN_KEY] as const;
export const GET_A_PRICE_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export type GetAPriceDraft = {
  savedAt: string;
  token?: string;
  step?: number;
  phase?: "interview" | "form";
  prefilled?: boolean;
  interviewText?: string;
  data?: unknown;
};

let currentObservedPath =
  typeof window !== "undefined" ? normalizePath(window.location.pathname) : "";
let previousObservedPath = currentObservedPath;

export function noteGetAPricePath(pathname: string): void {
  const next = normalizePath(pathname);
  if (next !== currentObservedPath) {
    previousObservedPath = currentObservedPath;
    currentObservedPath = next;
  }
}

/** Path before the latest Get a Price enter. Used to detect homepage → Get a Price. */
export function peekGetAPricePath(): string {
  return previousObservedPath;
}

export function normalizePath(path: string): string {
  const p = (path || "/").split("?")[0].split("#")[0];
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p || "/";
}

export function isGetAPricePath(path: string): boolean {
  return normalizePath(path) === "/get-pricing";
}

export function isSameLocalDay(savedAt: string, now: Date = new Date()): boolean {
  const t = new Date(savedAt);
  if (Number.isNaN(t.getTime())) return false;
  return (
    t.getFullYear() === now.getFullYear() &&
    t.getMonth() === now.getMonth() &&
    t.getDate() === now.getDate()
  );
}

export function isDraftStale(savedAt: string, now: Date = new Date()): boolean {
  const t = new Date(savedAt);
  if (Number.isNaN(t.getTime())) return true;
  if (!isSameLocalDay(savedAt, now)) return true;
  return now.getTime() - t.getTime() > GET_A_PRICE_MAX_AGE_MS;
}

/**
 * True when this visit is a new enter from home or any other page.
 * A reload of Get a Price is not "from outside".
 */
export function arrivedFromOutsideGetAPrice(input: {
  previousPathname?: string;
  currentPathname?: string;
  referrer?: string;
  origin?: string;
  navigationType?: string;
}): boolean {
  const current = normalizePath(input.currentPathname || "/get-pricing");
  if (input.navigationType === "reload" && isGetAPricePath(current)) return false;

  const prev = normalizePath(input.previousPathname || "");
  if (prev && !isGetAPricePath(prev)) return true;

  const origin = input.origin || "";
  const referrer = input.referrer || "";
  if (referrer && origin) {
    try {
      const u = new URL(referrer);
      if (u.origin === origin) {
        const refPath = normalizePath(u.pathname);
        if (!isGetAPricePath(refPath)) return true;
      }
    } catch {
      /* ignore bad referrer */
    }
  }
  return false;
}

export function parseGetAPriceDraft(raw: string | null | undefined): GetAPriceDraft | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    const savedAt = typeof rec.savedAt === "string" ? rec.savedAt : "";
    if (!savedAt) return null;
    return {
      savedAt,
      token: typeof rec.token === "string" ? rec.token : undefined,
      step: typeof rec.step === "number" ? rec.step : undefined,
      phase: rec.phase === "form" || rec.phase === "interview" ? rec.phase : undefined,
      prefilled: typeof rec.prefilled === "boolean" ? rec.prefilled : undefined,
      interviewText: typeof rec.interviewText === "string" ? rec.interviewText : undefined,
      data: rec.data,
    };
  } catch {
    return null;
  }
}

export function decideGetAPriceLoad(input: {
  draft: GetAPriceDraft | null;
  previousPathname?: string;
  currentPathname?: string;
  referrer?: string;
  origin?: string;
  navigationType?: string;
  now?: Date;
}): { action: "empty" | "restore"; reason: string } {
  const fromOutside = arrivedFromOutsideGetAPrice(input);
  if (fromOutside) return { action: "empty", reason: "from_outside" };
  if (!input.draft) return { action: "empty", reason: "no_draft" };
  if (isDraftStale(input.draft.savedAt, input.now ?? new Date())) {
    return { action: "empty", reason: "stale" };
  }
  return { action: "restore", reason: "ok" };
}

function eachStore(fn: (store: Storage) => void): void {
  if (typeof window === "undefined") return;
  try {
    fn(sessionStorage);
  } catch {
    /* private mode */
  }
  try {
    fn(localStorage);
  } catch {
    /* private mode */
  }
}

export function clearGetAPriceStorage(): void {
  eachStore((store) => {
    for (const key of GET_A_PRICE_STORAGE_KEYS) {
      store.removeItem(key);
    }
  });
}

export function readGetAPriceDraft(): GetAPriceDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const fromSession = parseGetAPriceDraft(sessionStorage.getItem(GET_A_PRICE_DRAFT_KEY));
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  // Never restore a long-lived localStorage draft. Drop leftovers.
  try {
    localStorage.removeItem(GET_A_PRICE_DRAFT_KEY);
    localStorage.removeItem(PROSPECT_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  return null;
}

export function writeGetAPriceDraft(draft: Omit<GetAPriceDraft, "savedAt"> & { savedAt?: string }): void {
  if (typeof window === "undefined") return;
  const payload: GetAPriceDraft = {
    ...draft,
    savedAt: draft.savedAt ?? new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(GET_A_PRICE_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(GET_A_PRICE_DRAFT_KEY);
    localStorage.removeItem(PROSPECT_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function navigationType(): string {
  if (typeof performance === "undefined") return "";
  const entries = performance.getEntriesByType("navigation");
  const nav = entries[0] as PerformanceNavigationTiming | undefined;
  return nav?.type ?? "";
}

export function stripGetAPriceTokenFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("t")) return;
    url.searchParams.delete("t");
    window.history.replaceState({}, "", url.toString());
  } catch {
    /* ignore */
  }
}

export function putGetAPriceTokenInUrl(token: string): void {
  if (typeof window === "undefined" || !token) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("t", token);
    window.history.replaceState({}, "", url.toString());
  } catch {
    /* ignore */
  }
}
