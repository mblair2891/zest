import { patchLocationSetup } from "./queue.server.ts";
import {
  parseDiscoveredPrinters,
  parsePrinterScanTicket,
  type DiscoveredPrinter,
  type PrinterScanTicket,
} from "./printer-discover.ts";

const FRESH_MS = 40_000;

export async function requestPrinterScan(locationId: string): Promise<PrinterScanTicket> {
  const now = Date.now();
  let ticket: PrinterScanTicket = {
    id: `ps_${now.toString(36)}`,
    requestedAt: now,
    status: "pending",
    printers: [],
    error: "",
    finishedAt: 0,
  };
  await patchLocationSetup(locationId, (setup) => {
    const current = parsePrinterScanTicket(setup.printerScan);
    if (current && current.status === "pending" && now - current.requestedAt < FRESH_MS) {
      ticket = current;
      return setup;
    }
    return { ...setup, printerScan: ticket };
  });
  return ticket;
}

export async function readPrinterScan(locationId: string): Promise<PrinterScanTicket | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where id = ${locationId} limit 1
  `;
  const setup = rows[0]?.setup;
  if (!setup || typeof setup !== "object" || Array.isArray(setup)) return null;
  return parsePrinterScanTicket((setup as Record<string, unknown>).printerScan);
}

export async function pullPrinterScan(locationId: string): Promise<PrinterScanTicket | null> {
  const ticket = await readPrinterScan(locationId);
  if (!ticket || ticket.status !== "pending") return null;
  if (Date.now() - ticket.requestedAt > FRESH_MS) return null;
  return ticket;
}

export async function finishPrinterScan(opts: {
  locationId: string;
  id: string;
  printers: DiscoveredPrinter[];
  error?: string;
}): Promise<PrinterScanTicket | null> {
  const printers = parseDiscoveredPrinters(opts.printers);
  const error = String(opts.error ?? "").slice(0, 180);
  let saved: PrinterScanTicket | null = null;
  await patchLocationSetup(opts.locationId, (setup) => {
    const current = parsePrinterScanTicket(setup.printerScan);
    if (!current || current.id !== opts.id || current.status !== "pending") return setup;
    saved = {
      ...current,
      status: error && !printers.length ? "error" : "done",
      printers,
      error,
      finishedAt: Date.now(),
    };
    return { ...setup, printerScan: saved };
  });
  return saved;
}
