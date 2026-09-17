/** Dashboard → paired station print jobs. WebView cannot TCP 9100. */

export const STATION_ONLINE_MS = 15 * 60_000;
export const PRINT_JOB_TTL_MS = 120_000;
export const PRINT_QUEUE_MAX = 12;

export type StationPrintQueued = {
  id: string;
  printerId: string;
  host: string;
  port: number;
  escposBase64: string;
  kind: string;
  queuedAt: number;
  claimedBy?: string;
  claimedAt?: number;
  doneAt?: number;
  ok?: boolean;
};

export function parseStationPrintQueue(raw: unknown): StationPrintQueued[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const out: StationPrintQueued[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = String(o.id ?? "").trim().slice(0, 80);
    const printerId = String(o.printerId ?? "").trim().slice(0, 80);
    const host = String(o.host ?? "").trim().slice(0, 80);
    const port = Number(o.port) > 0 ? Math.round(Number(o.port)) : 9100;
    const escposBase64 = String(o.escposBase64 ?? "");
    const queuedAt = Number(o.queuedAt) || 0;
    if (!id || !printerId || !host || !escposBase64 || !queuedAt) continue;
    if (now - queuedAt > PRINT_JOB_TTL_MS && o.doneAt == null) continue;
    out.push({
      id,
      printerId,
      host,
      port: port > 0 && port < 65536 ? port : 9100,
      escposBase64: escposBase64.slice(0, 200_000),
      kind: String(o.kind ?? "test").slice(0, 40),
      queuedAt,
      claimedBy: o.claimedBy ? String(o.claimedBy).slice(0, 80) : undefined,
      claimedAt: Number(o.claimedAt) > 0 ? Number(o.claimedAt) : undefined,
      doneAt: Number(o.doneAt) > 0 ? Number(o.doneAt) : undefined,
      ok: typeof o.ok === "boolean" ? o.ok : undefined,
    });
    if (out.length >= PRINT_QUEUE_MAX) break;
  }
  return out;
}

export function pruneStationPrintQueue(
  list: StationPrintQueued[],
  now = Date.now(),
): StationPrintQueued[] {
  return list.filter((j) => {
    if (j.doneAt) return now - j.doneAt < PRINT_JOB_TTL_MS;
    return now - j.queuedAt < PRINT_JOB_TTL_MS;
  });
}
