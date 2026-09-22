import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";

/** Small floor status. Not a second clock button. */
export function ClockedInChip({ className }: { className?: string }) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const tz = usePosStore((s) => s.settings.timezone);
  const punch = useOpsStore((s) =>
    emp ? s.punches.find((p) => p.employeeId === emp.id && p.status === "open") : undefined,
  );
  if (!emp || (!emp.clockedIn && !punch)) return null;
  const at = punch?.clockInAt ?? emp.clockInAt;
  if (!at) return null;
  let hhmm = "";
  try {
    hhmm = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      ...(tz ? { timeZone: tz } : {}),
    }).format(new Date(at));
  } catch {
    const d = new Date(at);
    hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return (
    <p className={className ?? "text-[11px] font-medium text-muted-foreground"} data-clocked-in>
      clocked in {hhmm}
    </p>
  );
}
