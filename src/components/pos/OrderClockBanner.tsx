import { useState } from "react";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";

function venueClock(at: number, tz: string | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      ...(tz ? { timeZone: tz } : {}),
    }).format(new Date(at));
  } catch {
    const d = new Date(at);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}

/** Order screen clock status. Punch rules stay on Labor. */
export function OrderClockBanner() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const tz = usePosStore((s) => s.settings.timezone);
  const clockToggle = usePosStore((s) => s.clockToggle);
  const punch = useOpsStore((s) =>
    emp ? s.punches.find((p) => p.employeeId === emp.id && p.status === "open") : undefined,
  );
  const clockIn = useOpsStore((s) => s.clockIn);
  const [error, setError] = useState<string | null>(null);
  if (!emp) return null;
  const clocked = Boolean(emp.clockedIn || punch);
  if (clocked) {
    const at = punch?.clockInAt ?? emp.clockInAt;
    if (!at) return null;
    return (
      <p
        className="shrink-0 border-b border-border bg-surface px-3 py-1 text-xs text-muted-foreground"
        data-clock-banner="in"
        data-clocked-in
      >
        Clocked in: {venueClock(at, tz)}
      </p>
    );
  }
  const punchIn = () => {
    setError(null);
    const res = clockIn(emp.id, emp.name, {
      homeOperatorId: emp.operatorId || HOST_SCOPE,
    });
    if (!res.ok) {
      setError(res.error ?? "Could not clock in.");
      return;
    }
    const latest = usePosStore.getState().employees.find((e) => e.id === emp.id);
    if (latest && !latest.clockedIn) clockToggle(emp.id);
  };
  return (
    <div
      className="clock-banner-flash flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-white"
      data-clock-banner="out"
      role="status"
    >
      <span className="text-sm font-bold tracking-wide">NOT CLOCKED IN</span>
      <button
        type="button"
        className="rounded-md bg-white px-3 py-1 text-sm font-semibold text-red-950"
        data-clock-in
        onClick={punchIn}
      >
        Clock in
      </button>
      {error ? <span className="w-full text-xs">{error}</span> : null}
    </div>
  );
}
