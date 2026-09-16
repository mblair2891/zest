import { formatCurrency } from "@/lib/utils";
import type { PrintJob } from "./types";
import { groupLinesByEntity } from "@/lib/payments/entity-split";
import { formatTurnInSlipLines } from "@/lib/pos/till-turn-in-slip";
import {
  colsForPaperWidth,
  printerModelSpec,
  type PrinterCutter,
  type PrinterEmulation,
  type PrinterModelPreset,
  type PrinterPaperMm,
} from "./printer-models";

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
  // ESC/POS is 7-bit; keep tab/LF/CR and printable ASCII.
  // eslint-disable-next-line no-control-regex -- strip non-printable bytes for thermal printers
  return ENC.encode(s.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "?"));
}

const INIT = u8(0x1b, 0x40);
const ALIGN_CT = u8(0x1b, 0x61, 0x01);
const ALIGN_LT = u8(0x1b, 0x61, 0x00);
const BOLD_ON = u8(0x1b, 0x45, 0x01);
const BOLD_OFF = u8(0x1b, 0x45, 0x00);
const DBL_ON = u8(0x1d, 0x21, 0x11);
const DBL_OFF = u8(0x1d, 0x21, 0x00);
const CUT_FULL = u8(0x1d, 0x56, 0x41, 0x10);
const CUT_PARTIAL = u8(0x1d, 0x56, 0x42, 0x10);
const CUT_STAR_LINE = u8(0x1b, 0x64, 0x03);
const FEED = u8(0x0a);

export type EscPosOptions = {
  emulation?: PrinterEmulation;
  paperWidthMm?: PrinterPaperMm;
  cutter?: PrinterCutter;
  modelPreset?: PrinterModelPreset;
};

function resolveOpts(opts?: EscPosOptions): {
  emulation: PrinterEmulation;
  width: number;
  cutter: PrinterCutter;
} {
  const spec = opts?.modelPreset ? printerModelSpec(opts.modelPreset) : null;
  const emulation = opts?.emulation ?? spec?.emulation ?? "escpos";
  const paper = opts?.paperWidthMm ?? spec?.paperWidthMm ?? 80;
  const cutter = opts?.cutter ?? spec?.cutter ?? "full";
  return { emulation, width: colsForPaperWidth(paper), cutter };
}

function cutBytes(emulation: PrinterEmulation, cutter: PrinterCutter): Uint8Array {
  if (cutter === "none") return concat([FEED, FEED, FEED, FEED]);
  if (emulation === "star_line") return concat([FEED, FEED, CUT_STAR_LINE]);
  if (cutter === "partial") return concat([FEED, CUT_PARTIAL]);
  return concat([FEED, CUT_FULL]);
}

function line(left: string, right = "", width = 42): Uint8Array {
  const l = left.slice(0, width);
  const r = right.slice(0, Math.max(0, width - l.length));
  const pad = Math.max(1, width - l.length - r.length);
  return concat([text(l + " ".repeat(pad) + r), FEED]);
}

/** Printer-kick pulse. Star/Epson/generic ESC p (drawer 1). */
export function buildDrawerKickBytes(): Uint8Array {
  return concat([INIT, u8(0x1b, 0x70, 0x00, 0x19, 0xfa)]);
}

function qrPayload(data: string): Uint8Array {
  const d = text(data.slice(0, 80));
  const storeLen = d.length + 3;
  return concat([
    ALIGN_CT,
    u8(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00),
    u8(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04),
    u8(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31),
    u8(0x1d, 0x28, 0x6b, storeLen & 0xff, (storeLen >> 8) & 0xff, 0x31, 0x50, 0x30),
    d,
    u8(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30),
    FEED,
  ]);
}

function code128(data: string): Uint8Array {
  const d = text(data.slice(0, 32));
  return concat([
    ALIGN_CT,
    u8(0x1d, 0x68, 0x40),
    u8(0x1d, 0x77, 0x02),
    u8(0x1d, 0x48, 0x02),
    u8(0x1d, 0x6b, 0x49, d.length),
    d,
    FEED,
  ]);
}

