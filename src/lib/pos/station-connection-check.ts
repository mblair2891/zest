/**
 * PIN login pings receipt and order printers without waiting on the result.
 * The station opens TCP 9100. A browser uses the print agent, or an online
 * order / host / ODS station when this device cannot reach the LAN.
 */
import { isNativeApp } from "@/lib/native-shell";
import { isStationPinPath } from "@/lib/pos/device-roles";
import {
  freshestPrintWorker,
  readPairedDeviceId,
  type LocationDevice,
} from "@/lib/pos/location-devices";
import { readStationPair } from "@/lib/pos/station-pair";
import { usePosStore } from "@/lib/pos/store";
import {
  applyLoginProbe,
  lanProbePath,
  loginConnectionPrinters,
  scheduleConnectionProbes,
  seedLoginProbe,
  type PrinterProbeState,
  type StationAssignment,
} from "@/lib/pos/station-device-health";
import { nativeUsbPrinterConnected, probeNativePrinter } from "@/lib/print/capacitor-raw-print";
import { printAgentUrl } from "@/lib/print/dispatch";
import { readPrinterProbeFn, requestPrinterProbeFn } from "@/lib/print/api";

const EMPTY_PROBE: Record<string, PrinterProbeState | undefined> = {};
let probe: Record<string, PrinterProbeState | undefined> = EMPTY_PROBE;
let round = 0;
const listeners = new Set<() => void>();

export function getStationPrinterProbe(): Record<string, PrinterProbeState | undefined> {
  return probe;
}

export function subscribeStationPrinterProbe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const listener of listeners) listener();
}

function note(token: number, id: string, state: PrinterProbeState): void {
  if (token !== round) return;
  const next = applyLoginProbe(probe, id, state);
  if (next === probe) return;
  probe = next;
  emit();
}

function stationIdNow(): string {
  try {
    const pair = readStationPair();
    const state = usePosStore.getState();
    if (isStationPinPath() && pair?.deviceId) return pair.deviceId;
    if (state.activeDeviceId) return state.activeDeviceId;
    if (pair?.deviceId) return pair.deviceId;
    const loc = state.tenantLocationId || pair?.locationId || "";
    return loc ? readPairedDeviceId(loc) || "" : "";
  } catch {
    return usePosStore.getState().activeDeviceId || "";
  }
}

async function printAgentAlive(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 400);
  try {
    const res = await fetch(`${printAgentUrl()}/health`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function probePrintAgent(host: string, port: number): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1800);
  try {
    const res = await fetch(`${printAgentUrl()}/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, port }),
      signal: ctrl.signal,
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function probeDirect(
  target: StationAssignment,
  path: "station_tcp" | "print_agent",
): Promise<boolean> {
  if (!target.host) return false;
  if (path === "station_tcp") {
    const native = await probeNativePrinter(target.host, target.port);
    return native === true;
  }
  return probePrintAgent(target.host, target.port);
}

function probeUsb(target: StationAssignment): Promise<PrinterProbeState | null> {
  return nativeUsbPrinterConnected().then((ok) => {
    if (ok === true) return "up";
    if (ok === false) return "down";
    if (target.usbAttached === true) return "up";
    if (target.usbAttached === false) return "down";
    return null;
  });
}

async function probeThroughStation(
  token: number,
  locationId: string,
  targets: StationAssignment[],
): Promise<void> {
  const lan = targets.filter((target) => target.host);
  if (!locationId || !lan.length) {
    for (const target of lan) note(token, target.id, "down");
    return;
  }
  try {
    const requested = await requestPrinterProbeFn({
      data: {
        locationId,
        targets: lan.map((target) => ({
          id: target.id,
          host: target.host as string,
          port: target.port,
        })),
      },
    });
    const id = requested.ticket?.id ?? "";
    if (!id) {
      for (const target of lan) note(token, target.id, "down");
      return;
    }
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      if (token !== round) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (token !== round) return;
      const res = await readPrinterProbeFn({ data: { locationId } });
      const ticket = res.ticket;
      if (!ticket || ticket.id !== id || ticket.status === "pending") continue;
      const byId = new Map(ticket.results.map((row) => [row.id, row.ok]));
      for (const target of lan) note(token, target.id, byId.get(target.id) === true ? "up" : "down");
      return;
    }
  } catch {
    if (token !== round) return;
    for (const target of lan) note(token, target.id, "down");
  }
}

async function runStationConnectionCheck(
  token: number,
  printers: StationAssignment[],
  devices: LocationDevice[],
  locationId: string,
): Promise<void> {
  if (token !== round) return;
  const native = isNativeApp();
  const agent = native ? false : await printAgentAlive();
  if (token !== round) return;
  const path = lanProbePath({
    native,
    agent,
    onlineStation: Boolean(freshestPrintWorker(devices)),
  });
  const usb = printers.filter((target) => target.usb);
  const noHost = printers.filter((target) => !target.usb && !target.host);
  const lan = printers.filter((target) => !target.usb && target.host);
  for (const target of noHost) note(token, target.id, "down");
  for (const target of usb) {
    void probeUsb(target).then((state) => {
      if (state) note(token, target.id, state);
    });
  }
  if (!lan.length) return;
  if (path === "unreachable") {
    for (const target of lan) note(token, target.id, "down");
    return;
  }
  if (path === "online_station") {
    await probeThroughStation(token, locationId, lan);
    return;
  }
  scheduleConnectionProbes({
    targets: lan,
    probe: (id) => {
      const target = lan.find((row) => row.id === id);
      if (!target) return Promise.resolve(false);
      return probeDirect(target, path);
    },
    onResult: (id, ok) => note(token, id, ok ? "up" : "down"),
  });
}

/** Returns before any printer answers. */
export function startStationConnectionCheck(input: {
  printers: StationAssignment[];
  devices: LocationDevice[];
  locationId: string;
}): void {
  const printers = input.printers.filter((target) => target.kind !== "card_reader");
  if (!printers.length) return;
  const token = ++round;
  const seeded = seedLoginProbe(probe, printers.map((target) => target.id));
  if (seeded !== probe) {
    probe = seeded;
    emit();
  }
  void runStationConnectionCheck(token, printers, input.devices, input.locationId);
}

/** Successful PIN login. Does not wait for the printers. */
export function refreshStationConnectionOnLogin(): void {
  const state = usePosStore.getState();
  const stationId = stationIdNow();
  const sectionIds = (state.floorSections ?? []).map((section) => section.id);
  const printers = loginConnectionPrinters({
    stationId,
    devices: state.locationDevices,
    sectionIds,
  });
  let locationId = "";
  try {
    locationId = state.tenantLocationId || readStationPair()?.locationId || "";
  } catch {
    locationId = state.tenantLocationId || "";
  }
  startStationConnectionCheck({
    printers,
    devices: state.locationDevices,
    locationId,
  });
}
