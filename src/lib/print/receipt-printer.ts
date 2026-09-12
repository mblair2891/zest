import type { LocationDevice } from "@/lib/pos/location-devices";
import { readPairedDeviceId } from "@/lib/pos/location-devices";
import { usePosStore } from "@/lib/pos/store";

/** Printer mapped on this station row, else the first venue receipt printer. */
export function resolveReceiptPrinter(
  devices: LocationDevice[] | undefined,
  stationDeviceId: string | null | undefined,
): LocationDevice | undefined {
  const all = (devices ?? []).filter((d) => d.type === "printer" && d.status !== "inactive");
  const receipts = all.filter((d) => d.print?.station === "receipt");
  const mappedId = stationDeviceId
    ? (devices ?? []).find((d) => d.id === stationDeviceId)?.receiptPrinterId
    : null;
  if (mappedId) {
    const mapped = all.find((d) => d.id === mappedId);
    if (mapped) return mapped;
  }
  return receipts[0] ?? all[0];
}

export function currentStationDeviceId(): string | null {
  const s = usePosStore.getState();
  if (s.activeDeviceId) return s.activeDeviceId;
  const loc = s.tenantLocationId || "";
  try {
    return loc ? readPairedDeviceId(loc) : null;
  } catch {
    return null;
  }
}
