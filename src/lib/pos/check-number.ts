/**
 * Visible check id: table (or TO / BAR) plus a sequence.
 * T1-03 · TO-03 · BAR-03
 * No date in the id — the ticket clock already has the venue time.
 * {seq} is per table, or per TO / BAR, for the venue-local calendar day.
 * Assigned at open from createdAt. Not rewritten when the day rolls.
 * Order id and createdAt stay the reporting keys.
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

/** Current id, or the previous dated form (260922-T1-03) still accepted on QR. */
const VISIBLE = /^(?:(\d{6})-)?((?:BAR|TO)|T[A-Za-z0-9]+)-(\d+)$/;

export function venueDayKey(atMs: number, timeZone?: string): string {
  return venueDayYmd(atMs, timeZone);
}

export function tableToken(label: string | null | undefined): string {
  let s = String(label ?? "").trim().replace(/^table\s+/i, "");
  if (/^t\d+$/i.test(s)) s = s.slice(1);
  s = s.replace(/[^A-Za-z0-9]/g, "");
  return s || "0";
}

export type CheckChannel = "table" | "to" | "bar" | "kiosk";

/** Bar tabs use BAR. Kiosk uses TKIOSK. Seated dining uses the table. Everything else is to-go. */
export function checkChannel(type: string | undefined, tableLabel?: string | null): CheckChannel {
  if (type === "kiosk") return "kiosk";
  if (type === "bar_tab") return "bar";
  if (type === "dine_in" && String(tableLabel ?? "").trim()) return "table";
  return "to";
}

export function checkStem(type: string | undefined, tableLabel?: string | null): string {
  const channel = checkChannel(type, tableLabel);
  if (channel === "kiosk") return "TKIOSK";
  if (channel === "bar") return "BAR";
  if (channel === "to") return "TO";
  return `T${tableToken(tableLabel)}`;
}

export function formatCheckNumber(opts: {
  channel: CheckChannel;
  tableLabel?: string | null;
  seq: number;
  type?: string;
}): string {
  const seq = String(Math.max(1, Math.floor(opts.seq))).padStart(2, "0");
  const stem =
    opts.channel === "kiosk" || opts.type === "kiosk"
      ? "TKIOSK"
      : opts.channel === "bar"
        ? "BAR"
        : opts.channel === "to"
          ? "TO"
          : `T${tableToken(opts.tableLabel)}`;
  return `${stem}-${seq}`;
}

export function parseCheckNumber(number: unknown): { stem: string; seq: number } | null {
  const m = VISIBLE.exec(String(number ?? "").trim());
  if (!m) return null;
  const seq = Number(m[3]);
  if (!Number.isFinite(seq)) return null;
  return { stem: m[2]!, seq };
}

export function nextCheckNumber(opts: {
  orders: { number?: unknown; createdAt?: number }[];
  atMs: number;
  timeZone?: string;
  type?: string;
  tableLabel?: string | null;
}): string {
  const day = venueDayKey(opts.atMs, opts.timeZone);
  const stem = checkStem(opts.type, opts.tableLabel);
  let max = 0;
  for (const o of opts.orders) {
    if (o.createdAt == null) continue;
    if (venueDayKey(o.createdAt, opts.timeZone) !== day) continue;
    const parsed = parseCheckNumber(o.number);
    if (!parsed || parsed.stem !== stem) continue;
    if (parsed.seq > max) max = parsed.seq;
  }
  return formatCheckNumber({
    channel: checkChannel(opts.type, opts.tableLabel),
    tableLabel: opts.tableLabel,
    seq: max + 1,
  });
}

/** QR ?check= value. Accepts T1-01, TO-01, BAR-01, a legacy dated id, or an integer. */
export function readCheckParam(raw: unknown): CheckNo | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  if (VISIBLE.test(s)) return s;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n > 0 ? n : undefined;
  }
  return undefined;
}

export function sameCheckNo(a: unknown, b: unknown): boolean {
  return String(a ?? "") === String(b ?? "") && String(a ?? "") !== "";
}
