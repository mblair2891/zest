import { useState } from "react";
import { Button } from "@/components/ui/button";
import { pinIsManager, punchOutAfterCloseout } from "@/lib/pos/station-clock";
import { usePosStore } from "@/lib/pos/store";
import { PinKeypad } from "./PinKeypad";

/**
 * Kitchen, busser, and other roles with no till.
 * Close out is this screen: punch out only.
 */
export function EndShiftPunch({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel?: () => void;
}) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const [err, setErr] = useState<string | null>(null);
  const [needManager, setNeedManager] = useState(false);

  const punch = (force = false) => {
    if (!emp) {
      onDone();
      return;
    }
    const res = punchOutAfterCloseout(emp.id, { force });
    if (!res.ok && res.forceRequired) {
      setNeedManager(true);
      setErr(res.error ?? "Manager PIN to clock out");
      return;
    }
    if (!res.ok) {
      setErr(res.error ?? "Could not clock out");
      return;
    }
    onDone();
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center bg-bg px-6 py-8" data-end-shift>
      <div className="w-full max-w-md space-y-4">
        <div>
          <h2 className="text-lg font-semibold">End shift</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {emp ? `${emp.name} · ` : ""}
            No till on this role. End shift punches you out.
          </p>
        </div>
        {err && (
          <p className="text-sm text-danger" role="alert">
            {err}
          </p>
        )}
        {needManager ? (
          <PinKeypad
            title="Manager PIN"
            hint="Allows this clock-out"
            error={null}
            onComplete={(pin) => {
              if (!pinIsManager(pin)) {
                setErr("Manager PIN required");
                return;
              }
              punch(true);
            }}
          />
        ) : (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-14 flex-1" onClick={onCancel ?? onDone}>
              Cancel
            </Button>
            <Button type="button" className="h-14 flex-1" onClick={() => punch(false)} data-end-shift-punch>
              End shift
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
