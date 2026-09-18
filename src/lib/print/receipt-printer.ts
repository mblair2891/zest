import { readPairedDeviceId, type LocationDevice } from "@/lib/pos/location-devices";
import { readStationDeviceRole } from "@/lib/pos/device-roles";
import { readStationPair } from "@/lib/pos/station-pair";
import { usePosStore } from "@/lib/pos/store";
import {
  cashAtCopy as cashAtCopyBind,
  payAtCopy as payAtCopyBind,
  receiptPrinterServesStation as serves,
  resolveReceiptPrinter as resolveBind,
  stationHasBoundReceiptPrinter as hasBound,
  stationMayKickDrawer as mayKick,
  stationMayPrintReceipt as mayPrint,
  type ReceiptBindDevice,
} from "./receipt-bind";

export const ADD_RECEIPT_PRINTER = "Add a receipt printer in Devices";

export function receiptPrinterServesStation(
  printer: LocationDevice,
  opts: {
    stationDeviceId?: string | null;
    role?: "order" | "ods" | "host" | "kiosk" | null;
    devices?: LocationDevice[];
  },
): boolean {
  return serves(printer as ReceiptBindDevice, {
    stationDeviceId: opts.stationDeviceId,
    role: opts.role,
    devices: opts.devices as ReceiptBindDevice[] | undefined,
  });
}

/** Printer mapped on this station row, or listed under Stations that may print and kick. */
export function resolveReceiptPrinter(
  devices: LocationDevice[] | undefined,
  stationDeviceId: string | null | undefined,
): LocationDevice | undefined {
  const hit = resolveBind(
    devices as ReceiptBindDevice[] | undefined,
    stationDeviceId,
    readStationDeviceRole(),
  );
  return hit ? devices?.find((d) => d.id === hit.id) : undefined;
}

export function stationHasBoundReceiptPrinter(
  devices: LocationDevice[] | undefined,
  stationDeviceId: string | null | undefined,
): boolean {
  return hasBound(
    devices as ReceiptBindDevice[] | undefined,
    stationDeviceId,
    readStationDeviceRole(),
  );
}

export function payAtCopy(devices: LocationDevice[] | undefined): string {
  return payAtCopyBind(devices as ReceiptBindDevice[] | undefined);
}

export function cashAtCopy(devices: LocationDevice[] | undefined): string {
  return cashAtCopyBind(devices as ReceiptBindDevice[] | undefined);
}

export function stationMayKickDrawer(
  devices: LocationDevice[] | undefined,
  stationDeviceId: string | null | undefined,
): boolean {
  return mayKick(
    devices as ReceiptBindDevice[] | undefined,
    stationDeviceId,
    readStationDeviceRole(),
  );
}

export function stationMayPrintReceipt(
  devices: LocationDevice[] | undefined,
  stationDeviceId: string | null | undefined,
): boolean {
  return mayPrint(
    devices as ReceiptBindDevice[] | undefined,
    stationDeviceId,
    readStationDeviceRole(),
  );
}

export function currentStationDeviceId(): string | null {
  const s = usePosStore.getState();
  if (s.activeDeviceId) return s.activeDeviceId;
  try {
    const pair = readStationPair();
    if (pair?.deviceId) return pair.deviceId;
  } catch {
    /* */
  }
  const loc = s.tenantLocationId || "";
  try {
    return loc ? readPairedDeviceId(loc) : null;
  } catch {
    return null;
  }
}
