export function startOfDay(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function startOfWeek(d = new Date()): number {
  const x = new Date(d);
  const day = x.getDay();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x.getTime();
}

export function addDays(ms: number, days: number): number {
  return ms + days * 86400000;
}

export function weekDays(weekStart: number): number[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function formatDayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function hoursBetween(start: number, end: number): number {
  return Math.max(0, (end - start) / 3600000);
}
