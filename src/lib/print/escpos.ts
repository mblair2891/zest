import { formatCurrency } from "@/lib/utils";
import type { PrintJob } from "./types";

const ENC = new TextEncoder();

function u8(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function text(s: string): Uint8Array {
  return ENC.encode(s.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "?"));
}

const INIT = u8(0x1b, 0x40);
const ALIGN_CT = u8(0x1b, 0x61, 0x01);
const ALIGN_LT = u8(0x1b, 0x61, 0x00);
const BOLD_ON = u8(0x1b, 0x45, 0x01);
const BOLD_OFF = u8(0x1b, 0x45, 0x00);
const DBL_ON = u8(0x1d, 0x21, 0x11);
const DBL_OFF = u8(0x1d, 0x21, 0x00);
const CUT = u8(0x1d, 0x56, 0x41, 0x10);
const FEED = u8(0x0a);

function line(left: string, right = "", width = 42): Uint8Array {
  const l = left.slice(0, width);
  const r = right.slice(0, Math.max(0, width - l.length));
  const pad = Math.max(1, width - l.length - r.length);
  return concat([text(l + " ".repeat(pad) + r), FEED]);
}

/** ESC/POS bytes for Star / Epson / generic thermal (cut + init). */
export function buildEscPos(job: PrintJob): Uint8Array {
  const title =
    job.kind === "receipt"
      ? "RECEIPT"
      : job.kind === "test"
        ? "TEST PRINT"
        : job.station === "bar"
          ? "BAR"
          : job.station === "expo"
            ? "EXPO"
            : "KITCHEN";
  const parts: Uint8Array[] = [
    INIT,
    ALIGN_CT,
    BOLD_ON,
    DBL_ON,
    text(job.locationName.slice(0, 20)),
    FEED,
    DBL_OFF,
    text(title),
    FEED,
    BOLD_OFF,
    ALIGN_LT,
    line(`#${job.checkNumber}`, job.tableLabel),
    line(job.serverName, new Date(job.at).toLocaleTimeString()),
  ];
  if (job.operatorName) parts.push(line(job.operatorName));
  parts.push(text("-".repeat(42)), FEED);
  for (const it of job.items) {
    parts.push(BOLD_ON, line(`${it.qty}x ${it.name}`), BOLD_OFF);
    for (const m of it.mods ?? []) parts.push(line(`  ${m}`));
    if (it.note) parts.push(line(`  * ${it.note}`));
    if (it.seat != null) parts.push(line(`  seat ${it.seat}`));
  }
  if (job.totals) {
    parts.push(text("-".repeat(42)), FEED);
    parts.push(line("Subtotal", formatCurrency(job.totals.subtotalCents)));
    parts.push(line("Tax", formatCurrency(job.totals.taxCents)));
    parts.push(BOLD_ON, line("Total", formatCurrency(job.totals.totalCents)), BOLD_OFF);
    if (job.totals.tender) parts.push(line(job.totals.tender));
  }
  parts.push(FEED, ALIGN_CT, text("Quantum Payments · Summex"), FEED, FEED, CUT);
  return concat(parts);
}

export function escposBase64(job: PrintJob): string {
  const bytes = buildEscPos(job);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}
