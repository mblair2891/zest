/**
 * Venue station-update policy: force window (venue IANA) and prompt changelog.
 */
import { WHATS_NEW_ENTRIES } from "@/lib/whats-new/entries";
import type { GuideUpdate } from "@/lib/guide/types";
import { parseVenueTimezone } from "@/lib/pos/venue-time";

export const DEFAULT_FORCE_WINDOW = "04:00";
export const FORCE_WINDOW_DURATION_MIN = 60;

export type StationUpdatesConfig = {
  /** Daily start HH:MM in the venue timezone. Default 04:00. */
  forceWindow1: string;
  /** Optional second daily start HH:MM. Empty = off. */
  forceWindow2: string;
  /** List station-facing deploy notes on the update modal. Default on. */
  showChangeList: boolean;
  /** After missing the force window, Update now is required. Default on. */
  catchUpMandatory: boolean;
};

export function parseClockHm(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const m = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function parseStationUpdates(raw: unknown): StationUpdatesConfig {
  const o = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const w1 = parseClockHm(o.forceWindow1) ?? DEFAULT_FORCE_WINDOW;
  const w2raw = parseClockHm(o.forceWindow2) ?? "";
  const w2 = w2raw && w2raw !== w1 ? w2raw : "";
  return {
    forceWindow1: w1,
    forceWindow2: w2,
    showChangeList: o.showChangeList !== false,
    catchUpMandatory: o.catchUpMandatory !== false,
  };
}

export function forceWindowStarts(cfg: StationUpdatesConfig): string[] {
  return [cfg.forceWindow1, cfg.forceWindow2].filter(Boolean);
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((n) => Number(n));
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

/** Venue-local minutes past midnight (0–1439). */
export function venueMinutesPastMidnight(atMs: number, timeZone: string): number {
  const tz = parseVenueTimezone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(atMs));
    const hourRaw = parts.find((p) => p.type === "hour")?.value ?? "0";
    const minuteRaw = parts.find((p) => p.type === "minute")?.value ?? "0";
    let h = Number(hourRaw);
    if (h === 24) h = 0;
    const min = Number(minuteRaw);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return 0;
    return ((h % 24) * 60 + (min % 60) + 1440) % 1440;
  } catch {
    return 0;
  }
}

function inOneWindow(nowMin: number, startHm: string, durationMin: number): boolean {
  const start = hmToMinutes(startHm);
  const dur = Math.max(1, durationMin);
  const end = start + dur;
  if (end <= 1440) return nowMin >= start && nowMin < end;
  return nowMin >= start || nowMin < end - 1440;
}

export function inForceUpdateWindow(input: {
  atMs: number;
  timeZone: string;
  windows: string[];
  durationMin?: number;
}): boolean {
  const starts = input.windows.map((w) => parseClockHm(w)).filter((w): w is string => Boolean(w));
  if (!starts.length) return false;
  const nowMin = venueMinutesPastMidnight(input.atMs, input.timeZone);
  const dur = input.durationMin ?? FORCE_WINDOW_DURATION_MIN;
  return starts.some((hm) => inOneWindow(nowMin, hm, dur));
}

/** Venue-local calendar day YYYY-MM-DD. */
export function venueYmd(atMs: number, timeZone: string): string {
  const tz = parseVenueTimezone(timeZone);
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

/**
 * True when a force window already ended today (or a wrap that ended this morning)
 * and lastSeen was before that window ended — station was off/asleep through it.
 */
export function missedEndedForceWindow(input: {
  lastSeenMs: number;
  nowMs: number;
  timeZone: string;
  windows: string[];
  durationMin?: number;
}): boolean {
  const starts = input.windows.map((w) => parseClockHm(w)).filter((w): w is string => Boolean(w));
  if (!starts.length) return false;
  const tz = input.timeZone;
  const dur = input.durationMin ?? FORCE_WINDOW_DURATION_MIN;
  const nowMin = venueMinutesPastMidnight(input.nowMs, tz);
  const nowYmd = venueYmd(input.nowMs, tz);
  const lastMs = Math.max(0, Number(input.lastSeenMs) || 0);
  const lastMin = venueMinutesPastMidnight(lastMs, tz);
  const lastYmd = venueYmd(lastMs, tz);
  for (const hm of starts) {
    const start = hmToMinutes(hm);
    const end = start + Math.max(1, dur);
    if (end <= 1440) {
      if (nowMin < end) continue;
      if (lastYmd < nowYmd) return true;
      if (lastYmd === nowYmd && lastMin < end) return true;
      continue;
    }
    const wrapEnd = end - 1440;
    if (nowMin < wrapEnd) continue;
    if (lastYmd < nowYmd) return true;
    if (lastYmd === nowYmd && lastMin < wrapEnd) return true;
  }
  return false;
}

const STATION_TAGS = new Set([
  "print",
  "pay",
  "floor",
  "pin",
  "qr",
  "check",
  "station",
  "reload",
  "update",
  "deploy",
  "kitchen",
  "receipt",
  "guest",
  "table",
  "kds",
]);

const EXCLUDE_TAGS = new Set(["saas", "platform", "crm", "pipeline", "billing"]);

const STATION_SURFACES = new Set(["floor", "kds", "kitchen", "kiosk"]);

export function isStationFacingUpdate(e: GuideUpdate): boolean {
  if (e.audience === "platform") return false;
  if (Array.isArray(e.roles) && e.roles.length && e.roles.every((r) => r === "platform_admin")) {
    return false;
  }
  const tags = e.tags ?? [];
  if (tags.some((t) => EXCLUDE_TAGS.has(t))) return false;
  if (tags.some((t) => STATION_TAGS.has(t))) return true;
  const surfaces = e.surfaces;
  if (surfaces === "all") return true;
  if (Array.isArray(surfaces) && surfaces.some((s) => STATION_SURFACES.has(s))) return true;
  return false;
}

function bulletText(e: GuideUpdate): string {
  const summary = String(e.summary ?? "").trim();
  if (summary && summary.length <= 140) return summary;
  const title = String(e.title ?? "").trim();
  return title || summary.slice(0, 140);
}

/** Short station-facing bullets for the update modal. Empty → omit the list. */
export function stationFacingChangeBullets(opts?: {
  show?: boolean;
  limit?: number;
}): string[] {
  if (opts?.show === false) return [];
  const limit = Math.max(1, opts?.limit ?? 3);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of WHATS_NEW_ENTRIES) {
    if (!isStationFacingUpdate(e)) continue;
    const line = bulletText(e);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}
