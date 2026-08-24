import type { LocationSnapshot, OutboxItem, OutboxStatus } from "./types";

const DB_NAME = "summex-offline-v1";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("outbox")) {
        const store = db.createObjectStore("outbox", { keyPath: "clientMutationId" });
        store.createIndex("status", "status");
        store.createIndex("locationId", "locationId");
      }
      if (!db.objectStoreNames.contains("snapshot")) {
        db.createObjectStore("snapshot", { keyPath: "locationId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutOutbox(item: OutboxItem): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction("outbox", "readwrite");
  await reqToPromise(tx.objectStore("outbox").put(item));
}

export async function idbGetOutbox(locationId?: string): Promise<OutboxItem[]> {
  const db = await openDb();
  if (!db) return [];
  const tx = db.transaction("outbox", "readonly");
  const all = (await reqToPromise(tx.objectStore("outbox").getAll())) as OutboxItem[];
  const rows = locationId ? all.filter((r) => r.locationId === locationId) : all;
  return rows.sort((a, b) => a.at - b.at);
}

export async function idbQueued(locationId?: string): Promise<OutboxItem[]> {
  const all = await idbGetOutbox(locationId);
  return all.filter((r) => r.status === "queued" || r.status === "syncing");
}

export async function idbMark(
  clientMutationId: string,
  patch: Partial<Pick<OutboxItem, "status" | "attempts" | "lastError" | "nextAttemptAt">>,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction("outbox", "readwrite");
  const store = tx.objectStore("outbox");
  const cur = (await reqToPromise(store.get(clientMutationId))) as OutboxItem | undefined;
  if (!cur) return;
  await reqToPromise(store.put({ ...cur, ...patch }));
}

export async function idbDeleteOutbox(clientMutationId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction("outbox", "readwrite");
  await reqToPromise(tx.objectStore("outbox").delete(clientMutationId));
}

export async function idbClearLocation(locationId: string, opts?: { keepQueued?: boolean }): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(["outbox", "snapshot"], "readwrite");
  const out = tx.objectStore("outbox");
  const all = (await reqToPromise(out.getAll())) as OutboxItem[];
  for (const row of all) {
    if (row.locationId !== locationId) continue;
    if (opts?.keepQueued && (row.status === "queued" || row.status === "syncing" || row.status === "dead")) {
      continue;
    }
    await reqToPromise(out.delete(row.clientMutationId));
  }
  await reqToPromise(tx.objectStore("snapshot").delete(locationId));
}

export async function idbPutSnapshot(snap: LocationSnapshot): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction("snapshot", "readwrite");
  await reqToPromise(tx.objectStore("snapshot").put(snap));
}

export async function idbGetSnapshot(locationId: string): Promise<LocationSnapshot | null> {
  const db = await openDb();
  if (!db) return null;
  const tx = db.transaction("snapshot", "readonly");
  return ((await reqToPromise(tx.objectStore("snapshot").get(locationId))) as LocationSnapshot) ?? null;
}

export function isQueued(status: OutboxStatus): boolean {
  return status === "queued" || status === "syncing";
}
