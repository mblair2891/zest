import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { useOpsStore } from "./ops-store";
import { usePosStore } from "./store";

/**
 * Clock in / out for the signed-in person. Never changes the station view.
 */
export function punchStationClock(employeeId: string): { ok: boolean; error?: string } {
  const emp = usePosStore.getState().employees.find((e) => e.id === employeeId);
  if (!emp) return { ok: false, error: "Not signed in" };
  const ops = useOpsStore.getState();
  if (emp.clockedIn) {
    const res = ops.clockOut(emp.id, emp.name, {});
    if (!res.ok) return { ok: false, error: res.error ?? "Could not clock out." };
    const latest = usePosStore.getState().employees.find((e) => e.id === emp.id);
    if (latest?.clockedIn) usePosStore.getState().clockToggle(emp.id);
    return { ok: true };
  }
  const res = ops.clockIn(emp.id, emp.name, {
    homeOperatorId: emp.operatorId || HOST_SCOPE,
  });
  if (!res.ok) return { ok: false, error: res.error ?? "Could not clock in." };
  const latest = usePosStore.getState().employees.find((e) => e.id === emp.id);
  if (latest && !latest.clockedIn) usePosStore.getState().clockToggle(emp.id);
  return { ok: true };
}
