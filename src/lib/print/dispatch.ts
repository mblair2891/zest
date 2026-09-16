import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  isPrinterDevice,
  printerHasDrawerKick,
  routeForPrintStation,
  type LocationDevice,
  type PrintStation,
} from "@/lib/pos/location-devices";
import { uid } from "@/lib/utils";
import { escposBase64, buildDrawerKickBytes } from "./escpos";
import { ticketHtml } from "./ticket-html";
import { parseLanTarget } from "./printer-models";
import { rawLanPrintFn } from "./api";
import {
  DEFAULT_PRINT_AGENT_URL,
  type AgentPrintRequest,
  type PrintJob,
  type PrintTarget,
} from "./types";

export function printAgentUrl(): string {
  try {
    const custom = localStorage.getItem("summex-print-agent");
    if (custom && /^https?:\/\//i.test(custom)) return custom.replace(/\/$/, "");
  } catch {
    /* */
  }
  return DEFAULT_PRINT_AGENT_URL;
}

export function printersForStation(
  devices: LocationDevice[] | undefined,
  station: PrintStation,
  operatorId?: string | null,
  stationDeviceId?: string | null,
): LocationDevice[] {
  const route = routeForPrintStation(station);
  const list = (devices ?? []).filter((d) => {
    if (!isPrinterDevice(d) || d.status === "inactive") return false;
    const routes = d.print?.routes?.length ? d.print.routes : null;
    if (routes) return routes.includes(route);
    return d.print?.station === station;
  });
  const bound = stationDeviceId
    ? list.filter(
        (d) =>
          !d.print?.boundStationIds?.length ||
          d.print.boundStationIds.includes(stationDeviceId),
      )
    : list;
  const pool = bound.length ? bound : list;
  if (!operatorId || operatorId === HOST_SCOPE) return pool;
  const scoped = pool.filter(
    (d) => d.assignment.operatorId === HOST_SCOPE || d.assignment.operatorId === operatorId,
  );
  return scoped.length ? scoped : pool.filter((d) => d.assignment.operatorId === HOST_SCOPE);
}

function printHtml(html: string): void {
  if (typeof document === "undefined") return;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => iframe.remove(), 1500);
    }
  };
  if (iframe.contentWindow?.document.readyState === "complete") run();
  else iframe.onload = run;
}

async function sendToAgent(req: AgentPrintRequest): Promise<boolean> {
  const url = `${printAgentUrl()}/print`;
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(t);
  }
}

/**
 * Turn-in bag slip. Prefers the named receipt printer, then station receipt printers.
 * Agent printers must succeed; browser-only stations count as printed (preview).
 */
export async function dispatchReceiptStationJob(
  job: PrintJob,
  devices: LocationDevice[] | undefined,
  opts?: { printerId?: string | null; copies?: 1 | 2 },
): Promise<{ ok: boolean; printed: number; copiesPrinted?: number; error?: string }> {
  const res = await dispatchTurnInSlip(job, devices, opts);
  return { ...res, copiesPrinted: res.printed };
}

export async function dispatchTurnInSlip(
  job: PrintJob,
  devices: LocationDevice[] | undefined,
  opts?: { printerId?: string | null; copies?: 1 | 2 },
): Promise<{ ok: boolean; printed: number; error?: string }> {
  const copies = opts?.copies === 2 ? 2 : 1;
  const all = (devices ?? []).filter((d) => isPrinterDevice(d) && d.status !== "inactive");
  const named = opts?.printerId ? all.find((d) => d.id === opts.printerId) : undefined;
  const receipts = printersForStation(devices, "receipt", job.operatorId);
  const targets = named ? [named] : receipts.length ? receipts : all.filter((d) => d.print?.station === "receipt");
  const agentTargets = targets.filter((p) => p.print && p.print.connection !== "browser" && p.print.target);

  let printed = 0;
  for (let i = 0; i < copies; i += 1) {
    const copyJob: PrintJob = i === 0 ? job : { ...job, id: uid("prn"), turnIn: job.turnIn };
    if (agentTargets.length) {
      let any = false;
      for (const p of agentTargets) {
        const cfg = p.print;
        if (!cfg?.target) continue;
        const ok = await sendToAgent({
          locationId: copyJob.locationId,
          printerId: p.id,
          family: cfg.family,
          connection: cfg.connection,
          target: cfg.target,
          job: copyJob,
          escposBase64: escposBase64(copyJob),
        });
        if (ok) {
          any = true;
          printed += 1;
        }
      }
      if (!any) {
        return { ok: false, printed, error: "Count is saved. Reprint required before drop." };
      }
    } else {
      printHtml(ticketHtml(copyJob));
      printed += 1;
    }
  }
  if (printed === 0) {
    return { ok: false, printed: 0, error: "Count is saved. Reprint required before drop." };
  }
  return { ok: true, printed };
}

