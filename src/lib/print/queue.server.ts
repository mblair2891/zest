import { parseLocationDevices } from "@/lib/pos/location-devices";
import { isUsbPrintJob } from "./printer-transport";
import {
  PRINT_AGENT_WORKER,
  STATION_ONLINE_MS,
  capStationPrintQueue,
  countWaitingKitchenPrints,
  isPreferredPrintWorkerDevice,
  isPreferredPrintWorkerRole,
  jobClaimableBy,
  parseStationPrintQueue,
  pruneStationPrintQueue,
  type StationPrintQueued,
} from "./station-print-queue";

export async function patchLocationSetup(
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

export async function preferredPrintWorkerOnline(
  locationId: string,
  now = Date.now(),
): Promise<boolean> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{
    type: string;
    assigned_function: string | null;
    last_seen_at: Date | string | null;
    status: string;
  }>`
    select type, assigned_function, last_seen_at, status
    from location_devices
    where location_id = ${locationId}
      and status = ${"online"}
  `.catch(() => []);
  const cutoff = now - STATION_ONLINE_MS;
  for (const r of rows) {
    if (!r.last_seen_at) continue;
    const seen = new Date(r.last_seen_at).getTime();
    if (!seen || seen < cutoff) continue;
    if (isPreferredPrintWorkerDevice(r.type, r.assigned_function)) return true;
  }
  const loc = await sql<{ setup: unknown }>`
    select setup from locations where id = ${locationId} limit 1
  `.catch(() => []);
  const setup = loc[0]?.setup;
  const setupObj =
    setup && typeof setup === "object" && !Array.isArray(setup)
      ? (setup as Record<string, unknown>)
      : null;
  const agentSeen = Number(setupObj?.printAgentSeenAt ?? 0);
  if (agentSeen >= cutoff) return true;
  const devices = parseLocationDevices(setupObj?.locationDevices);
  return devices.some(
    (d) =>
      isPreferredPrintWorkerDevice(d.type, d.assignment?.function) &&
      Boolean(d.lastSeenAt) &&
      d.lastSeenAt >= cutoff,
  );
}

export async function enqueuePrintJob(
  locationId: string,
  job: StationPrintQueued,
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  if (!locationId || !job.printerId || !job.host || !job.escposBase64) {
    return { ok: false, error: "Printer target is required" };
  }
  await patchLocationSetup(locationId, (setup) => {
    const queue = pruneStationPrintQueue(parseStationPrintQueue(setup.stationPrintQueue));
    queue.unshift(job);
    return { ...setup, stationPrintQueue: capStationPrintQueue(queue) };
  });
  return { ok: true, jobId: job.id };
}

export async function claimPrintJob(opts: {
  locationId: string;
  workerId: string;
  role?: string | null;
}): Promise<StationPrintQueued | null> {
  const role = String(opts.role ?? "").trim() || "order";
  if (role === "kiosk") return null;
  const now = Date.now();
  const preferOnly =
    !isPreferredPrintWorkerRole(role) && (await preferredPrintWorkerOnline(opts.locationId, now));
  if (preferOnly) return null;

  let claimed: StationPrintQueued | null = null;
  await patchLocationSetup(opts.locationId, (setup) => {
    const queue = pruneStationPrintQueue(parseStationPrintQueue(setup.stationPrintQueue), now);
    const idx = queue.findIndex((j) => {
      if (!jobClaimableBy(j, opts.workerId, role, now)) return false;
      // A docked host still takes LAN jobs. USB stays on the station that owns the cable.
      if (preferOnly && !isUsbPrintJob(j)) return false;
      return true;
    });
    if (idx >= 0) {
      queue[idx] = { ...queue[idx]!, claimedBy: opts.workerId, claimedAt: now };
      claimed = queue[idx]!;
    }
    const stamp =
      role === PRINT_AGENT_WORKER || isPreferredPrintWorkerRole(role)
        ? { printAgentSeenAt: role === PRINT_AGENT_WORKER ? now : setup.printAgentSeenAt }
        : {};
    return { ...setup, stationPrintQueue: queue, ...stamp };
  });
  return claimed;
}

