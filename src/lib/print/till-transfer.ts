import { uid } from "@/lib/utils";
import type { LocationDevice } from "@/lib/pos/location-devices";
import { formatTransferSlipLines, type TillTransfer } from "@/lib/pos/till-transfer";
import { dispatchPrintJob } from "./dispatch";
import type { PrintJob } from "./types";

export async function printTillTransferSlips(opts: {
  transfer: TillTransfer;
  locationId: string;
  locationName: string;
  devices: LocationDevice[] | undefined;
  copy?: boolean;
}): Promise<void> {
  const lines = formatTransferSlipLines(opts.transfer, Boolean(opts.copy));
  const job: PrintJob = {
    id: uid("prn"),
    kind: "receipt",
    station: "receipt",
    locationId: opts.locationId,
    locationName: opts.locationName,
    checkId: opts.transfer.id,
    checkNumber: opts.transfer.id.slice(-8),
    tableLabel: "TILL TRANSFER",
    serverName: `${opts.transfer.fromEmployeeName} → ${opts.transfer.toEmployeeName}`,
    items: lines.map((name) => ({ qty: 1, name })),
    at: Date.now(),
  };
  await dispatchPrintJob(job, opts.devices);
  await dispatchPrintJob({ ...job, id: uid("prn") }, opts.devices);
}
