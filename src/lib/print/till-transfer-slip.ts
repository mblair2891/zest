import { formatCurrency, uid } from "@/lib/utils";
import { formatMix, type TillTransfer } from "@/lib/pos/till-transfer";
import type { LocationDevice } from "@/lib/pos/location-devices";
import { dispatchReceiptStationJob } from "./dispatch";
import type { PrintJob } from "./types";

export const XFER_SLIP_WIDTH = 40;

function clip(s: string, n = XFER_SLIP_WIDTH): string {
  return s.slice(0, n);
}

function center(s: string, n = XFER_SLIP_WIDTH): string {
  const t = clip(s, n);
  const pad = Math.max(0, n - t.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + t + " ".repeat(pad - left);
}

function moneyLine(label: string, cents: number): string {
  const r = formatCurrency(cents);
  const pad = Math.max(1, XFER_SLIP_WIDTH - label.length - r.length);
  return clip(label + " ".repeat(pad) + r);
}

function wrap(s: string, n = XFER_SLIP_WIDTH): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= n) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w.slice(0, n);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function slipWhen(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildTillTransferSlipLines(opts: {
  row: TillTransfer;
  reprint: boolean;
}): string[] {
  const { row, reprint } = opts;
  const when = row.resolvedAt ?? row.requestedAt;
  const handed = formatMix(row.handedMix);
  const requested = formatMix(row.requestedMix);
  const lines: string[] = [center("TILL TRANSFER")];
  if (reprint) lines.push(center("COPY"));
  lines.push("");
  lines.push(clip(slipWhen(when)));
  lines.push(clip(`Transfer  ${row.id}`));
  lines.push("");
  lines.push(clip(`FROM  ${row.fromTillName}`));
  lines.push(clip(row.fromEmployeeName));
  lines.push(clip(`TO  ${row.toTillName}`));
  lines.push(clip(row.toEmployeeName));
  lines.push("");
  lines.push(moneyLine("AMOUNT", row.amountCents));
  if (handed) {
    lines.push(clip("Handed"));
    lines.push(...wrap(handed).map((l) => clip(l)));
  } else if (requested) {
    lines.push(clip("Requested mix"));
    lines.push(...wrap(requested).map((l) => clip(l)));
  }
  if (row.note) {
    lines.push("");
    lines.push(...wrap(row.note).map((l) => clip(l)));
  }
  lines.push("");
  lines.push(...wrap("Keep with drawer until drop / close.").map((l) => clip(l)));
  return lines.map((l) => clip(l));
}

export function tillTransferPrintJob(opts: {
  locationId: string;
  locationName: string;
  row: TillTransfer;
  reprint: boolean;
  operatorId?: string | null;
}): PrintJob {
  return {
    id: uid("prn"),
    kind: "till_transfer",
    station: "receipt",
    locationId: opts.locationId,
    locationName: opts.locationName,
    checkId: opts.row.id,
    checkNumber: opts.row.id,
    tableLabel: opts.row.toTillName,
    serverName: opts.row.toEmployeeName,
    operatorId: opts.operatorId,
    items: [],
    slipLines: buildTillTransferSlipLines({ row: opts.row, reprint: opts.reprint }),
    reprintCopy: opts.reprint,
    barcodeValue: opts.row.id,
    at: opts.row.resolvedAt ?? opts.row.requestedAt,
  };
}

export async function printTillTransferSlip(opts: {
  row: TillTransfer;
  reprint: boolean;
  copies: 1 | 2;
  locationId: string;
  locationName: string;
  devices: LocationDevice[] | undefined;
  operatorId?: string | null;
}): Promise<{ ok: boolean; copiesPrinted: number; error?: string }> {
  const copies = opts.copies === 2 ? 2 : 1;
  let printed = 0;
  let lastError: string | undefined;
  for (let i = 0; i < copies; i += 1) {
    const job = tillTransferPrintJob({
      locationId: opts.locationId,
      locationName: opts.locationName,
      row: opts.row,
      reprint: opts.reprint || i > 0,
      operatorId: opts.operatorId,
    });
    const res = await dispatchReceiptStationJob(job, opts.devices);
    if (res.ok) printed += 1;
    else lastError = "Receipt printer did not print the transfer slip.";
  }
  if (!printed) {
    return { ok: false, copiesPrinted: 0, error: lastError ?? "Print failed." };
  }
  return { ok: true, copiesPrinted: printed };
}
