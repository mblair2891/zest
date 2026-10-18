/**
 * Local removals, voids, and check deletes win over a stale open-floor poll
 * until the server snapshot matches. No server or @/ imports — node tests load this.
 */

export type PendingLineVoid = {
  voided?: boolean;
  comped?: boolean;
  actionReason?: string | null;
};

export type PendingCheckEdit = {
  checkId: string;
  removedLineIds: string[];
  voids: Record<string, PendingLineVoid>;
  deleted?: boolean;
  voidedCheck?: boolean;
  releasedTableIds: string[];
};

export type FloorSnap = {
  orders: unknown;
  tickets: unknown;
  tables: unknown;
  activeOrderId: string | null;
  selectedLineId: string | null;
};

const pending = new Map<string, PendingCheckEdit>();
const snaps = new Map<string, FloorSnap>();
const lineGen = new Map<string, number>();

function edit(checkId: string): PendingCheckEdit {
  const existing = pending.get(checkId);
  if (existing) return existing;
  const next: PendingCheckEdit = {
    checkId,
    removedLineIds: [],
    voids: {},
    releasedTableIds: [],
  };
  pending.set(checkId, next);
  return next;
}

export function pendingCheckEdits(): PendingCheckEdit[] {
  return [...pending.values()];
}

export function noteLineEdit(checkId: string): number {
  const next = (lineGen.get(checkId) ?? 0) + 1;
  lineGen.set(checkId, next);
  return next;
}

export function lineEditGeneration(checkId: string): number | undefined {
  return lineGen.get(checkId);
}

export function rememberFloorSnapshot(checkId: string, snap: FloorSnap): void {
  if (!snaps.has(checkId)) snaps.set(checkId, snap);
}

export function rememberLineRemoved(checkId: string, lineId: string): void {
  const row = edit(checkId);
  if (!row.removedLineIds.includes(lineId)) row.removedLineIds.push(lineId);
  delete row.voids[lineId];
}

export function rememberLineVoid(checkId: string, lineId: string, change: PendingLineVoid): void {
  const row = edit(checkId);
  row.voids[lineId] = { ...row.voids[lineId], ...change };
}

export function rememberCheckDeleted(checkId: string, tableIds: string[] = []): void {
  const row = edit(checkId);
  row.deleted = true;
  for (const id of tableIds) {
    if (id && !row.releasedTableIds.includes(id)) row.releasedTableIds.push(id);
  }
}

export function rememberCheckVoided(checkId: string, tableIds: string[] = []): void {
  const row = edit(checkId);
  row.voidedCheck = true;
  for (const id of tableIds) {
    if (id && !row.releasedTableIds.includes(id)) row.releasedTableIds.push(id);
  }
}

export function releasedTableIds(): Set<string> {
  const ids = new Set<string>();
  for (const row of pending.values()) {
    for (const id of row.releasedTableIds) ids.add(id);
  }
  return ids;
}

export function rollbackFloorEdit(checkId: string): FloorSnap | null {
  const snap = snaps.get(checkId) ?? null;
  pending.delete(checkId);
  snaps.delete(checkId);
  return snap;
}

export function resetPendingFloorEdits(): void {
  pending.clear();
  snaps.clear();
  lineGen.clear();
}

type MergeLine = {
  id: string;
  sent?: boolean;
  voided?: boolean;
  comped?: boolean;
  actionReason?: string | null;
  createdAt?: number;
};

type MergeOrder = {
  id: string;
  createdAt?: number;
  status?: string;
  lines: MergeLine[];
};

function pendingActive(row: PendingCheckEdit | undefined): boolean {
  if (!row) return false;
  return Boolean(
    row.deleted ||
      row.voidedCheck ||
      row.removedLineIds.length ||
      Object.keys(row.voids).length,
  );
}

export function mergeOpenOrders<T extends MergeOrder>(
  local: T[],
  server: T[],
  now: number,
  graceMs: number,
): T[] {
  const byId = new Map(pendingCheckEdits().map((row) => [row.checkId, row]));
  const serverIds = new Set(server.map((order) => order.id));
  const merged: T[] = [];
  for (const remote of server) {
    const row = byId.get(remote.id);
    const localOrder = local.find((order) => order.id === remote.id);
    if (row?.deleted) continue;
    if (row?.voidedCheck && remote.status !== "voided" && localOrder) {
      merged.push(localOrder);
      continue;
    }
    const removed = new Set(row?.removedLineIds ?? []);
    let lines = remote.lines.filter((line) => !removed.has(line.id)) as T["lines"];
    if (row && Object.keys(row.voids).length) {
      lines = lines.map((line) => {
        const change = row.voids[line.id];
        if (!change) return line;
        return {
          ...line,
          voided: change.voided ? true : line.voided,
          comped: change.comped ? true : line.comped,
          actionReason: change.actionReason ?? line.actionReason,
        };
      }) as T["lines"];
    }
    const serverLineIds = new Set(remote.lines.map((line) => line.id));
    const extra = (localOrder?.lines ?? []).filter(
      (line) =>
        !serverLineIds.has(line.id) &&
        !line.sent &&
        !removed.has(line.id) &&
        now - (line.createdAt || 0) < graceMs,
    );
    if (extra.length || removed.size || (row && Object.keys(row.voids).length)) {
      merged.push({ ...remote, lines: [...lines, ...extra] });
    } else {
      merged.push(remote);
    }
  }
  for (const order of local) {
    if (serverIds.has(order.id)) continue;
    if (byId.get(order.id)?.deleted) continue;
    if (now - (order.createdAt || 0) < graceMs) merged.push(order);
  }
  return merged;
}

