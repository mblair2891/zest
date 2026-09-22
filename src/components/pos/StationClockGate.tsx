import { useState } from "react";
import { Clock3, CookingPot } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StationPinFit } from "@/lib/pos/station-pin-gate";
import { usePosStore } from "@/lib/pos/store";
import { ROLE_LABEL } from "@/lib/pos/rbac";
import { ClockedInChip } from "./ClockedInChip";
import { EndShiftPunch } from "./EndShiftPunch";

/** Invalid PIN × device: clock sheet only. Never to-go, bar tab, or table order. */
export function StationClockGate({ fit }: { fit: Extract<StationPinFit, { ok: false }> }) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const clocked = Boolean(emp?.clockedIn);
  const [ending, setEnding] = useState(false);

  return (
    <div
      className="flex h-full min-h-0 flex-col items-center justify-center bg-bg px-6 py-8"
      data-station-clock-gate
      data-station-home="clock-gate"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {emp?.role === "kitchen" ? (
            <CookingPot className="h-6 w-6" />
          ) : (
            <Clock3 className="h-6 w-6" />
          )}
        </div>
        <p className="text-lg font-semibold leading-snug">{fit.message}</p>
        <p className="mt-2 text-sm text-muted-foreground">{fit.hint}</p>
        {emp && (
          <p className="mt-3 text-xs text-muted-foreground">
            {emp.name}
            {" · "}
            {ROLE_LABEL[emp.role]}
            {" · "}
            {clocked ? "on the clock" : "off the clock"}
          </p>
        )}
        <div className="mt-4">
          <ClockedInChip />
        </div>
        {ending ? (
          <div className="mt-5">
            <EndShiftPunch
              onDone={() => usePosStore.getState().logout()}
              onCancel={() => setEnding(false)}
            />
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <Button
              size="lg"
              className="station-touch h-14 w-full text-base"
              onClick={() => setEnding(true)}
            >
              Close out
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="station-touch h-14 w-full text-base"
              onClick={() => usePosStore.getState().logout()}
            >
              Done
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Close out punches out. It does not open order entry. Done returns to the PIN pad.
        </p>
      </div>
    </div>
  );
}
