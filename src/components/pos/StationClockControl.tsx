import { useState } from "react";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { punchStationClock } from "@/lib/pos/station-clock";
import { usePosStore } from "@/lib/pos/store";
import { cn } from "@/lib/utils";

/** Clock in / out on every station. Completing a punch never opens order entry. */

export function StationClockControl({
  compact,
  className,
  size = "sm",
}: {
  compact?: boolean;
  className?: string;
  size?: "sm" | "lg" | "touch";
}) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const [busy, setBusy] = useState(false);
  if (!emp) return null;

  const onClock = () => {
    setBusy(true);
    const res = punchStationClock(emp.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Clock failed");
      return;
    }
    toast.success(emp.clockedIn ? `${emp.name} clocked out` : `${emp.name} clocked in`);
  };

  const label = emp.clockedIn
    ? compact
      ? "Out"
      : "Clock out"
    : compact
      ? "In"
      : "Clock in";

  return (
    <Button
      type="button"
      size={size}
      variant={emp.clockedIn ? "outline" : "default"}
      className={cn("shrink-0", className)}
      onClick={onClock}
      disabled={busy}
      title="Clock is Labor. Completing clock does not open order entry."
      data-station-clock
      data-clocked={emp.clockedIn ? "in" : "out"}
    >
      <Clock3 className="h-3.5 w-3.5" />
      {busy ? "…" : label}
    </Button>
  );
}
