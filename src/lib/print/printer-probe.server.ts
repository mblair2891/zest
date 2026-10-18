import { patchLocationSetup } from "./queue.server.ts";
import {
  parsePrinterProbeTargets,
  parsePrinterProbeTicket,
  type PrinterProbeResult,
  type PrinterProbeTarget,
  type PrinterProbeTicket,
} from "./printer-probe-ticket.ts";

const FRESH_MS = 20_000;

export async function requestPrinterProbe(
  locationId: string,
  targets: PrinterProbeTarget[],
): Promise<PrinterProbeTicket | null> {
  const parsed = parsePrinterProbeTargets(targets);
  if (!parsed.length) return null;
  const now = Date.now();
  const ticket: PrinterProbeTicket = {
    id: `pp_${now.toString(36)}`,
    requestedAt: now,
    status: "pending",
    targets: parsed,
    results: [],
    error: "",
    finishedAt: 0,
  };
  await patchLocationSetup(locationId, (setup) => ({ ...setup, printerProbe: ticket }));
  return ticket;
}

export async function readPrinterProbe(locationId: string): Promise<PrinterProbeTicket | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ setup: unknown }>`
    select setup from locations where id = ${locationId} limit 1
  `;
  const setup = rows[0]?.setup;
  if (!setup || typeof setup !== "object" || Array.isArray(setup)) return null;
  return parsePrinterProbeTicket((setup as Record<string, unknown>).printerProbe);
}

export async function pullPrinterProbe(locationId: string): Promise<PrinterProbeTicket | null> {
  const ticket = await readPrinterProbe(locationId);
  if (!ticket || ticket.status !== "pending") return null;
  if (Date.now() - ticket.requestedAt > FRESH_MS) return null;
  if (!ticket.targets.length) return null;
  return ticket;
}

export async function finishPrinterProbe(opts: {
  locationId: string;
  id: string;
  results: PrinterProbeResult[];
  error?: string;
}): Promise<PrinterProbeTicket | null> {
  const error = String(opts.error ?? "").slice(0, 180);
  let saved: PrinterProbeTicket | null = null;
  await patchLocationSetup(opts.locationId, (setup) => {
    const current = parsePrinterProbeTicket(setup.printerProbe);
    if (!current || current.id !== opts.id || current.status !== "pending") return setup;
    const allowed = new Set(current.targets.map((target) => target.id));
    const results = opts.results.filter((row) => allowed.has(row.id));
    saved = {
      ...current,
      status: error && !results.length ? "error" : "done",
      results,
      error,
      finishedAt: Date.now(),
    };
    return { ...setup, printerProbe: saved };
  });
  return saved;
}
