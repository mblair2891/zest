import type { TillCloseRecord, TillCloseResult } from "./till-closeout";

function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export const TURN_IN_SLIP_WIDTH = 40;
export const TURN_IN_DROP_BLOCK_MSG = "Count is saved. Reprint required before drop.";

export type TillTurnInSlip = {
  storeName: string;
  locationName: string;
  submittedAt: number;
  tillId: string;
  tillName: string;
  closeId: string;
  employeeName: string;
  employeeId: string;
  witnessName: string | null;
  witnessId: string | null;
  openingBankCents: number;
  countedCents: number;
  bankLeftCents: number;
  turnInCents: number;
  otherCents: number;
  bagNumber: string | null;
  overShortCents: number;
  copy: boolean;
  slipStatus: "BALANCED" | "MANAGER REVIEW";
  transfersInCents: number;
  transfersOutCents: number;
};

function padLine(left: string, right: string, width = TURN_IN_SLIP_WIDTH): string {
  const l = left.slice(0, width);
  const r = right.slice(0, Math.max(0, width - l.length));
  const pad = Math.max(1, width - l.length - r.length);
  return (l + " ".repeat(pad) + r).slice(0, width);
}

function center(s: string, width = TURN_IN_SLIP_WIDTH): string {
  const t = s.slice(0, width);
  const left = Math.max(0, Math.floor((width - t.length) / 2));
  return (" ".repeat(left) + t).padEnd(width).slice(0, width);
}

function wrap(s: string, width = TURN_IN_SLIP_WIDTH): string[] {
  const words = s.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= width) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w.slice(0, width);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Build the bag companion slip. Refuses anything that is not a submitted close. */
export function turnInSlipFromResult(
  result: TillCloseResult,
  opts: {
    storeName: string;
    locationName?: string;
    copy?: boolean;
  },
): { ok: true; slip: TillTurnInSlip } | { ok: false; error: string } {
  if (!result.submittedAt || result.countedCents == null) {
    return { ok: false, error: "Cannot print a turn-in slip before submit." };
  }
  return {
    ok: true,
    slip: {
      storeName: opts.storeName.trim().slice(0, TURN_IN_SLIP_WIDTH) || "Store",
      locationName: (opts.locationName ?? opts.storeName).trim().slice(0, TURN_IN_SLIP_WIDTH),
      submittedAt: result.submittedAt,
      tillId: result.drawerId,
      tillName: result.drawerName,
      closeId: result.closeoutId,
      employeeName: result.employeeName,
      employeeId: result.employeeId,
      witnessName: result.witnessEmployeeName,
      witnessId: result.witnessEmployeeId,
      openingBankCents: result.openingBankCents,
      countedCents: result.countedCents,
      bankLeftCents: result.bankLeftCents,
      turnInCents: result.turnInCents,
      otherCents: result.checksCents + result.moneyOrdersCents,
      bagNumber: result.bagNumber,
      overShortCents: result.overShortCents,
      copy: Boolean(opts.copy),
      slipStatus: result.slipStatus ?? (Math.abs(result.overShortCents) === 0 ? "BALANCED" : "MANAGER REVIEW"),
      transfersInCents: result.transfersInCents ?? 0,
      transfersOutCents: result.transfersOutCents ?? 0,
    },
  };
}

