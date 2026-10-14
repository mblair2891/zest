import { registerPlugin } from "@capacitor/core";
import { isNativeApp } from "@/lib/native-shell";
import { printAgentUrl } from "./dispatch";
import {
  mergeDiscoveredPrinters,
  parseDiscoveredPrinters,
  type DiscoveredPrinter,
} from "./printer-discover.ts";
import { scanLanPrintersFn } from "./api";

type PrinterScanPlugin = {
  scan: () => Promise<{ printers?: unknown; error?: string }>;
};

const PrinterScan = registerPlugin<PrinterScanPlugin>("PrinterScan");

/** Android station on the staff Wi-Fi. Null when this browser has no scan plugin. */
export async function scanNativePrinters(): Promise<DiscoveredPrinter[] | null> {
  if (!isNativeApp()) return null;
  try {
    const res = await PrinterScan.scan();
    return parseDiscoveredPrinters(res?.printers);
  } catch {
    return null;
  }
}

async function scanPrintAgent(): Promise<DiscoveredPrinter[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${printAgentUrl()}/scan`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { printers?: unknown };
    return parseDiscoveredPrinters(body.printers);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Find printers on the staff Wi-Fi.
 * The station app scans from the tablet. A laptop uses the print agent, then this host.
 */
export async function discoverPrinters(): Promise<{
  printers: DiscoveredPrinter[];
  source: "station" | "agent" | "host" | "none";
  error?: string;
}> {
  if (isNativeApp()) {
    const printers = await scanNativePrinters();
    if (printers) return { printers: mergeDiscoveredPrinters(printers), source: "station" };
  }
  const agent = await scanPrintAgent();
  if (agent && agent.length) return { printers: agent, source: "agent" };
  try {
    const host = await scanLanPrintersFn({ data: {} });
    if (host.printers.length) return { printers: host.printers, source: "host" };
    if (agent) return { printers: [], source: "agent", error: host.error };
    return { printers: [], source: host.error ? "none" : "host", error: host.error };
  } catch {
    return {
      printers: agent ?? [],
      source: agent ? "agent" : "none",
      error: "Scan from a station on the staff Wi-Fi.",
    };
  }
}
