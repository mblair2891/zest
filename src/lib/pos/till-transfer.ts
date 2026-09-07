import {
  countedFromDenoms,
  denomQty,
  denomsHaveEntries,
  parseDenomCounts,
  TILL_DENOMS,
  type DenomCounts,
} from "./till-closeout";

export const TILL_TRANSFER_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "reversed",
] as const;
export type TillTransferStatus = (typeof TILL_TRANSFER_STATUSES)[number];

export type TillTransfer = {
  id: string;
  locationId: string;
  status: TillTransferStatus;
  amountCents: number;
  fromDrawerId: string;
  fromDrawerName: string;
  fromEmployeeId: string;
  fromEmployeeName: string;
  toDrawerId: string;
  toDrawerName: string;
  toEmployeeId: string;
  toEmployeeName: string;
  requestedDenoms: DenomCounts | null;
  handedDenoms: DenomCounts | null;
  note: string | null;
  requestedAt: number;
  respondedAt: number | null;
  reverseOfId: string | null;
  reversedById: string | null;
  reversedByName: string | null;
};

export type TillTransferAudit = {
  id: string;
  transferId: string;
  at: number;
  actorId: string;
  actorName: string;
  action: string;
  detail: string;
};

export type OpenTillRef = {
  drawerId: string;
  drawerName: string;
  employeeId: string;
  employeeName: string;
  sinkType: "drawer" | "bank";
  closed: boolean;
  counting: boolean;
};

export function pendingForTill(transfers: TillTransfer[], drawerId: string): TillTransfer[] {
  return transfers.filter(
    (t) => t.status === "pending" && (t.fromDrawerId === drawerId || t.toDrawerId === drawerId),
  );
}

export function closeBlockedByPending(
  transfers: TillTransfer[],
  drawerId: string,
): { ok: true } | { ok: false; error: string } {
  const pending = pendingForTill(transfers, drawerId)[0];
  if (!pending) return { ok: true };
  return { ok: false, error: `Resolve till transfer #${pending.id} first.` };
}

export function acceptedTotalsForTill(
  transfers: TillTransfer[],
  drawerId: string,
): { transfersInCents: number; transfersOutCents: number; lines: TillTransferLine[] } {
  let transfersInCents = 0;
  let transfersOutCents = 0;
  const lines: TillTransferLine[] = [];
  for (const t of transfers) {
    // Reversed originals still moved cash; the paired reverse is a separate accepted row.
    if (t.status !== "accepted" && t.status !== "reversed") continue;
    if (t.toDrawerId === drawerId) {
      transfersInCents += t.amountCents;
      lines.push({
        dir: "in",
        amountCents: t.amountCents,
        otherTillName: t.fromDrawerName,
        otherEmployeeName: t.fromEmployeeName,
        id: t.id,
      });
    }
    if (t.fromDrawerId === drawerId) {
      transfersOutCents += t.amountCents;
      lines.push({
        dir: "out",
        amountCents: t.amountCents,
        otherTillName: t.toDrawerName,
        otherEmployeeName: t.toEmployeeName,
        id: t.id,
      });
    }
  }
  return { transfersInCents, transfersOutCents, lines };
}

export type TillTransferLine = {
  dir: "in" | "out";
  amountCents: number;
  otherTillName: string;
  otherEmployeeName: string;
  id: string;
};

