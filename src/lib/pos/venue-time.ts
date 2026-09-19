/**
 * Venue IANA timezone. Tickets, guest checks, paid receipts, ODS stamps,
 * and report clocks use this zone — not UTC and not the tablet’s locale.
 */

export const VENUE_TIMEZONES = [
  "America/New_York",
  "America/Detroit",
  "America/Indiana/Indianapolis",
  "America/Kentucky/Louisville",
  "America/Chicago",
  "America/Menominee",
  "America/Denver",
  "America/Boise",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Juneau",
  "America/Sitka",
  "America/Adak",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
  "America/St_Thomas",
  "Pacific/Guam",
  "Pacific/Pago_Pago",
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/Mexico_City",
  "America/Tijuana",
  "America/Cancun",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export type VenueTimezone = (typeof VENUE_TIMEZONES)[number];

export const DEFAULT_VENUE_TIMEZONE: VenueTimezone = "America/Los_Angeles";

const TZ_SET = new Set<string>(VENUE_TIMEZONES);

function intlSupports(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    return true;
  } catch {
    return false;
  }
}

/** Valid IANA id, or the venue default. */
export function parseVenueTimezone(raw: unknown, fallback = DEFAULT_VENUE_TIMEZONE): string {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  if (TZ_SET.has(s) || intlSupports(s)) return s;
  return fallback;
}

export function isVenueTimezone(raw: unknown): boolean {
  const s = String(raw ?? "").trim();
  return Boolean(s) && (TZ_SET.has(s) || intlSupports(s));
}

const STATE_TZ: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DC: "America/New_York",
  DE: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  IA: "America/Chicago",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  MA: "America/New_York",
  MD: "America/New_York",
  ME: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MO: "America/Chicago",
  MS: "America/Chicago",
  MT: "America/Denver",
  NC: "America/New_York",
  ND: "America/Chicago",
  NE: "America/Chicago",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NV: "America/Los_Angeles",
  NY: "America/New_York",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  PR: "America/Puerto_Rico",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VA: "America/New_York",
  VI: "America/St_Thomas",
  VT: "America/New_York",
  WA: "America/Los_Angeles",
  WI: "America/Chicago",
  WV: "America/New_York",
  WY: "America/Denver",
};

const CITY_TZ: Array<[RegExp, string]> = [
  [/\blos angeles\b|\bsan francisco\b|\bseattle\b|\bportland\b|\bsan diego\b|\bsacramento\b/i, "America/Los_Angeles"],
  [/\bphoenix\b|\btucson\b/i, "America/Phoenix"],
  [/\bdenver\b|\bboulder\b|\bsalt lake\b/i, "America/Denver"],
  [/\bchicago\b|\bdallas\b|\bhouston\b|\baustin\b|\bminneapolis\b/i, "America/Chicago"],
  [/\bnew york\b|\bboston\b|\bmiami\b|\batlanta\b|\bphiladelphia\b|\bwashington\b/i, "America/New_York"],
  [/\bhonolulu\b|\bhawaii\b/i, "Pacific/Honolulu"],
  [/\banchorage\b/i, "America/Anchorage"],
];

/** Guess IANA zone from a US/Canada-ish address. Falls back to default. */
export function guessTimezoneFromAddress(address: string, fallback = DEFAULT_VENUE_TIMEZONE): string {
  const s = String(address ?? "").trim();
  if (!s) return fallback;
  if (isVenueTimezone(s)) return parseVenueTimezone(s, fallback);
  for (const [re, tz] of CITY_TZ) {
    if (re.test(s)) return tz;
  }
  const state = s.match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
  if (state) {
    const tz = STATE_TZ[state[1]!];
    if (tz) return tz;
  }
  const named = s.match(
    /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/i,
  );
  if (named) {
    const map: Record<string, string> = {
      california: "CA",
      oregon: "OR",
      washington: "WA",
      nevada: "NV",
      arizona: "AZ",
      "new york": "NY",
      texas: "TX",
      florida: "FL",
      illinois: "IL",
      colorado: "CO",
      hawaii: "HI",
      alaska: "AK",
    };
    const key = named[1]!.toLowerCase();
    const abbr = map[key];
    if (abbr && STATE_TZ[abbr]) return STATE_TZ[abbr]!;
  }
  return fallback;
}

function venueTz(timeZone?: string): string {
  return parseVenueTimezone(timeZone);
}

function asciiAmPm(raw: string): "AM" | "PM" {
  const s = raw.replace(/[^A-Za-z]/g, "").toUpperCase();
  return s.startsWith("P") ? "PM" : "AM";
}

function venueParts(ts: number, timeZone: string): Intl.DateTimeFormatPart[] {
  const d = new Date(Number.isFinite(ts) ? ts : Date.now());
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes, fallback = ""): string {
  return parts.find((p) => p.type === type)?.value ?? fallback;
}

/** Wall-clock time in the venue IANA zone only. ASCII AM/PM. Never UTC, never server local. */
export function formatVenueTime(ts: number, timeZone?: string): string {
  const tz = venueTz(timeZone);
  const parts = venueParts(ts, tz);
  const hour = part(parts, "hour", "12");
  const minute = part(parts, "minute", "00");
  return `${hour}:${minute} ${asciiAmPm(part(parts, "dayPeriod", "AM"))}`;
}

export function formatVenueDateTime(ts: number, timeZone?: string): string {
  const tz = venueTz(timeZone);
  const parts = venueParts(ts, tz);
  return `${part(parts, "month", "Jan")} ${part(parts, "day", "1")}, ${part(parts, "hour", "12")}:${part(parts, "minute", "00")} ${asciiAmPm(part(parts, "dayPeriod", "AM"))}`;
}

export function formatVenueStamp(ts: number, timeZone?: string): string {
  const tz = venueTz(timeZone);
  const parts = venueParts(ts, tz);
  return `${part(parts, "month", "Jan")} ${part(parts, "day", "1")}, ${part(parts, "year", "")} ${part(parts, "hour", "12")}:${part(parts, "minute", "00")} ${asciiAmPm(part(parts, "dayPeriod", "AM"))}`;
}

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function venueClockParts(
  at: Date | number,
  timeZone?: string,
): { weekday: number; hour: number; minute: number } {
  const d = typeof at === "number" ? new Date(at) : at;
  const tz = parseVenueTimezone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const weekday = WEEKDAY[get("weekday")] ?? d.getDay();
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));
    return {
      weekday: Number.isFinite(weekday) ? weekday : d.getDay(),
      hour: Number.isFinite(hour) ? hour : d.getHours(),
      minute: Number.isFinite(minute) ? minute : d.getMinutes(),
    };
  } catch {
    return { weekday: d.getDay(), hour: d.getHours(), minute: d.getMinutes() };
  }
}

/** Epoch ms “now” for a new print. Display uses the venue zone. */
export function venueNowMs(): number {
  return Date.now();
}
