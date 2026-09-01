import { HOST_SCOPE } from "@/lib/access/entity-grants";
import type { LocationDevice, PrintStation } from "@/lib/pos/location-devices";
import { uid } from "@/lib/utils";
import { escposBase64, buildDrawerKickBytes } from "./escpos";
import { ticketHtml } from "./ticket-html";
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
): LocationDevice[] {
  const list = (devices ?? []).filter(
    (d) =>
      d.type === "printer" &&
      d.status !== "inactive" &&
      d.print?.station === station,
  );
  if (!operatorId || operatorId === HOST_SCOPE) return list;
  const scoped = list.filter(
    (d) => d.assignment.operatorId === HOST_SCOPE || d.assignment.operatorId === operatorId,
  );
  return scoped.length ? scoped : list.filter((d) => d.assignment.operatorId === HOST_SCOPE);
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

export async function dispatchPrintJob(
  job: PrintJob,
  devices: LocationDevice[] | undefined,
  opts?: { forceBrowser?: boolean },
): Promise<{ printed: number; browser: boolean; agent: number }> {
  const printers = printersForStation(devices, job.station, job.operatorId);
  const html = ticketHtml(job);
  const bytes = escposBase64(job);
  let agent = 0;
  let browser = false;

  if (opts?.forceBrowser || printers.length === 0) {
    printHtml(html);
    return { printed: 1, browser: true, agent: 0 };
  }

  for (const p of printers) {
    const cfg = p.print;
    if (!cfg) continue;
    if (cfg.connection === "browser" || !cfg.target) {
      if (!browser) {
        printHtml(html);
        browser = true;
      }
      continue;
    }
    const ok = await sendToAgent({
      locationId: job.locationId,
      printerId: p.id,
      family: cfg.family,
      connection: cfg.connection,
      target: cfg.target,
      job,
      escposBase64: bytes,
    });
    if (ok) agent += 1;
    else if (!browser) {
      printHtml(html);
      browser = true;
    }
  }

  if (agent === 0 && !browser) {
    printHtml(html);
    browser = true;
  }
  return { printed: agent + (browser ? 1 : 0), browser, agent };
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
  const printers = (opts.devices ?? []).filter((d) => d.type === "printer" && d.status !== "inactive");
  const target = opts.printerId
    ? printers.find((d) => d.id === opts.printerId)
    : printers.find((d) => d.print?.station === "receipt");
  if (!target?.print || target.print.connection === "browser" || !target.print.target) {
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