export function requestTillTransfer(opts: {
  id: string;
  locationId: string;
  amountCents: number;
  from: OpenTillRef;
  to: OpenTillRef;
  requestedDenoms?: DenomCounts | null;
  note?: string | null;
  availableFromCents?: number;
  now?: number;
}): { ok: true; transfer: TillTransfer } | { ok: false; error: string } {
  const amount = Math.round(opts.amountCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than $0." };
  }
  if (opts.from.drawerId === opts.to.drawerId) {
    return { ok: false, error: "You cannot request cash from your own till." };
  }
  if (opts.from.employeeId === opts.to.employeeId) {
    return { ok: false, error: "Neither side can accept their own request. Pick another till." };
  }
  if (opts.from.closed || opts.to.closed) {
    return { ok: false, error: "Cannot transfer to or from a closed till." };
  }
  if (opts.from.counting || opts.to.counting) {
    return { ok: false, error: "Cannot transfer after close started." };
  }
  if (opts.availableFromCents != null && amount > opts.availableFromCents) {
    return { ok: false, error: "Cannot transfer more than cash in that till." };
  }
  const denoms = opts.requestedDenoms ? parseDenomCounts(opts.requestedDenoms) : null;
  if (denoms && denomsHaveEntries(denoms) && countedFromDenoms(denoms) !== amount) {
    return { ok: false, error: "Requested mix must add up to the transfer total." };
  }
  return {
    ok: true,
    transfer: {
      id: opts.id,
      locationId: opts.locationId,
      status: "pending",
      amountCents: amount,
      fromDrawerId: opts.from.drawerId,
      fromDrawerName: opts.from.drawerName,
      fromEmployeeId: opts.from.employeeId,
      fromEmployeeName: opts.from.employeeName,
      toDrawerId: opts.to.drawerId,
      toDrawerName: opts.to.drawerName,
      toEmployeeId: opts.to.employeeId,
      toEmployeeName: opts.to.employeeName,
      requestedDenoms: denoms && denomsHaveEntries(denoms) ? denoms : null,
      handedDenoms: null,
      note: opts.note?.trim().slice(0, 120) || null,
      requestedAt: opts.now ?? Date.now(),
      respondedAt: null,
      reverseOfId: null,
      reversedById: null,
      reversedByName: null,
    },
  };
}

export function respondTillTransfer(opts: {
  transfer: TillTransfer;
  actor: { id: string; name: string };
  actorTillId: string;
  action: "accept" | "decline";
  handedDenoms?: DenomCounts | null;
  countingFrom?: boolean;
  countingTo?: boolean;
  availableFromCents?: number;
  now?: number;
}): { ok: true; transfer: TillTransfer } | { ok: false; error: string } {
  const t = opts.transfer;
  if (t.status !== "pending") return { ok: false, error: "This transfer is no longer pending." };
  if (opts.actor.id === t.toEmployeeId) {
    return { ok: false, error: "Neither side can accept their own request." };
  }
  if (opts.actorTillId !== t.fromDrawerId) {
    return { ok: false, error: "Only the employee signed on to the giving till can accept or decline." };
  }
  if (opts.countingFrom || opts.countingTo) {
    return { ok: false, error: "Cannot transfer after close started." };
  }
  if (opts.action === "decline") {
    return {
      ok: true,
      transfer: { ...t, status: "declined", respondedAt: opts.now ?? Date.now() },
    };
  }
  if (opts.availableFromCents != null && t.amountCents > opts.availableFromCents) {
    return { ok: false, error: "Cannot transfer more than cash in that till." };
  }
  const handed = opts.handedDenoms ? parseDenomCounts(opts.handedDenoms) : null;
  if (handed && denomsHaveEntries(handed) && countedFromDenoms(handed) !== t.amountCents) {
    return { ok: false, error: "Handed mix must equal the transfer total." };
  }
  return {
    ok: true,
    transfer: {
      ...t,
      status: "accepted",
      handedDenoms: handed && denomsHaveEntries(handed) ? handed : null,
      respondedAt: opts.now ?? Date.now(),
    },
  };
}

export function cancelTillTransfer(opts: {
  transfer: TillTransfer;
  actorId: string;
  now?: number;
}): { ok: true; transfer: TillTransfer } | { ok: false; error: string } {
  if (opts.transfer.status !== "pending") {
    return { ok: false, error: "Only a pending transfer can be cancelled." };
  }
  if (opts.actorId !== opts.transfer.toEmployeeId) {
    return { ok: false, error: "Only the requester can cancel while pending." };
  }
  return {
    ok: true,
    transfer: { ...opts.transfer, status: "cancelled", respondedAt: opts.now ?? Date.now() },
  };
}

