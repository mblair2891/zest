import { formatCurrency, uid } from "@/lib/utils";
import { isRevealedStatus, type TillCloseRecord } from "@/lib/pos/till-closeout";
import type { LocationDevice } from "@/lib/pos/location-devices";
import { dispatchReceiptStationJob } from "./dispatch";
import type { PrintJob } from "./types";

export const SLIP_WIDTH = 40;

export const DROP_PRINT_OVERRIDE_REASONS = [
  "Printer down",
  "Slip already in the bag",
  "Other",
] as const;

export type TurnInSlipInput = {
  storeName: string;
  locationName: string;
  submittedAt: number;
  registerId: string;
  tillName: string;
  tillId: string;
  shiftId: string;
  closeId: string;
  employeeName: string;
  employeeId: string;
  witnessName?: string;
  witnessId?: string;
  openingBankCents: number;
  countedCents: number;
  bankLeftCents: number;
  turnInCents: number;
  checksCents: number;
  moneyOrdersCents: number;
  bagNumber: string;
  overShortCents: number;
  transferInCents: number;
  transferOutCents: number;
  reprint: boolean;
  managerReview: boolean;
};

export function assertCanPrintTurnIn(
  row: Pick<TillCloseRecord, "status" | "countedCents" | "submittedAt">,
): { ok: true } | { ok: false; error: string } {
  if (!isRevealedStatus(row.status) || row.countedCents == null || !row.submittedAt) {
    return {
      ok: false,
      error: "Submit the count first. The slip prints only after a successful submit.",
    };
  }
  return { ok: true };
}

export function dropBlockedForPrint(
  row: Pick<TillCloseRecord, "slipPrintOk" | "printOverrideReason">,
): string | null {
  if (row.slipPrintOk || row.printOverrideReason) return null;
  return "Count is saved. Reprint required before drop.";
}

function clip(s: string, n = SLIP_WIDTH): string {
  return s.slice(0, n);
}

