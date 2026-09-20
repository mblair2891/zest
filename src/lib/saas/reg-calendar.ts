/**
 * Typical US rate/labor effective-date windows. Not a law engine.
 * Nightly job opens a platform review task when a window is within 45 days.
 */

export const REG_LOOKAHEAD_DAYS = 45;

export type RegWindowKind = "tax" | "labor";

export type RegCalendarWindow = {
  /** MM-DD */
  mmdd: string;
  label: string;
  kinds: RegWindowKind[];
};

export type RegCalendarRow = {
  state: string;
  city: string;
  windows: RegCalendarWindow[];
};

/** Statewide unless city is set. CA has no July 1 statewide window; WA does. */
export const REG_CALENDAR: RegCalendarRow[] = [
  { state: "WA", city: "", windows: [
    { mmdd: "01-01", label: "Jan 1", kinds: ["labor", "tax"] },
    { mmdd: "07-01", label: "July 1", kinds: ["labor"] },
  ] },
  { state: "OR", city: "", windows: [
    { mmdd: "01-01", label: "Jan 1", kinds: ["labor", "tax"] },
    { mmdd: "07-01", label: "July 1", kinds: ["labor"] },
  ] },
  { state: "CA", city: "", windows: [
    { mmdd: "01-01", label: "Jan 1", kinds: ["labor", "tax"] },
  ] },
  { state: "NY", city: "", windows: [
    { mmdd: "01-01", label: "Jan 1", kinds: ["labor", "tax"] },
  ] },
  { state: "TX", city: "", windows: [
    { mmdd: "01-01", label: "Jan 1", kinds: ["tax"] },
    { mmdd: "06-01", label: "Session end", kinds: ["tax"] },
  ] },
  { state: "FL", city: "", windows: [
    { mmdd: "01-01", label: "Jan 1", kinds: ["tax"] },
  ] },
  { state: "IL", city: "", windows: [
    { mmdd: "01-01", label: "Jan 1", kinds: ["labor", "tax"] },
  ] },
  { state: "CO", city: "", windows: [
    { mmdd: "01-01", label: "Jan 1", kinds: ["labor", "tax"] },
  ] },
  { state: "AZ", city: "", windows: [
    { mmdd: "01-01", label: "Jan 1", kinds: ["labor"] },
  ] },
  { state: "NV", city: "", windows: [
    { mmdd: "01-01", label: "Jan 1", kinds: ["labor"] },
    { mmdd: "07-01", label: "July 1", kinds: ["labor"] },
  ] },
];

export type UpcomingWindow = {
  state: string;
  city: string;
  mmdd: string;
  label: string;
  kinds: RegWindowKind[];
  nextDate: string;
  daysUntil: number;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

function nextOccurrence(mmdd: string, fromIso: string): string {
  const year = Number(fromIso.slice(0, 4));
  const candidate = `${year}-${mmdd}`;
  if (candidate >= fromIso) return candidate;
  return `${year + 1}-${mmdd}`;
}

export function windowsWithinDays(
  nowIso: string,
  lookahead = REG_LOOKAHEAD_DAYS,
  calendar: RegCalendarRow[] = REG_CALENDAR,
): UpcomingWindow[] {
  const today = nowIso.slice(0, 10);
  const until = addDays(today, lookahead);
  const out: UpcomingWindow[] = [];
  for (const row of calendar) {
    for (const w of row.windows) {
      const nextDate = nextOccurrence(w.mmdd, today);
      if (nextDate > until) continue;
      const daysUntil = Math.round(
        (Date.parse(`${nextDate}T12:00:00.000Z`) - Date.parse(`${today}T12:00:00.000Z`)) /
          86_400_000,
      );
      out.push({
        state: row.state,
        city: row.city,
        mmdd: w.mmdd,
        label: w.label,
        kinds: w.kinds,
        nextDate,
        daysUntil,
      });
    }
  }
  return out;
}

export type SuggestedLabor = {
  minWageCents: number | null;
  otDailyHours: number | null;
  otWeeklyHours: number | null;
  tipCreditCents: number | null;
};

export function parseSuggestedLabor(raw: unknown): SuggestedLabor | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const minWageCents = num(o.minWageCents ?? (o.minWage != null ? Number(o.minWage) * 100 : null));
  const otDailyHours = num(o.otDailyHours);
  const otWeeklyHours = num(o.otWeeklyHours);
  const tipCreditCents = num(o.tipCreditCents ?? (o.tipCredit != null ? Number(o.tipCredit) * 100 : null));
  if (
    minWageCents == null &&
    otDailyHours == null &&
    otWeeklyHours == null &&
    tipCreditCents == null
  ) {
    return null;
  }
  return { minWageCents, otDailyHours, otWeeklyHours, tipCreditCents };
}

export function laborSuggestionLabel(s: SuggestedLabor): string {
  const bits: string[] = [];
  if (s.minWageCents != null) bits.push(`min wage $${(s.minWageCents / 100).toFixed(2)}`);
  if (s.otDailyHours != null) bits.push(`OT daily ${s.otDailyHours}h`);
  if (s.otWeeklyHours != null) bits.push(`OT weekly ${s.otWeeklyHours}h`);
  if (s.tipCreditCents != null) bits.push(`tip credit $${(s.tipCreditCents / 100).toFixed(2)}`);
  return bits.join(" · ") || "Labor suggestion";
}
