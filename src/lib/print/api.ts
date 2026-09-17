import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { DEFAULT_PRINTER_PORT, parseLanTarget } from "./printer-models";
import {
  parseStationPrintQueue,
  pruneStationPrintQueue,
  type StationPrintQueued,
} from "./station-print-queue";
import { parseLocationDevices } from "@/lib/pos/location-devices";

async function patchLocationSetup(
  locationId: string,
  fn: (setup: Record<string, unknown>) => Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where id = ${locationId} limit 1
  `;
  const prev =
    rows[0]?.setup && typeof rows[0].setup === "object" && !Array.isArray(rows[0].setup)
      ? { ...(rows[0].setup as Record<string, unknown>) }
      : {};
  const next = fn(prev);
  await sql`
    update locations set setup = ${JSON.stringify(next)}::jsonb where id = ${locationId}
  `;
  return next;
}

function writeTcp(host: string, port: number, buf: Buffer): Promise<void> {
  return import("node:net").then(
    (net) =>
      new Promise<void>((resolve, reject) => {
        const sock = net.connect({ host, port }, () => {
          sock.write(buf, (err) => {
            if (err) {
              sock.destroy();
              reject(err);
              return;
            }
            sock.end();
          });
        });
        sock.setTimeout(4000);
        sock.on("timeout", () => {
          sock.destroy();
          reject(new Error("Printer timed out"));
        });
        sock.on("error", reject);
        sock.on("close", () => resolve());
      }),
  );
}

/** Raw ESC/POS / Star Line bytes to IP:9100 from this host (LAN print agent alternative). */
export const rawLanPrintFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { target?: string; ip?: string; port?: number; escposBase64?: string }) => {
    const parsed = parseLanTarget(d.ip, d.port, d.target);
    const b64 = String(d.escposBase64 ?? "");
    if (!parsed) throw new Error("Static IP is required for test print");
    if (!b64) throw new Error("Print payload is empty");
    return {
      host: parsed.host,
      port: parsed.port || DEFAULT_PRINTER_PORT,
      escposBase64: b64.slice(0, 200_000),
    };
  })
  .handler(async ({ data }): Promise<{ ok: true; bytes: number } | { ok: false; error: string }> => {
    try {
      const buf = Buffer.from(data.escposBase64, "base64");
      if (!buf.length) return { ok: false, error: "Print payload is empty" };
      await writeTcp(data.host, data.port, buf);
      return { ok: true, bytes: buf.length };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : `Could not reach ${data.host}:${data.port}`,
      };
    }
  });

export const enqueueStationPrintFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    orgId?: string;
    locationId: string;
    printerId: string;
    host: string;
    port?: number;
    escposBase64: string;
    kind?: string;
  }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: String(d.locationId ?? "").trim().slice(0, 80),
    printerId: String(d.printerId ?? "").trim().slice(0, 80),
    host: String(d.host ?? "").trim().slice(0, 80),
    port: Number(d.port) > 0 ? Math.round(Number(d.port)) : 9100,
    escposBase64: String(d.escposBase64 ?? "").slice(0, 200_000),
    kind: String(d.kind ?? "test").slice(0, 40),
  }))
  .handler(async ({ context, data }) => {
    if (!data.locationId || !data.printerId || !data.host || !data.escposBase64) {
      return { ok: false as const, error: "Printer target is required" };
    }
    const { assertLocationAccess } = await import("@/lib/saas/tenancy.server");
    await assertLocationAccess(context.userId, data.locationId);
    const job: StationPrintQueued = {
      id: `pq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      printerId: data.printerId,
      host: data.host,
      port: data.port,
      escposBase64: data.escposBase64,
      kind: data.kind,
      queuedAt: Date.now(),
    };
    await patchLocationSetup(data.locationId, (setup) => {
      const queue = pruneStationPrintQueue(parseStationPrintQueue(setup.stationPrintQueue));
      queue.unshift(job);
      return { ...setup, stationPrintQueue: queue.slice(0, 12) };
    });
    return { ok: true as const, jobId: job.id };
  });

export const getStationPrintJobFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; jobId: string }) => ({
    locationId: String(d.locationId ?? "").trim().slice(0, 80),
    jobId: String(d.jobId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { assertLocationAccess } = await import("@/lib/saas/tenancy.server");
    const access = await assertLocationAccess(context.userId, data.locationId);
    const queue = parseStationPrintQueue(access.location.setup?.stationPrintQueue);
    const job = queue.find((j) => j.id === data.jobId);
    if (!job) return { status: "missing" as const };
    if (job.doneAt) return { status: "done" as const, ok: job.ok === true };
    if (job.claimedBy) return { status: "claimed" as const };
    return { status: "pending" as const };
  });

export const claimStationPrintFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; deviceId: string }) => ({
    locationId: String(d.locationId ?? "").trim().slice(0, 80),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const { readStationPairState } = await import("@/lib/pos/station-state.server");
    const live = await readStationPairState(data);
    if (!live.ok) return { job: null as StationPrintQueued | null };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update location_devices
      set status = ${"online"}, last_seen_at = now()
      where location_id = ${data.locationId}
        and (id = ${data.deviceId} or serial = ${data.deviceId})
        and status <> ${"inactive"}
    `.catch(() => undefined);
    let claimed: StationPrintQueued | null = null;
    const now = Date.now();
    await patchLocationSetup(data.locationId, (setup) => {
      const queue = pruneStationPrintQueue(parseStationPrintQueue(setup.stationPrintQueue), now);
      const idx = queue.findIndex(
        (j) => !j.doneAt && (!j.claimedBy || now - (j.claimedAt ?? 0) > 8_000),
      );
      if (idx >= 0) {
        queue[idx] = { ...queue[idx]!, claimedBy: data.deviceId, claimedAt: now };
        claimed = queue[idx]!;
      }
      return { ...setup, stationPrintQueue: queue };
    });
    return { job: claimed };
  });

export const completeStationPrintFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; deviceId: string; jobId: string; ok: boolean }) => ({
    locationId: String(d.locationId ?? "").trim().slice(0, 80),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
    jobId: String(d.jobId ?? "").trim().slice(0, 80),
    ok: Boolean(d.ok),
  }))
  .handler(async ({ data }) => {
    const { readStationPairState } = await import("@/lib/pos/station-state.server");
    const live = await readStationPairState(data);
    if (!live.ok) return { ok: false as const };
    const now = Date.now();
    await patchLocationSetup(data.locationId, (setup) => {
      const queue = pruneStationPrintQueue(parseStationPrintQueue(setup.stationPrintQueue), now);
      const job = queue.find((j) => j.id === data.jobId);
      if (job) {
        job.doneAt = now;
        job.ok = data.ok;
        job.claimedBy = data.deviceId;
      }
      if (data.ok && job?.printerId) {
        const devices = parseLocationDevices(setup.locationDevices).map((d) => {
          if (d.id !== job.printerId || !d.print) return d;
          return {
            ...d,
            print: {
              ...d.print,
              lastPrintAt: now,
              reachability: "idle" as const,
            },
          };
        });
        return { ...setup, stationPrintQueue: queue, locationDevices: devices };
      }
      return { ...setup, stationPrintQueue: queue };
    });
    return { ok: true as const };
  });
