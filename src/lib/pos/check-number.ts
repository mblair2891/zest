/**
 * Venue-local daily check numbers.
 * YYMMDD-T{table}-{seq} · YYMMDD-TO-{seq} · YYMMDD-BAR-{seq}
 * {seq} is one counter per venue per calendar day in the venue IANA zone.
 * Assigned at open and never rewritten when the day rolls.
 */
function zone(timeZone?: string): string {
  const s = String(timeZone ?? "").trim() || "America/Los_Angeles";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: s }).format(0);
    return s;
  } catch {
    return "America/Los_Angeles";
  }
}

function venueDayYmd(atMs: number, timeZone?: string): string {
  const tz = zone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(atMs));
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const mo = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${mo}-${d}`;
  } catch {
    return "1970-01-01";
  }
}

export type CheckNo = string | number;

const DAILY = /^(\d{6})-(T[A-Za-z0-9]+|TO|BAR)-(\d+)$/;

export function venueDayPrefix(atMs: number, timeZone?: string): string {
  const ymd = venueDayYmd(atMs, timeZone);
  const [y, m, d] = ymd.split("-");
  return `${(y || "1970").slice(2)}${m || "01"}${d || "01"}`;
}

export function tableToken(label: string | null | undefined): string {
  let s = String(label ?? "").trim().replace(/^table\s+/i, "");
  if (/^t\d+$/i.test(s)) s = s.slice(1);
  s = s.replace(/[^A-Za-z0-9]/g, "");
  return s || "0";
}

export type CheckChannel = "table" | "to" | "bar";

/** Bar tabs use BAR. Seated dining uses the table. Everything else is to-go. */
export function checkChannel(type: string | undefined, tableLabel?: string | null): CheckChannel {
  if (type === "bar_tab") return "bar";
  if (type === "dine_in" && String(tableLabel ?? "").trim()) return "table";
  return "to";
}

export function formatCheckNumber(opts: {
  atMs: number;
  timeZone?: string;
  channel: CheckChannel;
  tableLabel?: string | null;
  seq: number;
}): string {
  const day = venueDayPrefix(opts.atMs, opts.timeZone);
  const seq = String(Math.max(1, Math.floor(opts.seq))).padStart(2, "0");
  if (opts.channel === "bar") return `${day}-BAR-${seq}`;
  if (opts.channel === "to") return `${day}-TO-${seq}`;
  return `${day}-T${tableToken(opts.tableLabel)}-${seq}`;
}

/** Seq already used on this venue day, or null if this number is not from that day. */
export function checkSeqOnDay(number: unknown, dayPrefix: string): number | null {
  const m = DAILY.exec(String(number ?? "").trim());
  if (!m || m[1] !== dayPrefix) return null;
  const n = Number(m[3]);
  return Number.isFinite(n) ? n : null;
}

export function nextCheckNumber(opts: {
  orders: { number?: unknown }[];
  atMs: number;
  timeZone?: string;
  type?: string;
  tableLabel?: string | null;
}): string {
  const day = venueDayPrefix(opts.atMs, opts.timeZone);
  let max = 0;
  for (const o of opts.orders) {
    const n = checkSeqOnDay(o.number, day);
    if (n != null && n > max) max = n;
  }
  return formatCheckNumber({
    atMs: opts.atMs,
    timeZone: opts.timeZone,
    channel: checkChannel(opts.type, opts.tableLabel),
    tableLabel: opts.tableLabel,
    seq: max + 1,
  });
}

/** QR ?check= value. Keeps the daily id; still accepts a legacy integer. */
export function readCheckParam(raw: unknown): CheckNo | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  if (DAILY.test(s)) return s;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n > 0 ? n : undefined;
  }
  return undefined;
}

export function sameCheckNo(a: unknown, b: unknown): boolean {
  return String(a ?? "") === String(b ?? "") && String(a ?? "") !== "";
}