export function reverseTillTransfer(opts: {
  original: TillTransfer;
  newId: string;
  manager: { id: string; name: string };
  countingFrom?: boolean;
  countingTo?: boolean;
  now?: number;
}): { ok: true; original: TillTransfer; reverse: TillTransfer } | { ok: false; error: string } {
  const t = opts.original;
  if (t.status !== "accepted") {
    return { ok: false, error: "Only an accepted transfer can be reversed." };
  }
  if (opts.countingFrom || opts.countingTo) {
    return { ok: false, error: "Cannot reverse while a till is in end-of-shift count." };
  }
  const now = opts.now ?? Date.now();
  const reverse: TillTransfer = {
    id: opts.newId,
    locationId: t.locationId,
    status: "accepted",
    amountCents: t.amountCents,
    fromDrawerId: t.toDrawerId,
    fromDrawerName: t.toDrawerName,
    fromEmployeeId: t.toEmployeeId,
    fromEmployeeName: t.toEmployeeName,
    toDrawerId: t.fromDrawerId,
    toDrawerName: t.fromDrawerName,
    toEmployeeId: t.fromEmployeeId,
    toEmployeeName: t.fromEmployeeName,
    requestedDenoms: t.handedDenoms,
    handedDenoms: t.handedDenoms,
    note: `Reverse of ${t.id}`,
    requestedAt: now,
    respondedAt: now,
    reverseOfId: t.id,
    reversedById: opts.manager.id,
    reversedByName: opts.manager.name,
  };
  return {
    ok: true,
    original: {
      ...t,
      status: "reversed",
      reversedById: opts.manager.id,
      reversedByName: opts.manager.name,
    },
    reverse,
  };
}

export function formatDenomMix(counts: DenomCounts | null | undefined): string {
  if (!counts) return "";
  return TILL_DENOMS.filter((d) => denomQty(counts, d.id) > 0)
    .map((d) => `${denomQty(counts, d.id)}×${d.label}`)
    .join(" ");
}

export function formatTransferLine(line: TillTransferLine): string {
  const amt = `$${(line.amountCents / 100).toFixed(2)}`;
  return line.dir === "in"
    ? `In: +${amt} from ${line.otherTillName}`
    : `Out: −${amt} to ${line.otherTillName}`;
}

export function formatTransferSlipLines(t: TillTransfer, copy = false): string[] {
  const when = new Date(t.respondedAt || t.requestedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const amt = `$${(t.amountCents / 100).toFixed(2)}`;
  const lines = [
    "TILL TRANSFER",
    when,
    `ID ${t.id}`,
    `FROM ${t.fromDrawerName} / ${t.fromEmployeeName}`,
    `TO ${t.toDrawerName} / ${t.toEmployeeName}`,
    `AMOUNT ${amt}`,
  ];
  const mix = formatDenomMix(t.handedDenoms || t.requestedDenoms);
  if (mix) lines.push(mix);
  lines.push("Keep with drawer until drop / close.");
  if (copy) lines.push("COPY");
  return lines;
}

export function listOpenTills(opts: {
  excludeDrawerId?: string;
  employees: { id: string; name: string }[];
  drawers: Record<string, { closedAt?: number; salesByEmployee?: Record<string, number> }>;
  banks: Record<string, { closedAt?: number }>;
  drawerMeta: { id: string; name: string; assignedEmployeeIds: string[] }[];
  countingIds?: Iterable<string>;
}): OpenTillRef[] {
  const counting = new Set(opts.countingIds ?? []);
  const empName = (id: string) => opts.employees.find((e) => e.id === id)?.name ?? id;
  const out: OpenTillRef[] = [];

  for (const [id, ses] of Object.entries(opts.drawers)) {
    if (ses.closedAt) continue;
    if (opts.excludeDrawerId && id === opts.excludeDrawerId) continue;
    if (counting.has(id)) continue;
    const meta = opts.drawerMeta.find((d) => d.id === id);
    const assigned = meta?.assignedEmployeeIds ?? [];
    const salesIds = Object.keys(ses.salesByEmployee ?? {});
    const employeeId = assigned.find((a) => salesIds.includes(a)) ?? assigned[0] ?? salesIds[0] ?? "";
    out.push({
      drawerId: id,
      drawerName: meta?.name ?? id,
      employeeId: employeeId || "staff",
      employeeName: employeeId ? empName(employeeId) : "Staff",
      sinkType: "drawer",
      closed: false,
      counting: false,
    });
  }

  for (const [empId, ses] of Object.entries(opts.banks)) {
    if (ses.closedAt) continue;
    const drawerId = `bank:${empId}`;
    if (opts.excludeDrawerId && drawerId === opts.excludeDrawerId) continue;
    if (counting.has(drawerId)) continue;
    out.push({
      drawerId,
      drawerName: `${empName(empId)} bank`,
      employeeId: empId,
      employeeName: empName(empId),
      sinkType: "bank",
      closed: false,
      counting: false,
    });
  }

  return out;
}
