import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { findStaffByPin } from "./pin";
import { useOpsStore } from "./ops-store";
import { usePosStore } from "./store";
import { useStationSessionStore } from "./station-session";

function grantsFor() {
  try {
    return usePosStore.getState().extraEntityShiftGrants ?? [];
  } catch {
    return [];
  }
}

function clockOperatorId(): string | null {
  try {
    const id = useStationSessionStore.getState().assignment.operatorId;
    return id || HOST_SCOPE;
  } catch {
    return HOST_SCOPE;
  }
}

function syncClockedFlag(employeeId: string, shouldBeIn: boolean) {
  const latest = usePosStore.getState().employees.find((e) => e.id === employeeId);
  if (!latest) return;
  if (Boolean(latest.clockedIn) !== shouldBeIn) usePosStore.getState().clockToggle(employeeId);
}

/**
 * Clock in / out for the signed-in person. Never changes the station view.
 */
export function punchStationClock(employeeId: string): { ok: boolean; error?: string; forceRequired?: boolean } {
  const emp = usePosStore.getState().employees.find((e) => e.id === employeeId);
  if (!emp) return { ok: false, error: "Not signed in" };
  const ops = useOpsStore.getState();
  if (emp.clockedIn) {
    const res = ops.clockOut(emp.id, emp.name, {});
    if (!res.ok) return { ok: false, error: res.error ?? "Could not clock out.", forceRequired: res.forceRequired };
    syncClockedFlag(emp.id, false);
    return { ok: true };
  }
  const res = ops.clockIn(emp.id, emp.name, {
    homeOperatorId: emp.operatorId || HOST_SCOPE,
    clockOperatorId: clockOperatorId(),
    grants: grantsFor(),
  });
  if (!res.ok) return { ok: false, error: res.error ?? "Could not clock in.", forceRequired: res.forceRequired };
  syncClockedFlag(emp.id, true);
  return { ok: true };
}

export type PunchByPinResult = {
  ok: boolean;
  error?: string;
  forceRequired?: boolean;
  employeeId?: string;
  employeeName?: string;
  already?: boolean;
};

/**
 * Clock in / out from the PIN pad without signing into the station.
 * Completing clock does not open order entry.
 */
export function punchClockByPin(
  pin: string,
  mode: "clock_in" | "clock_out",
  opts?: { force?: boolean; locationId?: string | null },
): PunchByPinResult {
  const st = usePosStore.getState();
  const loc = opts?.locationId || st.tenantLocationId || "";
  const emp = findStaffByPin(st.employees, pin, loc, clockOperatorId());
  if (!emp) return { ok: false, error: "Invalid PIN" };
  const open = useOpsStore.getState().punches.find((p) => p.employeeId === emp.id && p.status === "open");
  const isIn = Boolean(open) || Boolean(emp.clockedIn);
  if (mode === "clock_in" && isIn) {
    return { ok: false, already: true, employeeId: emp.id, employeeName: emp.name, error: `${emp.name} is already clocked in` };
  }
  if (mode === "clock_out" && !isIn) {
    return { ok: false, already: true, employeeId: emp.id, employeeName: emp.name, error: `${emp.name} is already clocked out` };
  }
  if (mode === "clock_out") {
    const res = useOpsStore.getState().clockOut(emp.id, emp.name, { force: opts?.force });
    if (!res.ok) {
      return {
        ok: false,
        error: res.error ?? "Could not clock out.",
        forceRequired: res.forceRequired,
        employeeId: emp.id,
        employeeName: emp.name,
      };
    }
    syncClockedFlag(emp.id, false);
    return { ok: true, employeeId: emp.id, employeeName: emp.name };
  }
  const res = useOpsStore.getState().clockIn(emp.id, emp.name, {
    force: opts?.force,
    homeOperatorId: emp.operatorId || HOST_SCOPE,
    clockOperatorId: clockOperatorId(),
    grants: grantsFor(),
  });
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Could not clock in.",
      forceRequired: res.forceRequired,
      employeeId: emp.id,
      employeeName: emp.name,
    };
  }
  syncClockedFlag(emp.id, true);
  return { ok: true, employeeId: emp.id, employeeName: emp.name };
}

export function pinIsManager(pin: string, locationId?: string | null): boolean {
  const st = usePosStore.getState();
  const loc = locationId || st.tenantLocationId || "";
  const emp = findStaffByPin(st.employees, pin, loc, null);
  return emp?.role === "owner" || emp?.role === "manager";
}

/** Punch a known employee (manager override, shared demo PIN). Does not log them in. */
export function punchClockForEmployee(
  employeeId: string,
  mode: "clock_in" | "clock_out",
  opts?: { force?: boolean },
): PunchByPinResult {
  const emp = usePosStore.getState().employees.find((e) => e.id === employeeId);
  if (!emp) return { ok: false, error: "Unknown staff" };
  const open = useOpsStore.getState().punches.find((p) => p.employeeId === emp.id && p.status === "open");
  const isIn = Boolean(open) || Boolean(emp.clockedIn);
  if (mode === "clock_in" && isIn) {
    return { ok: false, already: true, employeeId: emp.id, employeeName: emp.name, error: `${emp.name} is already clocked in` };
  }
  if (mode === "clock_out" && !isIn) {
    return { ok: false, already: true, employeeId: emp.id, employeeName: emp.name, error: `${emp.name} is already clocked out` };
  }
  if (mode === "clock_out") {
    const res = useOpsStore.getState().clockOut(emp.id, emp.name, { force: opts?.force });
    if (!res.ok) {
      return {
        ok: false,
        error: res.error ?? "Could not clock out.",
        forceRequired: res.forceRequired,
        employeeId: emp.id,
        employeeName: emp.name,
      };
    }
    syncClockedFlag(emp.id, false);
    return { ok: true, employeeId: emp.id, employeeName: emp.name };
  }
  const res = useOpsStore.getState().clockIn(emp.id, emp.name, {
    force: opts?.force,
    homeOperatorId: emp.operatorId || HOST_SCOPE,
    clockOperatorId: clockOperatorId(),
    grants: grantsFor(),
  });
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Could not clock in.",
      forceRequired: res.forceRequired,
      employeeId: emp.id,
      employeeName: emp.name,
    };
  }
  syncClockedFlag(emp.id, true);
  return { ok: true, employeeId: emp.id, employeeName: emp.name };
}
