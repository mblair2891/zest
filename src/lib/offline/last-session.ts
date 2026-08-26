const KEY = "summex-last-session-user";

export type CachedSessionUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
};

export function saveLastSessionUser(user: CachedSessionUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!user) {
      localStorage.removeItem(KEY);
      return;
    }
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function readLastSessionUser(): CachedSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as CachedSessionUser;
    if (!v || typeof v.id !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

export function networkLooksOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}
