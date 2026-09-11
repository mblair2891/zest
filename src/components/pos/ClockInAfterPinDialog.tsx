import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { shouldPromptClockInAfterPin } from "@/lib/labor/pin-clock-prompt";
import { isNativeApp } from "@/lib/native-shell";
import { isStationPinPath } from "@/lib/pos/device-roles";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";

/**
 * After a successful station PIN: optional Labor punch if off the clock and
 * inside that entity’s allowed clock-in window. Never on password / back office.
 */
export function ClockInAfterPinDialog() {
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const sessionKind = usePosStore((s) => s.sessionKind);
  const employees = usePosStore((s) => s.employees);
  const clockToggle = usePosStore((s) => s.clockToggle);
  const shifts = useOpsStore((s) => s.shifts);
  const laborByEntity = useOpsStore((s) => s.laborByEntity);
  const labor = useOpsStore((s) => s.labor);
  const clockIn = useOpsStore((s) => s.clockIn);
  const emp = employees.find((e) => e.id === currentEmployeeId) ?? null;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const askedFor = useRef<string | null>(null);

  const stationPin =
    sessionKind === "pin" && (isStationPinPath() || isNativeApp());

  useEffect(() => {
    const person = employees.find((e) => e.id === currentEmployeeId) ?? null;
    if (!person || !stationPin) {
      setOpen(false);
      return;
    }
    if (askedFor.current === person.id) return;
    const offer = shouldPromptClockInAfterPin({
      stationPinSession: true,
      clockedIn: Boolean(person.clockedIn),
      employeeId: person.id,
      homeOperatorId: person.operatorId || HOST_SCOPE,
      shifts,
      laborByEntity,
      defaultLabor: labor,
    });
    if (offer.prompt) {
      askedFor.current = person.id;
      setError(null);
      setOpen(true);
      return;
    }
    if (person.clockedIn || shifts.some((s) => s.employeeId === person.id && s.published)) {
      askedFor.current = person.id;
      setOpen(false);
    }
  }, [
    currentEmployeeId,
    employees,
    stationPin,
    shifts,
    laborByEntity,
    labor,
  ]);

  useEffect(() => {
    if (!currentEmployeeId) askedFor.current = null;
  }, [currentEmployeeId]);

  const dismiss = () => {
    setOpen(false);
    setError(null);
  };

  const punchIn = () => {
    if (!emp) return;
    setBusy(true);
    setError(null);
    const res = clockIn(emp.id, emp.name, {
      homeOperatorId: emp.operatorId || HOST_SCOPE,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not clock in.");
      return;
    }
    const latest = usePosStore.getState().employees.find((e) => e.id === emp.id);
    if (latest && !latest.clockedIn) clockToggle(emp.id);
    setOpen(false);
  };

  if (!stationPin) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent showClose={false} className="max-w-sm" data-demo="pin-clock-in-offer">
        <DialogHeader>
          <DialogTitle>Clock in for this shift?</DialogTitle>
          <DialogDescription>
            PIN signed you onto this station. Clock-in is a separate punch in Labor.
            You can skip and clock in from Labor later.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-danger">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" className="h-12" onClick={dismiss} disabled={busy}>
            Not now
          </Button>
          <Button type="button" className="h-12" onClick={punchIn} disabled={busy}>
            {busy ? "Clocking in…" : "Clock in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
