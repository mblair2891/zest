/**
 * In-memory PAX link shared by the station device screen and Pay.
 * Not written to the POS persist store. Opening Pay does not clear it.
 */
import { useSyncExternalStore } from "react";
import {
  PAX_MSG,
  isReaderCheckEntityBanner,
  presentPaxHold,
  type PaxReader,
  type PaxScanRow,
} from "@/lib/payments/pax-d135";

export type PaxLinkPhase = "idle" | "scanning" | "connecting" | "setting_up" | "connected" | "bluetooth";

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
      message: still ? PAX_MSG.ready : presented.message,
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
  const presented = presentPaxHold({ event: "select", wasReady: state.phase === "connected" });
  patch({ phase: "connecting", reader, message: presented.message });
}

/** Fixed init banner. It stays until this attempt appends a result or the next attempt starts. */
export function showPaxConnectBanner(message: string): void {
  const text = String(message ?? "").trim();
  if (!text) return;
  patch({ phase: "connecting", message: text });
}

export function markPaxConnected(reader: PaxReader, battery: number | null, statusMessage?: string): void {
  const presented = presentPaxHold({ event: "accepted", wasReady: true });
  const extra = String(statusMessage ?? "").trim();
  const message =
    extra.startsWith("Environment ") && extra.includes(PAX_MSG.ready) ? extra : presented.message;
  patch({ phase: "connected", reader, battery, message });
}

export function failPaxConnect(message: string): void {
  const wasReady = state.phase === "connected";
  const presented = presentPaxHold({
    event: wasReady && message === PAX_MSG.disconnect ? "dropped" : "failed",
    wasReady,
    message,
  });
  patch({
    phase: presented.message === PAX_MSG.bluetooth ? "bluetooth" : "idle",
    reader: null,
    battery: null,
    message: presented.message,
  });
}

function paxBannerStays(message: string): boolean {
  return message.startsWith("Environment ") || isReaderCheckEntityBanner(message);
}

export function notePaxStatus(status: {
  state?: string;
  message?: string;
  batteryPercent?: number | null;
}): void {
  if (status.state === "connecting") {
    if (paxBannerStays(state.message)) {
      patch({ phase: "connecting" });
    } else {
      const incoming = String(status.message ?? "").trim();
      patch({
        phase: "connecting",
        message: incoming.startsWith("Environment ")
          ? incoming
          : presentPaxHold({ event: "select", wasReady: false }).message,
      });
    }
  } else if (status.state === "setting_up") {
    if (paxBannerStays(state.message)) {
      patch({ phase: "setting_up" });
    } else {
      const presented = presentPaxHold({
        event: "processing",
        wasReady: false,
        message: status.message,
      });
      patch({ phase: "setting_up", message: presented.message });
    }
  } else if (status.state === "connected") {
    const incoming = String(status.message ?? "").trim();
    if (incoming.startsWith("Environment ")) {
      patch({ phase: "connected", message: incoming });
    } else if (state.message.startsWith("Environment ")) {
      const message = state.message.includes(PAX_MSG.ready)
        ? state.message
        : `${state.message} ${PAX_MSG.ready}`;
      patch({ phase: "connected", message });
    } else if (isReaderCheckEntityBanner(state.message)) {
      patch({ phase: "connected" });
    } else {
      const presented = presentPaxHold({ event: "accepted", wasReady: true });
      patch({ phase: "connected", message: presented.message });
    }
  } else if (status.state === "error") {
    const incoming = String(status.message ?? "").trim();
    if (incoming) {
      patch({ phase: "idle", reader: null, battery: null, message: incoming });
    }
  } else if (status.state === "disconnected" && state.phase === "connected") {
    if (paxBannerStays(state.message)) {
      patch({ phase: "idle", reader: null, battery: null });
    } else {
      const presented = presentPaxHold({ event: "dropped", wasReady: true });
      patch({ phase: "idle", reader: null, battery: null, message: presented.message });
    }
  }
  if (typeof status.batteryPercent === "number") patch({ battery: status.batteryPercent });
}
