/** Venue calendar date. Matches the POS business date (year-month-day in the venue zone). */

export function businessDateInZone(ms: number, timeZone?: string): string {
  const zone = timeZone && timeZone.trim() ? timeZone.trim() : "UTC";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/**
 * Nightly auto-sync posts the venue date four hours ago.
 * A 3:00 run closes the day that just ended.
 */
export function nightlyBusinessDate(now: number, timeZone?: string): string {
  return businessDateInZone(now - 4 * 60 * 60 * 1000, timeZone);
}

export function isBusinessDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