export function turnInSlipFromRecord(
  rec: TillCloseRecord,
  opts: { storeName: string; locationName?: string; copy?: boolean },
): { ok: true; slip: TillTurnInSlip } | { ok: false; error: string } {
  if (
    rec.status === "counting" ||
    rec.status === "recounting" ||
    rec.countedCents == null ||
    rec.submittedAt == null
  ) {
    return { ok: false, error: "Cannot print a turn-in slip before submit." };
  }
  if (rec.expected == null || rec.turnInCents == null || rec.bankLeftCents == null || rec.overShortCents == null) {
    return { ok: false, error: "Cannot print a turn-in slip before submit." };
  }
  return turnInSlipFromResult(
    {
      closeoutId: rec.id,
      drawerId: rec.drawerId,
      drawerName: rec.drawerName,
      employeeName: rec.employeeName,
      employeeId: rec.employeeId,
      witnessEmployeeName: rec.witnessEmployeeName,
      witnessEmployeeId: rec.witnessEmployeeId,
      status: rec.status,
      countedCents: rec.countedCents,
      expectedCents: rec.expected.expectedCents,
      overShortCents: rec.overShortCents,
      turnInCents: rec.turnInCents,
      bankLeftCents: rec.bankLeftCents,
      bagNumber: rec.bagNumber,
      submittedAt: rec.submittedAt,
      openingBankCents: rec.expected.openingBankCents,
      cashSalesCents: rec.expected.cashSalesCents,
      cashRefundsCents: rec.expected.cashRefundsCents,
      paidOutsCents: rec.expected.paidOutsCents,
      paidInsCents: rec.expected.paidInsCents,
      dropsCents: rec.expected.dropsCents,
      transfersInCents: rec.expected.transfersInCents ?? 0,
      transfersOutCents: rec.expected.transfersOutCents ?? 0,
      transferLines: rec.expected.transferLines ?? [],
      checksCents: rec.checksCents,
      moneyOrdersCents: rec.moneyOrdersCents,
      comment: rec.comment,
      managerNote: rec.managerNote,
      droppedAt: rec.droppedAt,
      denoms: rec.denoms,
      clockOutBlocked: false,
      slipPrintOk: rec.slipPrintOk,
      printOverrideReason: rec.printOverrideReason,
      firstCountedCents: rec.firstCountedCents,
      denomCountedCents: rec.denomCountedCents,
      revealVariance: false,
      slipStatus:
        rec.status === "pending_review" || rec.status === "needs_review"
          ? "MANAGER REVIEW"
          : "BALANCED",
    },
    opts,
  );
}

/** Receipt-width lines (~40 columns). Never includes cash sales or a pre-submit expected. */
export function formatTurnInSlipLines(slip: TillTurnInSlip): string[] {
  const when = new Date(slip.submittedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const bag = slip.bagNumber?.trim() ? slip.bagNumber.trim().slice(0, 16) : "______";
  const otherLabel =
    slip.otherCents > 0 ? padLine("Checks / other", dollars(slip.otherCents)) : null;
  const lines: string[] = [
    center(slip.storeName),
    center("TILL TURN-IN"),
    "",
    padLine("Date / time", when.slice(0, 22)),
    padLine("Store / location", slip.locationName.slice(0, 22)),
    padLine("Register / till", `${slip.tillName}`.slice(0, 22)),
    padLine("Till ID", slip.tillId.slice(0, 22)),
    padLine("Close ID", slip.closeId.slice(0, 22)),
    padLine("Employee", `${slip.employeeName}`.slice(0, 22)),
    padLine("Employee ID", slip.employeeId.slice(0, 22)),
  ];
  if (slip.witnessName) {
    lines.push(padLine("Witness", slip.witnessName.slice(0, 22)));
    if (slip.witnessId) lines.push(padLine("Witness ID", slip.witnessId.slice(0, 22)));
  }
  lines.push(
    "",
    padLine("Opening bank", dollars(slip.openingBankCents)),
    padLine("Counted cash", dollars(slip.countedCents)),
    padLine("Bank left in till", dollars(slip.bankLeftCents)),
    padLine("TURN-IN CASH", dollars(slip.turnInCents)),
  );
  if ((slip.transfersInCents ?? 0) > 0 || (slip.transfersOutCents ?? 0) > 0) {
    lines.push(padLine("Transfers in", dollars(slip.transfersInCents ?? 0)));
    lines.push(padLine("Transfers out", dollars(slip.transfersOutCents ?? 0)));
  }
  if (otherLabel) lines.push(otherLabel);
  lines.push(
    padLine("BAG / DROP #", bag),
    "",
    padLine("Over/short", dollars(slip.overShortCents)),
    padLine("Status", slip.slipStatus),
    "",
    "Cashier signature  _______________",
  );
  if (slip.witnessName) lines.push("Witness signature  _______________");
  lines.push("");
  lines.push(...wrap("Place this slip in the bag with turn-in cash."));
  if (slip.copy) lines.push(center("COPY"));
  return lines.map((l) => l.slice(0, TURN_IN_SLIP_WIDTH));
}

export function formatTurnInSlip(slip: TillTurnInSlip): string {
  return formatTurnInSlipLines(slip).join("\n");
}

export function parseTurnInSlipCopies(raw: unknown): 1 | 2 {
  const n = Math.round(Number(raw) || 1);
  return n >= 2 ? 2 : 1;
}
