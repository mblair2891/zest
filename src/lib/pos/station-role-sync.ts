/**
 * Paired tablet role from Devices. Same pair code / device id.
 * New role on next PIN login; Apply now only on an idle PIN pad. Never mid-ticket.
 */
import { SESSION_MODES, type SessionModeId } from "@/lib/lifecycle/types";
import type { DeviceFunction } from "@/lib/pos/location-devices";
import { deviceRoleFromFunction } from "@/lib/pos/device-roles";
import { readStationPair, writeStationPair } from "@/lib/pos/station-pair";
import { useStationSessionStore } from "@/lib/pos/station-session";

export const STATION_ROLE_STATE_KEY = "summex-station-role-state-v1";

export type ServerDeviceRole = {
  id: string;
  function: DeviceFunction;
  operatorId: string;
  applyRoleNow: boolean;
  roleRevision: number;
};

type RoleState = {
  locationId: string;
  deviceId: string;
  appliedRevision: number;
  pending: ServerDeviceRole | null;
};

function asFunction(raw: string): DeviceFunction | null {
  const ids = SESSION_MODES.map((m) => m.id as string);
  if (raw === "split") return "split";
  if (ids.includes(raw)) return raw as DeviceFunction;
  return null;
}

function readState(): RoleState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATION_ROLE_STATE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as RoleState;
    if (!o?.deviceId) return null;
    return {
      locationId: String(o.locationId ?? ""),
      deviceId: String(o.deviceId),
      appliedRevision: Math.max(0, Number(o.appliedRevision) || 0),
      pending: o.pending && typeof o.pending === "object" ? o.pending : null,
    };
  } catch {
    return null;
  }
}

function writeState(row: RoleState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATION_ROLE_STATE_KEY, JSON.stringify(row));
  } catch {
    /* private mode */
  }
}

function currentKind(): string {
  try {
    return useStationSessionStore.getState().assignment.kind;
  } catch {
    return "";
  }
}

export function applyDeviceRoleLocal(row: ServerDeviceRole): void {
  const fn = asFunction(row.function) ?? row.function;
  const pair = readStationPair();
  if (pair && (pair.deviceId === row.id || !pair.deviceId)) {
    writeStationPair({
      ...pair,
      station: deviceRoleFromFunction(fn),
      deviceId: pair.deviceId || row.id,
    });
  }
  if (fn !== "split" && SESSION_MODES.some((m) => m.id === fn)) {
    useStationSessionStore.getState().setAssignment({
      kind: fn as SessionModeId,
      operatorId: row.operatorId,
    });
  }
}

function alreadyApplied(row: ServerDeviceRole): boolean {
  const st = readState();
  if (st && st.deviceId === row.id && st.appliedRevision >= row.roleRevision && !st.pending) {
    return true;
  }
  return currentKind() === row.function;
}

export function ingestServerDeviceRole(
  row: ServerDeviceRole | null | undefined,
  opts: { staffOpen: boolean; midTicket: boolean },
): "applied" | "pending" | "skipped" {
  if (!row?.id || !row.function) return "skipped";
  const pair = readStationPair();
  if (pair?.deviceId && pair.deviceId !== row.id) return "skipped";
  if (alreadyApplied(row) && !row.applyRoleNow) {
    writeState({
      locationId: pair?.locationId || readState()?.locationId || "",
      deviceId: row.id,
      appliedRevision: Math.max(row.roleRevision, readState()?.appliedRevision ?? 0),
      pending: null,
    });
    return "skipped";
  }
  const loc = pair?.locationId || readState()?.locationId || "";
  if (opts.midTicket || opts.staffOpen) {
    writeState({
      locationId: loc,
      deviceId: row.id,
      appliedRevision: readState()?.appliedRevision ?? 0,
      pending: row,
    });
    return "pending";
  }
  if (row.applyRoleNow) {
    applyDeviceRoleLocal(row);
    writeState({ locationId: loc, deviceId: row.id, appliedRevision: row.roleRevision, pending: null });
    return "applied";
  }
  writeState({
    locationId: loc,
    deviceId: row.id,
    appliedRevision: readState()?.appliedRevision ?? 0,
    pending: row,
  });
  return "pending";
}

/** Next PIN login takes the Devices role. Mid-ticket never swaps. */
export function applyPendingDeviceRoleOnPinLogin(): boolean {
  const st = readState();
  if (!st?.pending) return false;
  applyDeviceRoleLocal(st.pending);
  writeState({
    locationId: st.locationId,
    deviceId: st.deviceId,
    appliedRevision: st.pending.roleRevision,
    pending: null,
  });
  return true;
}

/** Apply now — idle PIN pad only. */
export function applyPendingDeviceRoleIfIdle(opts: { staffOpen: boolean; midTicket: boolean }): boolean {
  if (opts.staffOpen || opts.midTicket) return false;
  const st = readState();
  if (!st?.pending?.applyRoleNow) return false;
  applyDeviceRoleLocal(st.pending);
  writeState({
    locationId: st.locationId,
    deviceId: st.deviceId,
    appliedRevision: st.pending.roleRevision,
    pending: null,
  });
  return true;
}
