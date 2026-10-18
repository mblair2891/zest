import { isPrintLanHost } from "./lan-hosts.ts";

/** One printer a station should open on TCP 9100. No bytes are sent. */
export type PrinterProbeTarget = {
  id: string;
  host: string;
  port: number;
};

export type PrinterProbeResult = {
  id: string;
  ok: boolean;
};

export type PrinterProbeTicket = {
  id: string;
  requestedAt: number;
  status: "pending" | "done" | "error";
  targets: PrinterProbeTarget[];
  results: PrinterProbeResult[];
  error: string;
  finishedAt: number;
};

function portOf(raw: unknown): number {
  const port = Math.round(Number(raw));
  if (!Number.isFinite(port) || port <= 0 || port >= 65536) return 9100;
  return port;
}

export function parsePrinterProbeTargets(raw: unknown): PrinterProbeTarget[] {
  if (!Array.isArray(raw)) return [];
  const out: PrinterProbeTarget[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const id = String(rec.id ?? "").trim().slice(0, 80);
    const host = String(rec.host ?? "").trim();
    if (!id || seen.has(id) || !isPrintLanHost(host)) continue;
    seen.add(id);
    out.push({ id, host, port: portOf(rec.port) });
    if (out.length >= 12) break;
  }
  return out;
}

export function parsePrinterProbeResults(raw: unknown): PrinterProbeResult[] {
  if (!Array.isArray(raw)) return [];
  const out: PrinterProbeResult[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const id = String(rec.id ?? "").trim().slice(0, 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, ok: rec.ok === true });
    if (out.length >= 12) break;
  }
  return out;
}

export function parsePrinterProbeTicket(raw: unknown): PrinterProbeTicket | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const id = String(rec.id ?? "").trim().slice(0, 40);
  const requestedAt = Number(rec.requestedAt);
  if (!id || !Number.isFinite(requestedAt) || requestedAt <= 0) return null;
  const status = rec.status === "done" || rec.status === "error" ? rec.status : "pending";
  return {
    id,
    requestedAt,
    status,
    targets: parsePrinterProbeTargets(rec.targets),
    results: parsePrinterProbeResults(rec.results),
    error: String(rec.error ?? "").slice(0, 180),
    finishedAt: Number(rec.finishedAt) > 0 ? Number(rec.finishedAt) : 0,
  };
}
