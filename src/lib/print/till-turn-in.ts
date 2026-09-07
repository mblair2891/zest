import { uid } from "@/lib/utils";
import type { LocationDevice } from "@/lib/pos/location-devices";
import type { TillCloseResult } from "@/lib/pos/till-closeout";
import { tillCloseFromHandling } from "@/lib/pos/till-closeout";
import { parseCashHandling } from "@/lib/pos/cash-handling";
import { turnInSlipFromResult, TURN_IN_DROP_BLOCK_MSG } from "@/lib/pos/till-turn-in-slip";
import { dispatchTurnInSlip } from "./dispatch";
import type { PrintJob } from "./types";

export function buildTurnInPrintJob(opts: {
  result: TillCloseResult;
  storeName: string;
  locationId: string;
  locationName?: string;
  copy: boolean;
  operatorId?: string | null;
}): { ok: true; job: PrintJob } | { ok: false; error: string } {
  const built = turnInSlipFromResult(opts.result, {
    storeName: opts.storeName,
    locationName: opts.locationName,
    copy: opts.copy,
  });
  if (!built.ok) return built;
  return {
    ok: true,
    job: {
      id: uid("prn"),
      kind: "till_turn_in",
      station: "receipt",
      locationId: opts.locationId,
      locationName: opts.storeName,
      checkId: opts.result.closeoutId,
      checkNumber: opts.result.closeoutId.slice(-8),
      tableLabel: opts.result.drawerName,
      serverName: opts.result.employeeName,
      operatorId: opts.operatorId,
      items: [],
      turnIn: built.slip,
      qrUrl: opts.result.closeoutId,
      qrCaption: opts.result.closeoutId,
      at: opts.result.submittedAt,
    },
  };
}

export async function printTurnInSlip(opts: {
  result: TillCloseResult;
  storeName: string;
  locationId: string;
  locationName?: string;
  devices: LocationDevice[] | undefined;
  printerId?: string | null;
  copies?: 1 | 2;
  copy?: boolean;
  cashHandling?: unknown;
  operatorId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const copies =
    opts.copies ??
    tillCloseFromHandling(parseCashHandling(opts.cashHandling)).turnInSlipCopies;
  const job = buildTurnInPrintJob({
    result: opts.result,
    storeName: opts.storeName,
    locationId: opts.locationId,
    locationName: opts.locationName,
    copy: Boolean(opts.copy),
    operatorId: opts.operatorId,
  });
  if (!job.ok) return job;
  const res = await dispatchTurnInSlip(job.job, opts.devices, {
    printerId: opts.printerId,
    copies,
  });
  if (!res.ok) return { ok: false, error: res.error || TURN_IN_DROP_BLOCK_MSG };
  return { ok: true };
}
