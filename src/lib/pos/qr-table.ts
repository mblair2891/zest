import { absoluteGuestHref } from "@/lib/platform/hosts";

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

export function makeTableQrToken(tableId: string, label: string): string {
  const seed = `${tableId}:${label}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  return `t${seed}${tableId.replace(/[^a-z0-9]/gi, "").slice(-4)}`.slice(0, 20).toLowerCase();
}

export function tableQrPath(table: { label: string; qrToken?: string }): string {
  if (table.qrToken) return `/t/${table.qrToken}`;
  return `/table/${encodeURIComponent(table.label)}`;
}

export function tableQrSearch(opts?: {
  pay?: boolean;
  demoType?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts?.pay) params.set("pay", "1");
  if (opts?.demoType) params.set("demo", opts.demoType);
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

export function tableGuestUrl(
  table: { label: string; qrToken?: string },
  opts?: { pay?: boolean; demoType?: string | null },
): string {
  return absoluteGuestHref(tableGuestPath(table, opts));
}
