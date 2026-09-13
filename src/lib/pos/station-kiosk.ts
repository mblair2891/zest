/**
 * Station Android shell: who may reload the WebView or exit lock-task.
 * Leaf module (no store) so node:test can load it.
 */
import type { Employee, EmployeeRole } from "./types";
import { findStaffByPin, hashPin, isFourDigitPin } from "./pin";

export const STATION_RELOAD_HOLD_MS = 2000;

export function employeeCanStationService(
  role: EmployeeRole | null | undefined,
): boolean {
  return role === "owner" || role === "manager";
}

export function pinUnlocksStationService(opts: {
  pin: string;
  locationId: string;
  employees: Employee[];
  managerPin?: string | null;
  stationServicePinHash?: string | null;
}): boolean {
  if (!isFourDigitPin(opts.pin)) return false;
  const loc = opts.locationId || "loc";
  if (
    opts.stationServicePinHash &&
    hashPin(opts.pin, loc) === opts.stationServicePinHash
  ) {
    return true;
  }
  if (opts.managerPin && opts.pin === opts.managerPin) return true;
  const emp = findStaffByPin(opts.employees, opts.pin, loc, null);
  if (!emp || emp.pinLocked) return false;
  return employeeCanStationService(emp.role);
}
