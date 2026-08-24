import { activeLocationId } from "./scope";

const CHANNEL = "summex-lan-ops";

type LanMsg =
  | { type: "hello"; locationId: string; at: number; peerId: string }
  | {
      type: "patch";
      locationId: string;
      at: number;
      peerId: string;
      orders?: unknown;
      tickets?: unknown;
      waitlist?: unknown;
      tables?: unknown;
    };

let channel: BroadcastChannel | null = null;
let peerId = "";
const listeners = new Set<(peerId: string, at: number) => void>();

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    peerId = `peer_${Math.random().toString(36).slice(2, 8)}`;
    channel.onmessage = (ev: MessageEvent<LanMsg>) => {
      const msg = ev.data;
      if (!msg || msg.locationId !== activeLocationId()) return;
      if (msg.type === "hello" || msg.type === "patch") {
        listeners.forEach((fn) => fn(msg.peerId, msg.at));
      }
      if (msg.type === "patch") void mergePatch(msg);
    };
  }
  return channel;
}

function mergeById<T extends { id: string }>(local: T[], incoming: T[] | undefined): T[] {
  if (!incoming || incoming.length === 0) return local;
  const map = new Map(local.map((r) => [r.id, r]));
  for (const row of incoming) {
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    const prevAt = Number(
      (prev as { updatedAt?: number; closedAt?: number; bumpedAt?: number }).updatedAt ??
        (prev as { closedAt?: number }).closedAt ??
        0,
    );
    const nextAt = Number(
      (row as { updatedAt?: number; closedAt?: number; bumpedAt?: number }).updatedAt ??
        (row as { closedAt?: number }).closedAt ??
        0,
    );
    if (nextAt >= prevAt) map.set(row.id, { ...prev, ...row });
  }
  return [...map.values()];
}

async function mergePatch(msg: Extract<LanMsg, { type: "patch" }>) {
  try {
    const { usePosStore } = await import("@/lib/pos/store");
    const s = usePosStore.getState();
    const patch: Record<string, unknown> = {};
    if (msg.orders) patch.orders = mergeById(s.orders, msg.orders as typeof s.orders);
    if (msg.tickets) patch.tickets = mergeById(s.tickets, msg.tickets as typeof s.tickets);
    if (msg.waitlist) patch.waitlist = mergeById(s.waitlist, msg.waitlist as typeof s.waitlist);
    if (msg.tables) patch.tables = mergeById(s.tables, msg.tables as typeof s.tables);
    if (Object.keys(patch).length) usePosStore.setState(patch as Partial<typeof s>);
  } catch {
    /* POS not ready */
  }
}

export function subscribeLanPeers(fn: (peerId: string, at: number) => void): () => void {
  listeners.add(fn);
  getChannel();
  return () => listeners.delete(fn);
}

export function lanHello(): void {
  const ch = getChannel();
  if (!ch) return;
  ch.postMessage({
    type: "hello",
    locationId: activeLocationId(),
    at: Date.now(),
    peerId,
  } satisfies LanMsg);
}

export async function lanBroadcastOps(): Promise<void> {
  const ch = getChannel();
  if (!ch) return;
  try {
    const { usePosStore } = await import("@/lib/pos/store");
    const s = usePosStore.getState();
    ch.postMessage({
      type: "patch",
      locationId: activeLocationId(),
      at: Date.now(),
      peerId,
      orders: s.orders,
      tickets: s.tickets,
      waitlist: s.waitlist,
      tables: s.tables,
    } satisfies LanMsg);
  } catch {
    /* ignore */
  }
}

export function lanPeerId(): string {
  getChannel();
  return peerId;
}