type MergeTicket = {
  id: string;
  orderId: string;
  status?: string;
  createdAt?: number;
};

export function mergeOpenTickets<T extends MergeTicket>(
  local: T[],
  server: T[],
  now: number,
  graceMs: number,
): T[] {
  const held = new Set(
    pendingCheckEdits().filter((row) => pendingActive(row)).map((row) => row.checkId),
  );
  const serverKept = server.filter((ticket) => !held.has(ticket.orderId) && ticket.status !== "voided");
  const ids = new Set(serverKept.map((ticket) => ticket.id));
  const localKept = local.filter((ticket) => {
    if (ticket.status === "voided") return false;
    if (held.has(ticket.orderId)) return true;
    if (ids.has(ticket.id)) return false;
    return now - (ticket.createdAt || 0) < graceMs;
  });
  return [...serverKept, ...localKept];
}

export function reconcilePendingFloor(input: {
  checks: { id: string; status?: string; lines: { id: string; voided?: boolean; comped?: boolean }[] }[];
  tables: { tableId: string; status?: string; checkId?: string | null }[];
}): void {
  for (const [id, row] of pending) {
    const server = input.checks.find((check) => check.id === id);
    if (row.deleted && server) continue;
    if (!server) {
      row.deleted = false;
      row.voidedCheck = false;
      row.removedLineIds = [];
      row.voids = {};
      row.releasedTableIds = row.releasedTableIds.filter((tableId) => {
        const table = input.tables.find((item) => item.tableId === tableId);
        if (!table) return false;
        return Boolean(table.checkId) && table.status !== "empty";
      });
      if (row.releasedTableIds.length === 0) {
        pending.delete(id);
        snaps.delete(id);
      }
      continue;
    }
    if (row.voidedCheck && server.status === "voided") row.voidedCheck = false;
    row.removedLineIds = row.removedLineIds.filter((lineId) =>
      server.lines.some((line) => line.id === lineId),
    );
    for (const lineId of Object.keys(row.voids)) {
      const line = server.lines.find((item) => item.id === lineId);
      const want = row.voids[lineId];
      if (!line) {
        delete row.voids[lineId];
        continue;
      }
      if ((want?.voided && line.voided) || (want?.comped && line.comped)) delete row.voids[lineId];
    }
    row.releasedTableIds = row.releasedTableIds.filter((tableId) => {
      const table = input.tables.find((item) => item.tableId === tableId);
      if (!table) return false;
      return Boolean(table.checkId) && table.status !== "empty";
    });
    if (
      !row.deleted &&
      !row.voidedCheck &&
      row.removedLineIds.length === 0 &&
      Object.keys(row.voids).length === 0 &&
      row.releasedTableIds.length === 0
    ) {
      pending.delete(id);
      snaps.delete(id);
    }
  }
}

export type VoidTicketShape = {
  id: string;
  orderId: string;
  status: string;
  items: { lineId: string }[];
};

/** Void or trim fired tickets. Chits are the lines the station should cancel. */
export function applyTicketVoids<T extends VoidTicketShape>(
  tickets: T[],
  orderId: string,
  voidedLineIds: readonly string[],
): { tickets: T[]; chits: T[] } {
  const voided = new Set(voidedLineIds);
  const chits: T[] = [];
  const next = tickets.map((ticket) => {
    if (ticket.orderId !== orderId || ticket.status === "voided") return ticket;
    const hit = ticket.items.filter((item) => voided.has(item.lineId));
    if (!hit.length) return ticket;
    const remain = ticket.items.filter((item) => !voided.has(item.lineId));
    chits.push({ ...ticket, items: hit });
    if (remain.length === 0) return { ...ticket, status: "voided" };
    return { ...ticket, items: remain };
  });
  return { tickets: next, chits };
}

const REJECT_SNIPPETS = [
  "This check cannot be deleted.",
  "Sent items stay on the check.",
  "This check has a payment.",
  "Not permitted for this operator",
  "Paid check is frozen.",
  "Check not found",
  "Location not found",
];

export function floorRejectMessage(err: unknown): string | null {
  const text = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = text.trim();
  if (!msg) return null;
  if (REJECT_SNIPPETS.some((snippet) => msg.includes(snippet))) return msg;
  if (err instanceof Error && err.name === "ForbiddenError") return msg;
  return null;
}
