/** Venue print jobs. Guest QR / kiosk / online cannot TCP 9100. */

export const STATION_ONLINE_MS = 15 * 60_000;
export const PRINT_TEST_TTL_MS = 120_000;
export const PRINT_TICKET_TTL_MS = 8 * 60 * 60_000;
export const PRINT_JOB_TTL_MS = PRINT_TEST_TTL_MS;
export const PRINT_QUEUE_MAX = 80;
export const PRINT_CLAIM_STALE_MS = 8_000;

export const PRINT_AGENT_WORKER = "print-agent";

export type KitchenPrintSource = "station" | "qr" | "kiosk" | "online" | "dashboard";

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
  ticketId?: string;
  checkId?: string;
  source?: KitchenPrintSource;
  preferDocked?: boolean;
};

export const PREFERRED_PRINT_WORKER_TYPES = new Set(["kds", "host_stand"]);
export const PREFERRED_PRINT_WORKER_FUNCTIONS = new Set([
  "kitchen_kds",
  "bar_kds",
  "expo",
  "host_stand",
]);
export const PREFERRED_PRINT_WORKER_ROLES = new Set(["ods", "host", PRINT_AGENT_WORKER]);

export function isPreferredPrintWorkerRole(role: string | null | undefined): boolean {
  return PREFERRED_PRINT_WORKER_ROLES.has(String(role ?? "").trim());
}

export function isPreferredPrintWorkerDevice(
  type: string | null | undefined,
  assignedFunction?: string | null,
): boolean {
  const t = String(type ?? "").trim();
  if (PREFERRED_PRINT_WORKER_TYPES.has(t)) return true;
  return PREFERRED_PRINT_WORKER_FUNCTIONS.has(String(assignedFunction ?? "").trim());
}

export function jobTtlMs(kind: string | null | undefined): number {
  return String(kind ?? "") === "ticket" ? PRINT_TICKET_TTL_MS : PRINT_TEST_TTL_MS;
}

export function parseKitchenPrintSource(raw: unknown): KitchenPrintSource | undefined {
  const s = String(raw ?? "").trim();
  if (s === "station" || s === "qr" || s === "kiosk" || s === "online" || s === "dashboard") {
    return s;
  }
  return undefined;
}

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
    const kind = String(o.kind ?? "test").slice(0, 40);
    if (!id || !printerId || !host || !escposBase64 || !queuedAt) continue;
    if (now - queuedAt > jobTtlMs(kind) && o.doneAt == null) continue;
    out.push({
      id,
      printerId,
      host,
      port: port > 0 && port < 65536 ? port : 9100,
      escposBase64: escposBase64.slice(0, 200_000),
      kind,
      queuedAt,
      claimedBy: o.claimedBy ? String(o.claimedBy).slice(0, 80) : undefined,
      claimedAt: Number(o.claimedAt) > 0 ? Number(o.claimedAt) : undefined,
      doneAt: Number(o.doneAt) > 0 ? Number(o.doneAt) : undefined,
      ok: typeof o.ok === "boolean" ? o.ok : undefined,
      ticketId: o.ticketId ? String(o.ticketId).slice(0, 80) : undefined,
      checkId: o.checkId ? String(o.checkId).slice(0, 80) : undefined,
      source: parseKitchenPrintSource(o.source),
      preferDocked: o.preferDocked === false ? false : true,
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
    const ttl = jobTtlMs(j.kind);
    if (j.doneAt) return now - j.doneAt < ttl;
    return now - j.queuedAt < ttl;
  });
}

/** Keep open tickets; drop done/test first when capping. */
export function capStationPrintQueue(list: StationPrintQueued[]): StationPrintQueued[] {
  if (list.length <= PRINT_QUEUE_MAX) return list;
  const openTickets = list.filter((j) => j.kind === "ticket" && !j.doneAt);
  const rest = list.filter((j) => !(j.kind === "ticket" && !j.doneAt));
  return [...openTickets, ...rest].slice(0, PRINT_QUEUE_MAX);
}

export function countWaitingKitchenPrints(list: StationPrintQueued[]): number {
  const ids = new Set<string>();
  for (const j of list) {
    if (j.kind !== "ticket") continue;
    if (j.doneAt && j.ok === true) continue;
    ids.add(j.ticketId || j.id);
  }
  return ids.size;
}

export function waitingKitchenPrintBanner(n: number): string {
  return `${n} kitchen tickets waiting to print.`;
}

export function jobIsClaimable(j: StationPrintQueued, now = Date.now()): boolean {
  if (j.doneAt) return false;
  if (j.ok === true) return false;
  if (!j.claimedBy) return true;
  return now - (j.claimedAt ?? 0) > PRINT_CLAIM_STALE_MS;
}
