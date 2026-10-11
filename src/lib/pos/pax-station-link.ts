/**
 * In-memory PAX link shared by the station device screen and Pay.
 * Not written to the POS persist store. Opening Pay does not clear it.
 */
import { useSyncExternalStore } from "react";
import { PAX_MSG, type PaxReader, type PaxScanRow } from "@/lib/payments/pax-d135";

export type PaxLinkPhase = "idle" | "scanning" | "setting_up" | "connected" | "bluetooth";

export type PaxStationLink = {
  phase: PaxLinkPhase;
  message: string;
  rows: PaxScanRow[];
  reader: PaxReader | null;
  battery: number | null;
  readers: PaxReader[];
};

const empty: PaxStationLink = {
  phase: "idle",
  message: PAX_MSG.notConnected,
  rows: [],
  reader: null,
  battery: null,
  readers: [],
};

let state: PaxStationLink = empty;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function patch(next: Partial<PaxStationLink>): void {
  state = { ...state, ...next };
  emit();
}

export function getPaxStationLink(): PaxStationLink {
  return state;
}

export function subscribePaxStationLink(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePaxStationLink(): PaxStationLink {
  return useSyncExternalStore(subscribePaxStationLink, getPaxStationLink, getPaxStationLink);
}

export function setPaxReaders(readers: PaxReader[]): void {
  patch({ readers });
}

/** A new scan clears the list. An existing connection stays until the scan finishes. */
export function beginPaxScan(): void {
  patch({ phase: "scanning", rows: [], message: "Scanning" });
}

export function finishPaxScan(presented: {
  phase: "idle" | "bluetooth";
  message: string;
  rows: PaxScanRow[];
}): void {
  if (presented.rows.length > 0) {
    const still =
      state.reader != null && presented.rows.some((row) => row.serial === state.reader?.serial);
    patch({
      rows: presented.rows,
      phase: still ? "connected" : "idle",
      message: still ? PAX_MSG.connected : presented.message,
    });
    return;
  }
  const drop = presented.phase === "bluetooth";
  patch({
    rows: [],
    phase: presented.phase,
    message: presented.message,
    reader: drop ? null : state.reader,
    battery: drop ? null : state.battery,
  });
}

export function beginPaxConnect(reader: PaxReader): void {
  patch({ phase: "setting_up", reader, message: PAX_MSG.settingUp });
}

export function markPaxConnected(reader: PaxReader, battery: number | null): void {
  patch({ phase: "connected", reader, battery, message: PAX_MSG.connected });
}

export function failPaxConnect(message: string): void {
  patch({
    phase: message === PAX_MSG.bluetooth ? "bluetooth" : "idle",
    reader: null,
    battery: null,
    message,
  });
}

export function notePaxStatus(status: {
  state?: string;
  message?: string;
  batteryPercent?: number | null;
}): void {
  if (status.state === "setting_up") {
    patch({ phase: "setting_up", message: status.message || PAX_MSG.settingUp });
  } else if (status.state === "connected") {
    patch({ phase: "connected", message: PAX_MSG.connected });
  }
  if (typeof status.batteryPercent === "number") patch({ battery: status.batteryPercent });
}