function buildTillTurnInEscPos(job: PrintJob): Uint8Array {
  const slip = job.turnIn;
  const parts: Uint8Array[] = [INIT, ALIGN_LT];
  if (slip) {
    for (const ln of formatTurnInSlipLines(slip)) {
      if (ln.trim() === "TILL TURN-IN" || ln.trim() === "COPY" || ln.trim() === slip.storeName) {
        parts.push(ALIGN_CT, BOLD_ON, text(ln.trim()), FEED, BOLD_OFF, ALIGN_LT);
      } else if (ln.startsWith("TURN-IN CASH")) {
        parts.push(BOLD_ON, text(ln), FEED, BOLD_OFF);
      } else {
        parts.push(text(ln), FEED);
      }
    }
    parts.push(FEED, code128(slip.closeId), qrPayload(slip.closeId), ALIGN_LT);
  }
  parts.push(FEED, ALIGN_CT, text("Summex"), FEED, cutBytes("escpos", "full"));
  return concat(parts);
}

/** ESC/POS or Star Line bytes for a hospitality printer (LAN 9100). */
export function buildEscPos(job: PrintJob, opts?: EscPosOptions): Uint8Array {
  if (job.kind === "drawer_kick") return buildDrawerKickBytes();
  if (job.kind === "till_turn_in") return buildTillTurnInEscPos(job);
  const { emulation, width, cutter } = resolveOpts(opts);
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
    text(title + (job.copy === "merchant" ? " MERCH" : "")),
    FEED,
    BOLD_OFF,
    ALIGN_LT,
    line(`#${job.checkNumber}`, job.tableLabel, width),
    line(job.serverName, new Date(job.at).toLocaleTimeString(), width),
  ];
  if (job.operatorName) parts.push(line(job.operatorName, "", width));
  parts.push(text("-".repeat(width)), FEED);
  const groups = groupLinesByEntity(job.items, job.locationName);
  for (const g of groups) {
    if (groups.length > 1) {
      parts.push(BOLD_ON, line(g.displayName.toUpperCase(), "", width), BOLD_OFF);
    }
    for (const it of g.lines) {
      const amt =
        typeof it.amountCents === "number" ? formatCurrency(it.amountCents) : "";
      parts.push(BOLD_ON, line(`${it.qty}x ${it.name}`, amt, width), BOLD_OFF);
      for (const m of it.mods ?? []) parts.push(line(`  ${m}`, "", width));
      if (it.note) parts.push(line(`  * ${it.note}`, "", width));
      if (it.seat != null) parts.push(line(`  seat ${it.seat}`, "", width));
    }
  }
  if (job.totals) {
    parts.push(text("-".repeat(width)), FEED);
    parts.push(line("Subtotal", formatCurrency(job.totals.subtotalCents), width));
    parts.push(line("Tax", formatCurrency(job.totals.taxCents), width));
    if (job.totals.tipCents) parts.push(line("Tip", formatCurrency(job.totals.tipCents), width));
    if (job.totals.giftCents) parts.push(line("Gift", formatCurrency(job.totals.giftCents), width));
    parts.push(BOLD_ON, line("Total", formatCurrency(job.totals.totalCents), width), BOLD_OFF);
    if (job.totals.tender) parts.push(line(job.totals.tender, "", width));
    if (job.copy === "guest" && groups.length > 1) {
      parts.push(line("Card: one authorization, split to the vendors above", "", width));
    }
    if (job.copy === "merchant" && job.allocations && job.allocations.length) {
      parts.push(text("-".repeat(width)), FEED);
      parts.push(BOLD_ON, line((job.operatorName || "MERCHANT").toUpperCase() + " SHARE", "", width), BOLD_OFF);
      for (const a of job.allocations) {
        parts.push(line(a.name, formatCurrency(a.totalCents), width));
        parts.push(line("  merch", formatCurrency(a.merchandiseCents), width));
        parts.push(line("  tax/tip/svc", formatCurrency(a.feesCents), width));
      }
      parts.push(line("Guest still paid once", "", width));
    }
  }
  if (job.qrUrl) {
    parts.push(FEED, ALIGN_CT, text(job.qrCaption || "Scan to pay this check"), FEED);
    parts.push(text(job.qrUrl.slice(0, width)), FEED);
  }
  if (job.kind === "test") {
    parts.push(
      FEED,
      ALIGN_CT,
      text(`${emulation.toUpperCase()} · ${width} col`),
      FEED,
    );
  }
  parts.push(FEED, ALIGN_CT, text("Quantum Payments · Summex"), FEED, cutBytes(emulation, cutter));
  return concat(parts);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export function escposBase64(job: PrintJob, opts?: EscPosOptions): string {
  const bytes = job.kind === "drawer_kick" ? buildDrawerKickBytes() : buildEscPos(job, opts);
  return bytesToBase64(bytes);
}