export async function dispatchPrintJob(
  job: PrintJob,
  devices: LocationDevice[] | undefined,
  opts?: { forceBrowser?: boolean; printerId?: string | null },
): Promise<{ printed: number; browser: boolean; agent: number; error?: string }> {
  const named = opts?.printerId
    ? (devices ?? []).find(
        (d) => d.id === opts.printerId && isPrinterDevice(d) && d.status !== "inactive",
      )
    : undefined;
  const printers = named
    ? [named]
    : printersForStation(devices, job.station, job.operatorId);
  const html = ticketHtml(job);
  let agent = 0;

  if (opts?.forceBrowser) {
    printHtml(html);
    return { printed: 1, browser: true, agent: 0 };
  }

  for (const p of printers) {
    const cfg = p.print;
    if (!cfg) continue;
    const lan = parseLanTarget(cfg.ip, cfg.port, cfg.target);
    if (!lan) continue;
    const payload = escposBase64(job, {
      modelPreset: cfg.modelPreset,
      emulation: cfg.emulation,
      paperWidthMm: cfg.paperWidthMm,
      cutter: cfg.cutter,
    });
    const ok = await sendToAgent({
      locationId: job.locationId,
      printerId: p.id,
      family: cfg.family,
      connection: "lan",
      target: lan.target,
      job,
      escposBase64: payload,
    });
    if (ok) agent += 1;
  }

  if (agent === 0) {
    return {
      printed: 0,
      browser: false,
      agent: 0,
      error: "Could not reach the printer at IP:9100. Run the LAN print agent on the staff network.",
    };
  }
  return { printed: agent, browser: false, agent };
}

/** Test print: raw bytes to IP:9100. Never window.print / OS dialog. */
export async function dispatchRawTestPrint(
  job: PrintJob,
  device: LocationDevice,
): Promise<{ ok: boolean; error?: string; target?: string }> {
  const cfg = device.print;
  const lan = parseLanTarget(cfg?.ip, cfg?.port, cfg?.target);
  if (!lan) {
    return {
      ok: false,
      error: "Add a static IP. Test print sends raw bytes to port 9100 — not the OS print dialog.",
    };
  }
  const payload = escposBase64(job, {
    modelPreset: cfg?.modelPreset,
    emulation: cfg?.emulation,
    paperWidthMm: cfg?.paperWidthMm,
    cutter: cfg?.cutter,
  });
  const viaAgent = await sendToAgent({
    locationId: job.locationId,
    printerId: device.id,
    family: cfg?.family ?? "generic",
    connection: "lan",
    target: lan.target,
    job,
    escposBase64: payload,
  });
  if (viaAgent) return { ok: true, target: lan.target };
  try {
    const viaStation = await rawLanPrintFn({
      data: { target: lan.target, ip: lan.host, port: lan.port, escposBase64: payload },
    });
    if (viaStation.ok) return { ok: true, target: lan.target };
    return {
      ok: false,
      target: lan.target,
      error:
        viaStation.error ||
        `Could not reach ${lan.target}. Run the LAN print agent on the hub or a paired station.`,
    };
  } catch (e) {
    return {
      ok: false,
      target: lan.target,
      error:
        e instanceof Error
          ? e.message
          : `Could not reach ${lan.target}. Run the LAN print agent on the hub or a paired station.`,
    };
  }
}

export function testPrintJob(opts: {
  locationId: string;
  locationName: string;
  station: PrintStation;
}): PrintJob {
  return {
    id: uid("prn"),
    kind: "test",
    station: opts.station,
    locationId: opts.locationId,
    locationName: opts.locationName,
    checkId: "test",
    checkNumber: "TEST",
    tableLabel: "Printer test",
    serverName: "Hardware",
    items: [{ qty: 1, name: "Summex test print", note: opts.station }],
    at: Date.now(),
  };
}

export async function kickCashDrawer(opts: {
  locationId: string;
  devices: LocationDevice[] | undefined;
  printerId: string | null | undefined;
}): Promise<boolean> {
  const printers = (opts.devices ?? []).filter((d) => isPrinterDevice(d) && d.status !== "inactive");
  const target = opts.printerId
    ? printers.find((d) => d.id === opts.printerId)
    : printers.find((d) => printerHasDrawerKick(d));
  if (!target?.print || !printerHasDrawerKick(target) || target.print.connection === "browser" || !target.print.target) {
    return false;
  }
  const job: PrintJob = {
    id: uid("kick"),
    kind: "drawer_kick",
    station: "receipt",
    locationId: opts.locationId,
    locationName: "Kick",
    checkId: "kick",
    checkNumber: "",
    tableLabel: "",
    serverName: "",
    items: [],
    at: Date.now(),
  };
  const bytes = buildDrawerKickBytes();
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return sendToAgent({
    locationId: opts.locationId,
    printerId: target.id,
    family: target.print.family,
    connection: target.print.connection,
    target: target.print.target,
    job,
    escposBase64: btoa(bin),
  });
}

export function describeTarget(p: PrintTarget): string {
  const c = p.config;
  if (c.connection === "browser" || !c.target) return "Browser print";
  return `${c.connection} ${c.target}`;
}
