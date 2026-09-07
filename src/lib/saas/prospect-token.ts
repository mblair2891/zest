import {
  PROSPECT_TOKEN_KEY,
  clearGetAPriceStorage,
  readGetAPriceDraft,
} from "./get-a-price-draft";

/** Session-only. Do not use localStorage — overnight Get a Price must start empty. */
export function readProspectToken(): string | null {
  try {
    const fromDraft = readGetAPriceDraft()?.token;
    if (fromDraft) return fromDraft;
  } catch {
    /* ignore */
  }
  try {
    const fromSession = sessionStorage.getItem(PROSPECT_TOKEN_KEY);
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(PROSPECT_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  return null;
}

export function writeProspectToken(token: string): void {
  try {
    sessionStorage.setItem(PROSPECT_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(PROSPECT_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function clearProspectToken(): void {
  clearGetAPriceStorage();
}

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}
