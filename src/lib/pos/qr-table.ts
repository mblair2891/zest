import { absoluteGuestHref } from "@/lib/platform/hosts";
import { venueAwareHref } from "@/lib/platform/venue-host";
import { readTenantPosContext } from "@/lib/saas/pos-context";

export type QrMode = "full" | "hybrid" | "pay_only";

export const QR_MODE_LABEL: Record<QrMode, string> = {
  full: "Full QR — menu, order, and pay at the table",
  hybrid: "Hybrid — staff starts the check; guests add follow-ups on QR",
  pay_only: "Pay QR only — staff orders; guest pays via QR",
};

export function parseQrMode(raw: unknown): QrMode {
  if (raw === "full" || raw === "hybrid" || raw === "pay_only") return raw;
  return "hybrid";
}

/** Short stable fingerprint so a table QR cannot be replayed at another location. */
export function locationQrFingerprint(locationId: string): string {
  const s = String(locationId ?? "").trim();
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(4, "0").slice(0, 4);
}

export function makeTableQrToken(tableId: string, label: string, locationId?: string): string {
  const fp = locationId ? locationQrFingerprint(locationId) : "xxxx";
  const seed = `${tableId}:${label}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const tail = tableId.replace(/[^a-z0-9]/gi, "").slice(-4);
  return `t${fp}${seed}${tail}`.slice(0, 24).toLowerCase();
}

/** True when the token was minted for this location (fingerprint in bytes 1–4). */
export function qrTokenMatchesLocation(token: string, locationId: string): boolean {
  const t = String(token ?? "").trim().toLowerCase();
  const loc = String(locationId ?? "").trim();
  if (!t || t[0] !== "t" || t.length < 5 || !loc) return false;
  return t.slice(1, 5) === locationQrFingerprint(loc);
}

export function tableQrPath(table: { label: string; qrToken?: string }): string {
  if (table.qrToken) return `/t/${table.qrToken}`;
  return `/table/${encodeURIComponent(table.label)}`;
}

export function tableQrSearch(opts?: {
  pay?: boolean;
  demoType?: string | null;
  seat?: number;
}): string {
  const params = new URLSearchParams();
  if (opts?.pay) params.set("pay", "1");
  if (opts?.demoType) params.set("demo", opts.demoType);
  if (opts?.seat && opts.seat > 0) params.set("seat", String(opts.seat));
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function tablePayPath(
  table: { label: string; qrToken?: string },
  demoType?: string | null,
): string {
  return `${tableQrPath(table)}${tableQrSearch({ pay: true, demoType })}`;
}

export function tableGuestPath(
  table: { label: string; qrToken?: string },
  opts?: { pay?: boolean; demoType?: string | null },
): string {
  return `${tableQrPath(table)}${tableQrSearch(opts)}`;
}

export function absolutePath(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function venueSlugNow(): string | null {
  try {
    return readTenantPosContext()?.slug || null;
  } catch {
    return null;
  }
}

export function tableGuestUrl(
  table: { label: string; qrToken?: string },
  opts?: { pay?: boolean; demoType?: string | null; seat?: number },
): string {
  const path = tableGuestPath(table, opts);
  const slug = venueSlugNow();
  if (slug) return venueAwareHref(path, slug);
  return absoluteGuestHref(path);
}

function ticketSig(orderId: string, locationId: string, exp: number): string {
  return locationQrFingerprint(`${locationId}|${orderId}|${exp}`);
}

/** Signed, short-lived pay/order token for one check. */
export function makeTicketQrToken(
  orderId: string,
  locationId: string,
  ttlSec = 15 * 60,
): { token: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, ttlSec);
  const id = String(orderId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const token = `c.${id}.${exp.toString(36)}.${ticketSig(id, locationId, exp)}`;
  return { token, exp };
}

export function parseTicketQrToken(
  token: string,
  locationId: string,
): { orderId: string; exp: number; expired: boolean } | null {
  const t = String(token ?? "").trim();
  const m = /^c\.([a-zA-Z0-9_-]{2,40})\.([a-z0-9]+)\.([a-z0-9]{4})$/.exec(t);
  if (!m) return null;
  const orderId = m[1]!;
  const exp = parseInt(m[2]!, 36);
  if (!Number.isFinite(exp)) return null;
  if (ticketSig(orderId, locationId, exp) !== m[3]) return null;
  return { orderId, exp, expired: Math.floor(Date.now() / 1000) >= exp };
}

export function ticketQrPath(token: string): string {
  return `/t/${encodeURIComponent(token)}`;
}

export function ticketGuestUrl(
  orderId: string,
  locationId: string,
  ttlSec?: number,
): { url: string; token: string; exp: number } {
  const minted = makeTicketQrToken(orderId, locationId, ttlSec);
  const path = ticketQrPath(minted.token);
  const slug = venueSlugNow();
  return {
    url: slug ? venueAwareHref(path, slug) : absoluteGuestHref(path),
    token: minted.token,
    exp: minted.exp,
  };
}
