import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { DEFAULT_PRINTER_PORT, parseLanTarget } from "./printer-models";
import {
  parseKitchenPrintSource,
  parseStationPrintQueue,
  type KitchenPrintSource,
  type StationPrintQueued,
} from "./station-print-queue";
import {
  PRINT_AGENT_WORKER,
  assertPrintAgentAccess,
  claimPrintJob,
  completePrintJob,
  countWaitingKitchenPrint,
  enqueuePrintJob,
} from "./queue.server";

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

function newPrintJobId(): string {
  return `pq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

function enqueueInput(d: {
  orgId?: string;
  locationId: string;
  printerId: string;
  host: string;
  port?: number;
  escposBase64: string;
  kind?: string;
  ticketId?: string;
  checkId?: string;
  source?: string;
  preferDocked?: boolean;
  deviceId?: string;
}) {
  return {
    orgId: String(d.orgId ?? "").trim(),
    locationId: String(d.locationId ?? "").trim().slice(0, 80),
    printerId: String(d.printerId ?? "").trim().slice(0, 80),
    host: String(d.host ?? "").trim().slice(0, 80),
    port: Number(d.port) > 0 ? Math.round(Number(d.port)) : 9100,
    escposBase64: String(d.escposBase64 ?? "").slice(0, 200_000),
    kind: String(d.kind ?? "test").slice(0, 40),
    ticketId: d.ticketId ? String(d.ticketId).slice(0, 80) : undefined,
    checkId: d.checkId ? String(d.checkId).slice(0, 80) : undefined,
    source: parseKitchenPrintSource(d.source),
    preferDocked: d.preferDocked !== false,
    deviceId: d.deviceId ? String(d.deviceId).trim().slice(0, 80) : "",
  };
}

function toQueued(data: ReturnType<typeof enqueueInput>): StationPrintQueued {
  const source: KitchenPrintSource | undefined = data.source;
  const kind = data.kind || (source && source !== "station" ? "ticket" : "test");
  return {
    id: newPrintJobId(),
    printerId: data.printerId,
    host: data.host,
    port: data.port,
    escposBase64: data.escposBase64,
    kind,
    queuedAt: Date.now(),
    ticketId: data.ticketId,
    checkId: data.checkId,
    source,
    preferDocked: data.preferDocked,
  };
}

export const enqueueStationPrintFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(enqueueInput)
  .handler(async ({ context, data }) => {
    if (!data.locationId || !data.printerId || !data.host || !data.escposBase64) {
      return { ok: false as const, error: "Printer target is required" };
    }
    const { assertLocationAccess } = await import("@/lib/saas/tenancy.server");
    await assertLocationAccess(context.userId, data.locationId);
    return enqueuePrintJob(data.locationId, toQueued(data));
  });

/** Station pair (kiosk / host / ODS) — no owner session. */
export const enqueueVenuePrintFn = createServerFn({ method: "POST" })
  .validator(enqueueInput)
  .handler(async ({ data }) => {
    if (!data.locationId || !data.printerId || !data.host || !data.escposBase64) {
      return { ok: false as const, error: "Printer target is required" };
    }
    if (!data.deviceId) {
      return { ok: false as const, error: "Station pair is required" };
    }
    const { readStationPairState } = await import("@/lib/pos/station-state.server");
    const live = await readStationPairState({
      locationId: data.locationId,
      deviceId: data.deviceId,
    });
    if (!live.ok) return { ok: false as const, error: "Station not paired" };
    return enqueuePrintJob(data.locationId, toQueued(data));
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

export const pendingKitchenPrintFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; deviceId?: string }) => ({
    locationId: String(d.locationId ?? "").trim().slice(0, 80),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    if (!data.locationId) return { waiting: 0 };
    if (data.deviceId) {
      const { readStationPairState } = await import("@/lib/pos/station-state.server");
      const live = await readStationPairState(data);
      if (!live.ok) return { waiting: 0 };
    } else {
      try {
        const { getSessionUser } = await import("@/lib/auth/verify.server");
        const user = await getSessionUser();
        if (!user) return { waiting: 0 };
        const { assertLocationAccess } = await import("@/lib/saas/tenancy.server");
        await assertLocationAccess(user.id, data.locationId);
      } catch {
        return { waiting: 0 };
      }
    }
    const waiting = await countWaitingKitchenPrint(data.locationId);
    return { waiting };
  });

export const claimStationPrintFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; deviceId: string; role?: string }) => ({
    locationId: String(d.locationId ?? "").trim().slice(0, 80),
    deviceId: String(d.deviceId ?? "").trim().slice(0, 80),
    role: String(d.role ?? "").trim().slice(0, 40),
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
    const job = await claimPrintJob({
      locationId: data.locationId,
      workerId: data.deviceId,
      role: data.role,
    });
    return { job };
  });

export const claimPrintAgentFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; token?: string; workerId?: string }) => ({
    locationId: String(d.locationId ?? "").trim().slice(0, 80),
    token: String(d.token ?? "").trim().slice(0, 120),
    workerId: String(d.workerId ?? PRINT_AGENT_WORKER).trim().slice(0, 80) || PRINT_AGENT_WORKER,
  }))
  .handler(async ({ data }) => {
    if (!(await assertPrintAgentAccess(data.locationId, data.token))) {
      return { job: null as StationPrintQueued | null };
    }
    const job = await claimPrintJob({
      locationId: data.locationId,
      workerId: data.workerId,
      role: PRINT_AGENT_WORKER,
    });
    return { job };
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
    await completePrintJob({
      locationId: data.locationId,
      workerId: data.deviceId,
      jobId: data.jobId,
      ok: data.ok,
    });
    return { ok: true as const };
  });

export const completePrintAgentFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; token?: string; workerId?: string; jobId: string; ok: boolean }) => ({
    locationId: String(d.locationId ?? "").trim().slice(0, 80),
    token: String(d.token ?? "").trim().slice(0, 120),
    workerId: String(d.workerId ?? PRINT_AGENT_WORKER).trim().slice(0, 80) || PRINT_AGENT_WORKER,
    jobId: String(d.jobId ?? "").trim().slice(0, 80),
    ok: Boolean(d.ok),
  }))
  .handler(async ({ data }) => {
    if (!(await assertPrintAgentAccess(data.locationId, data.token))) {
      return { ok: false as const };
    }
    await completePrintJob({
      locationId: data.locationId,
      workerId: data.workerId,
      jobId: data.jobId,
      ok: data.ok,
    });
    return { ok: true as const };
  });