export async function completePrintJob(opts: {
  locationId: string;
  workerId: string;
  jobId: string;
  ok: boolean;
  usbAttached?: boolean;
}): Promise<boolean> {
  const now = Date.now();
  await patchLocationSetup(opts.locationId, (setup) => {
    const queue = pruneStationPrintQueue(parseStationPrintQueue(setup.stationPrintQueue), now);
    const job = queue.find((j) => j.id === opts.jobId);
    if (!job) return { ...setup, stationPrintQueue: queue };
    const stampUsb = typeof opts.usbAttached === "boolean";
    const devicesFor = (markPrint: boolean) =>
      parseLocationDevices(setup.locationDevices).map((d) => {
        if (d.id !== job.printerId || !d.print) return d;
        return {
          ...d,
          print: {
            ...d.print,
            ...(stampUsb ? { usbAttached: opts.usbAttached } : {}),
            ...(markPrint ? { lastPrintAt: now, reachability: "idle" as const } : {}),
          },
        };
      });
    if (!opts.ok) {
      job.claimedBy = undefined;
      job.claimedAt = undefined;
      job.ok = false;
      if (stampUsb && job.printerId) {
        return { ...setup, stationPrintQueue: queue, locationDevices: devicesFor(false) };
      }
      return { ...setup, stationPrintQueue: queue };
    }
    job.doneAt = now;
    job.ok = true;
    job.claimedBy = opts.workerId;
    if (job.printerId) {
      return { ...setup, stationPrintQueue: queue, locationDevices: devicesFor(true) };
    }
    return { ...setup, stationPrintQueue: queue };
  });
  return true;
}

/** The station that owns a USB printer reports whether a printer is plugged in. */
export async function noteUsbAttached(opts: {
  locationId: string;
  deviceId: string;
  attached: boolean;
}): Promise<void> {
  await patchLocationSetup(opts.locationId, (setup) => {
    const devices = parseLocationDevices(setup.locationDevices);
    const station = devices.find((d) => d.id === opts.deviceId);
    const next = devices.map((d) => {
      if (!d.print || d.print.link !== "usb") return d;
      const bound = d.print.boundStationIds ?? [];
      const owns =
        bound.includes(opts.deviceId) ||
        station?.receiptPrinterId === d.id ||
        (station?.orderPrinterIds ?? []).includes(d.id);
      if (!owns) return d;
      if (d.print.usbAttached === opts.attached) return d;
      return { ...d, print: { ...d.print, usbAttached: opts.attached } };
    });
    return { ...setup, locationDevices: next };
  });
}

export async function countWaitingKitchenPrint(locationId: string): Promise<number> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where id = ${locationId} limit 1
  `;
  const setup = rows[0]?.setup;
  const queue = parseStationPrintQueue(
    setup && typeof setup === "object" && !Array.isArray(setup)
      ? (setup as Record<string, unknown>).stationPrintQueue
      : [],
  );
  return countWaitingKitchenPrints(pruneStationPrintQueue(queue));
}

export async function readPrintAgentToken(locationId: string): Promise<string> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where id = ${locationId} limit 1
  `;
  const setup = rows[0]?.setup;
  if (!setup || typeof setup !== "object" || Array.isArray(setup)) return "";
  return String((setup as Record<string, unknown>).printAgentToken ?? "").trim();
}

export async function assertPrintAgentAccess(
  locationId: string,
  token: string | undefined,
): Promise<boolean> {
  if (!locationId) return false;
  const stored = await readPrintAgentToken(locationId);
  const given = String(token ?? "").trim();
  if (stored) return stored === given;
  return true;
}

export { PRINT_AGENT_WORKER };
