/**
 * Pair QR / code payload for Summex Station.
 * Leaf module (no value imports) so node:test can load it.
 */

export const PAIR_TTL_MS = 24 * 60 * 60 * 1000;

export type PairDeviceRole = "order" | "ods" | "host" | "kiosk";

export type StationPairPayload = {
  token: string;
  venue?: string;
  role?: PairDeviceRole;
};

function asRole(raw: string | null | undefined): PairDeviceRole | undefined {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (s === "order" || s === "cashier" || s === "bar_pos" || s === "handheld") return "order";
  if (s === "ods" || s === "kitchen" || s === "bar" || s === "kds" || s === "expo") return "ods";
  if (s === "host" || s === "floor" || s === "waitlist" || s === "host_stand") return "host";
  if (s === "kiosk") return "kiosk";
  return undefined;
}

export function normalizePairToken(raw: string): string {
  return String(raw || "")
    .replace(/[\s-]/g, "")
    .toUpperCase()
    .slice(0, 12);
}

export function encodePairQuery(opts: {
  token: string;
  venue?: string;
  role?: PairDeviceRole;
}): string {
  const q = new URLSearchParams();
  q.set("pair", normalizePairToken(opts.token));
  if (opts.venue) q.set("loc", opts.venue);
  if (opts.role) q.set("station", opts.role);
  return `/station?${q.toString()}`;
}

/** Parse a scanned QR (URL, JSON, or bare code) into pair token + optional venue/role. */
export function parsePairScan(raw: string): StationPairPayload | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      const o = JSON.parse(s) as Record<string, unknown>;
      const token = normalizePairToken(String(o.token ?? o.pair ?? o.code ?? ""));
      if (token.length < 4) return null;
      const venue = String(o.venue ?? o.loc ?? o.locationId ?? "").trim();
      const role = asRole(String(o.role ?? o.station ?? ""));
      return { token, venue: venue || undefined, role };
    } catch {
      return null;
    }
  }
  try {
    const u = new URL(s.includes("://") ? s : `https://app.summex.app${s.startsWith("/") ? s : `/${s}`}`);
    const token = normalizePairToken(
      u.searchParams.get("pair") || u.searchParams.get("token") || u.searchParams.get("code") || "",
    );
    if (token.length >= 4) {
      const venue = (u.searchParams.get("loc") || u.searchParams.get("venue") || "").trim();
      const role = asRole(u.searchParams.get("station") || u.searchParams.get("role"));
      return { token, venue: venue || undefined, role };
    }
  } catch {
    /* not a URL */
  }
  const token = normalizePairToken(s);
  if (token.length >= 4 && /^[A-Z0-9]+$/.test(token)) return { token };
  return null;
}

export function claimExpired(expiresAt: number | null | undefined, now = Date.now()): boolean {
  if (!expiresAt || expiresAt <= 0) return false;
  return expiresAt <= now;
}

export function nextClaimExpiry(now = Date.now()): number {
  return now + PAIR_TTL_MS;
}

export function formatClaimExpiry(expiresAt: number | undefined, now = Date.now()): string {
  if (!expiresAt) return "";
  if (expiresAt <= now) return "Expired — regenerate";
  const mins = Math.max(1, Math.round((expiresAt - now) / 60_000));
  if (mins < 90) return `Expires in ${mins} min`;
  const hours = Math.round(mins / 60);
  return `Expires in ${hours}h`;
}
