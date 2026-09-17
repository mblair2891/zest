/** Star SP700 / SP742 / SP712 9-pin impact (IFBD). Star Line text — not TM-T20 thermal. */

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
  // CP437 printable: ASCII 0x20-0x7E. Never emit GS/ESC as text.
  return new TextEncoder().encode(s.replace(/[^\x20-\x7e]/g, "?"));
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = u8(0x0a);
/** ESC @ init, ESC P 7x9, ESC GS t 0 = CP437, ESC GS a 0 left, ESC F / ESC W 0 cancel. */
const INIT = u8(
  ESC, 0x40,
  ESC, 0x50,
  ESC, GS, 0x74, 0x00,
  ESC, GS, 0x61, 0x00,
  ESC, 0x46,
  ESC, 0x57, 0x00,
);
const ALIGN_CT = u8(ESC, GS, 0x61, 0x01);
const ALIGN_LT = u8(ESC, GS, 0x61, 0x00);
const EMPH_ON = u8(ESC, 0x45);
const EMPH_OFF = u8(ESC, 0x46);
/** Double-height for the KITCHEN (or BAR/EXPO) banner only — not GS ! */
const HIGH_ON = u8(ESC, 0x68, 0x01);
const HIGH_OFF = u8(ESC, 0x68, 0x00);
/** SP700 auto-cutter (Star Line ESC d 3), not TM-T88 GS V 65. */
const CUT = u8(ESC, 0x64, 0x03);

export type StarImpactJob = {
  locationName: string;
  kind: string;
  station?: string;
  copy?: string;
  checkNumber: string | number;
  tableLabel: string;
  serverName: string;
  operatorName?: string | null;
  items: Array<{ qty: number; name: string; mods?: string[]; note?: string; seat?: number }>;
  at: number;
};

function line(left: string, right = "", width = SP700_COLS): Uint8Array {
  const l = left.slice(0, width);
  const r = right.slice(0, Math.max(0, width - l.length));
  const pad = Math.max(1, width - l.length - r.length);
  return concat([ascii(l + " ".repeat(pad) + r), LF]);
}

function banner(job: StarImpactJob): string {
  if (job.kind === "receipt") return "RECEIPT";
  if (job.kind === "test") return "TEST PRINT";
  if (job.station === "bar") return "BAR";
  if (job.station === "expo") return "EXPO";
  return "KITCHEN";
}

export function buildStarSp700Bytes(job: StarImpactJob): Uint8Array {
  const title = banner(job) + (job.copy === "merchant" ? " MERCH" : "");
  const house = job.locationName.replace(/[^\x20-\x7e]/g, "?").slice(0, 20);
  const parts: Uint8Array[] = [
    INIT,
    ALIGN_CT,
    EMPH_ON,
    ascii(house),
    LF,
    HIGH_ON,
    ascii(title),
    LF,
    HIGH_OFF,
    EMPH_OFF,
    ALIGN_LT,
    line(`#${job.checkNumber}`, job.tableLabel),
    line(job.serverName, new Date(job.at).toLocaleTimeString()),
  ];
  if (job.operatorName) parts.push(line(job.operatorName));
  parts.push(ascii("-".repeat(SP700_COLS)), LF);
  for (const it of job.items) {
    parts.push(EMPH_ON, line(`${it.qty}x ${it.name}`), EMPH_OFF);
    for (const m of it.mods ?? []) parts.push(line(`  ${m}`));
    if (it.note) parts.push(line(`  * ${it.note}`));
    if (it.seat != null) parts.push(line(`  seat ${it.seat}`));
  }
  if (job.kind === "test") {
    parts.push(LF, ALIGN_CT, ascii("Star SP700 impact 7x9 CP437"), LF, ALIGN_LT);
  }
  parts.push(LF, ALIGN_CT, ascii("Summex"), LF, LF, CUT);
  return concat(parts);
}

export function starSp700HasThermalRaster(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length - 1; i += 1) {
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x21) return true;
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x76) return true;
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x56 && bytes[i + 2] === 0x41) return true;
  }
  return false;
}