function center(s: string, n = SLIP_WIDTH): string {
  const t = clip(s, n);
  const pad = Math.max(0, n - t.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + t + " ".repeat(pad - left);
}

function moneyLine(label: string, cents: number): string {
  const r = formatCurrency(cents);
  const pad = Math.max(1, SLIP_WIDTH - label.length - r.length);
  return clip(label + " ".repeat(pad) + r);
}

function wrap(s: string, n = SLIP_WIDTH): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= n) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w.slice(0, n);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function slipWhen(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildTurnInSlipLines(input: TurnInSlipInput): string[] {
  const other = input.checksCents + input.moneyOrdersCents;
  const bag = input.bagNumber.trim() ? input.bagNumber.trim().slice(0, 16) : "______";
  const lines: string[] = [
    center(input.storeName || input.locationName || "STORE"),
    center("TILL TURN-IN"),
  ];
  if (input.reprint) lines.push(center("COPY"));
  lines.push("");
  lines.push(clip(slipWhen(input.submittedAt)));
  lines.push(clip(`Store  ${input.locationName || input.storeName}`));
  lines.push(clip(`Register  ${input.registerId}`));
  lines.push(clip(`Till  ${input.tillName}`));
  if (input.tillId && input.tillId !== input.tillName) lines.push(clip(`Till ID  ${input.tillId}`));
  lines.push(clip(`Shift  ${input.shiftId}`));
  lines.push(clip(`Close  ${input.closeId}`));
  lines.push(clip(`${input.employeeName}  ${input.employeeId}`));
  if (input.witnessName) {
    lines.push(clip(`Witness  ${input.witnessName}  ${input.witnessId ?? ""}`.trim()));
  }
  lines.push("");
  lines.push(moneyLine("Opening bank", input.openingBankCents));
  lines.push(moneyLine("Transfers in", input.transferInCents));
  lines.push(moneyLine("Transfers out", input.transferOutCents));
  lines.push(moneyLine("Counted cash", input.countedCents));
  lines.push(moneyLine("Bank left in till", input.bankLeftCents));
  lines.push(moneyLine("TURN-IN CASH", input.turnInCents));
  if (other > 0) lines.push(moneyLine("Checks / other", other));
  lines.push(clip(`BAG / DROP #  ${bag}`));
  lines.push("");
  lines.push(moneyLine("Over/short", input.overShortCents));
  lines.push(clip(`Status  ${input.managerReview ? "MANAGER REVIEW" : "BALANCED"}`));
  lines.push("");
  lines.push(clip("Cashier signature  _______________"));
  if (input.witnessName || input.witnessId) {
    lines.push(clip("Witness signature  _______________"));
  }
  lines.push("");
  lines.push(
    ...wrap("Place this slip in the bag with turn-in cash. Drop bag in safe."),
  );
  return lines.map((l) => clip(l));
}

export function slipInputFromRecord(
  row: TillCloseRecord,
  opts: {
    storeName: string;
    locationName: string;
    registerId: string;
    shiftId: string;
    reprint: boolean;
  },
): TurnInSlipInput | { error: string } {
  const gate = assertCanPrintTurnIn(row);
  if (!gate.ok) return gate;
  return {
    storeName: opts.storeName,
    locationName: opts.locationName,
    submittedAt: row.submittedAt!,
    registerId: opts.registerId || row.deviceId || "register",
    tillName: row.drawerName,
    tillId: row.drawerId,
    shiftId: opts.shiftId || row.id,
    closeId: row.id,
    employeeName: row.employeeName,
    employeeId: row.employeeId,
    witnessName: row.witnessEmployeeName ?? undefined,
    witnessId: row.witnessEmployeeId ?? undefined,
    openingBankCents: row.expected?.openingBankCents ?? 0,
    countedCents: row.countedCents ?? 0,
    bankLeftCents: row.bankLeftCents ?? row.nextShiftBankCents,
    turnInCents: row.turnInCents ?? 0,
    checksCents: row.checksCents,
    moneyOrdersCents: row.moneyOrdersCents,
    bagNumber: row.bagNumber ?? "",
    overShortCents: row.overShortCents ?? 0,
    transferInCents: row.expected?.transfersInCents ?? 0,
    transferOutCents: row.expected?.transfersOutCents ?? 0,
    reprint: opts.reprint,
    managerReview: row.status === "pending_review" || row.status === "needs_review",
  };
}

export function turnInPrintJob(opts: {
  locationId: string;
  locationName: string;
  input: TurnInSlipInput;
  operatorId?: string | null;
}): PrintJob {
  return {
    id: uid("prn"),
    kind: "till_turn_in",
    station: "receipt",
    locationId: opts.locationId,
    locationName: opts.locationName,
    checkId: opts.input.closeId,
    checkNumber: opts.input.closeId,
    tableLabel: opts.input.tillName,
    serverName: opts.input.employeeName,
    operatorId: opts.operatorId,
    items: [],
    slipLines: buildTurnInSlipLines(opts.input),
    reprintCopy: opts.input.reprint,
    barcodeValue: opts.input.closeId,
    qrUrl: opts.input.closeId,
    qrCaption: opts.input.closeId,
    at: opts.input.submittedAt,
  };
}

export async function printTurnInSlip(opts: {
  record: TillCloseRecord;
  reprint: boolean;
  copies: 1 | 2;
  storeName: string;
  locationName: string;
  registerId: string;
  shiftId: string;
  locationId: string;
  devices: LocationDevice[] | undefined;
  operatorId?: string | null;
}): Promise<{ ok: boolean; copiesPrinted: number; error?: string }> {
  const input = slipInputFromRecord(opts.record, {
    storeName: opts.storeName,
    locationName: opts.locationName,
    registerId: opts.registerId,
    shiftId: opts.shiftId,
    reprint: opts.reprint,
  });
  if ("error" in input) return { ok: false, copiesPrinted: 0, error: input.error };
  const copies = opts.copies === 2 ? 2 : 1;
  let printed = 0;
  for (let i = 0; i < copies; i += 1) {
    const job = turnInPrintJob({
      locationId: opts.locationId,
      locationName: opts.locationName,
      input,
      operatorId: opts.operatorId,
    });
    const res = await dispatchReceiptStationJob(job, opts.devices);
    if (!res.ok) {
      return {
        ok: false,
        copiesPrinted: printed,
        error: "Count is saved. Reprint required before drop.",
      };
    }
    printed += 1;
  }
  return { ok: true, copiesPrinted: printed };
}
