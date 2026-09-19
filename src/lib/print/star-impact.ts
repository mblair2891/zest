/** Star SP700 / SP742 / SP712 9-pin impact (IFBD). Star Line text — not TM-T20 thermal. */
import { formatVenueTime } from "@/lib/pos/venue-time";

export const SP700_COLS = 42;

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

function ascii(s: string): Uint8Array {
  return new TextEncoder().encode(s.replace(/[^\x20-\x7e]/g, "?"));
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = u8(0x0a);
/**
 * Star Line only: ESC @, ESC P (7x9), ESC GS t 0 (CP437).
 * No GS ! / GS v / GS V (thermal). No ESC E double-strike (blurry on 9-pin).
 */
const INIT = u8(ESC, 0x40, ESC, 0x50, ESC, GS, 0x74, 0x00);
/** Double-height for the destination banner only. */
const HIGH_ON = u8(ESC, 0x68, 0x01);
const HIGH_OFF = u8(ESC, 0x68, 0x00);
const CUT = u8(ESC, 0x64, 0x03);

export type StarImpactJob = {
  locationName: string;
  kind: string;
  station?: string;
  destinationName?: string;
  copy?: string;
  checkNumber: string | number;
  tableLabel: string;
  serverName: string;
  operatorName?: string | null;
  items: Array<{ qty: number; name: string; mods?: string[]; note?: string; seat?: number }>;
  at: number;
  timezone?: string;
};

function line(left: string, right = "", width = SP700_COLS): Uint8Array {
  const l = left.slice(0, width);
  const r = right.slice(0, Math.max(0, width - l.length));
  const pad = Math.max(1, width - l.length - r.length);
  return concat([ascii(l + " ".repeat(pad) + r), LF]);
}

function destinationBanner(job: StarImpactJob): string {
  const named = String(job.destinationName ?? "").trim().toUpperCase();
  if (named) return named.slice(0, SP700_COLS);
  if (job.kind === "receipt" || job.kind === "guest_check") return "CHECK";
  if (job.kind === "test") return "TEST PRINT";
  if (job.station === "bar") return "BAR";
  if (job.station === "expo") return "EXPO";
  return "KITCHEN";
}

export function buildStarSp700Bytes(job: StarImpactJob): Uint8Array {
  const house = job.locationName.replace(/[^\x20-\x7e]/g, "?").slice(0, SP700_COLS);
  const dest = destinationBanner(job);
  const time = formatVenueTime(job.at, job.timezone);
  const parts: Uint8Array[] = [
    INIT,
    ascii(house),
    LF,
    HIGH_ON,
    ascii(dest),
    LF,
    HIGH_OFF,
    line(job.serverName || "Server", time),
  ];
  if (job.tableLabel || job.checkNumber) {
    parts.push(line(job.tableLabel || "", `#${job.checkNumber}`));
  }
  if (job.operatorName) parts.push(line(String(job.operatorName)));
  parts.push(ascii("-".repeat(SP700_COLS)), LF);
  for (const it of job.items) {
    parts.push(line(`${it.qty} ${it.name}`));
    for (const m of it.mods ?? []) parts.push(line(`  ${m}`));
    if (it.note) parts.push(line(`  * ${it.note}`));
    if (it.seat != null) parts.push(line(`  seat ${it.seat}`));
  }
  if (job.kind === "test") {
    parts.push(LF, ascii("Star SP700 impact 7x9 CP437"), LF);
  }
  parts.push(LF, ascii("Summex"), LF, LF, CUT);
  return concat(parts);
}

export function starSp700HasThermalRaster(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length - 1; i += 1) {
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x21) return true;
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x76) return true;
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x56) return true;
    if (bytes[i] === ESC && bytes[i + 1] === 0x45) return true;
  }
  return false;
}
