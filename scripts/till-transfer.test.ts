import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptedTotalsForTill,
  cancelTillTransfer,
  closeBlockedByPending,
  formatTransferLine,
  formatTransferSlipLines,
  listOpenTills,
  requestTillTransfer,
  respondTillTransfer,
  reverseTillTransfer,
  type OpenTillRef,
} from "../src/lib/pos/till-transfer.ts";
import { expectedTillCashCents, snapshotExpected } from "../src/lib/pos/till-closeout.ts";

const A: OpenTillRef = {
  drawerId: "drw_a",
  drawerName: "Till A",
  employeeId: "emp_a",
  employeeName: "Alex",
  sinkType: "drawer",
  closed: false,
  counting: false,
};
const B: OpenTillRef = {
  drawerId: "drw_b",
  drawerName: "Till B",
  employeeId: "emp_b",
  employeeName: "Blair",
  sinkType: "drawer",
  closed: false,
  counting: false,
};

test("A accepts $20 from B: B expected −20, A expected +20", () => {
  const req = requestTillTransfer({
    id: "xfr_1",
    locationId: "loc",
    amountCents: 2000,
    from: B,
    to: A,
  });
  assert.equal(req.ok, true);
  if (!req.ok) return;
  const acc = respondTillTransfer({
    transfer: req.transfer,
    actor: { id: B.employeeId, name: B.employeeName },
    actorTillId: B.drawerId,
    action: "accept",
  });
  assert.equal(acc.ok, true);
  if (!acc.ok) return;
  const a = acceptedTotalsForTill([acc.transfer], A.drawerId);
  const b = acceptedTotalsForTill([acc.transfer], B.drawerId);
  assert.equal(a.transfersInCents, 2000);
  assert.equal(a.transfersOutCents, 0);
  assert.equal(b.transfersInCents, 0);
  assert.equal(b.transfersOutCents, 2000);
  const base = {
    openingBankCents: 15000,
    cashSalesCents: 0,
    cashRefundsCents: 0,
    paidOutsCents: 0,
    paidInsCents: 0,
    dropsCents: 0,
  };
  assert.equal(expectedTillCashCents({ ...base, transfersInCents: a.transfersInCents, transfersOutCents: a.transfersOutCents }), 17000);
  assert.equal(expectedTillCashCents({ ...base, transfersInCents: b.transfersInCents, transfersOutCents: b.transfersOutCents }), 13000);
});

test("decline: neither expected changes", () => {
  const req = requestTillTransfer({
    id: "xfr_2",
    locationId: "loc",
    amountCents: 2000,
    from: B,
    to: A,
  });
  assert.equal(req.ok, true);
  if (!req.ok) return;
  const dec = respondTillTransfer({
    transfer: req.transfer,
    actor: { id: B.employeeId, name: B.employeeName },
    actorTillId: B.drawerId,
    action: "decline",
  });
  assert.equal(dec.ok, true);
  if (!dec.ok) return;
  const a = acceptedTotalsForTill([dec.transfer], A.drawerId);
  const b = acceptedTotalsForTill([dec.transfer], B.drawerId);
  assert.equal(a.transfersInCents, 0);
  assert.equal(b.transfersOutCents, 0);
});

test("close blocked while transfer pending", () => {
  const req = requestTillTransfer({
    id: "xfr_3",
    locationId: "loc",
    amountCents: 500,
    from: B,
    to: A,
  });
  assert.equal(req.ok, true);
  if (!req.ok) return;
  const blockA = closeBlockedByPending([req.transfer], A.drawerId);
  const blockB = closeBlockedByPending([req.transfer], B.drawerId);
  assert.equal(blockA.ok, false);
  if (!blockA.ok) assert.match(blockA.error, /xfr_3/);
  assert.equal(blockB.ok, false);
  const after = respondTillTransfer({
    transfer: req.transfer,
    actor: { id: B.employeeId, name: B.employeeName },
    actorTillId: B.drawerId,
    action: "accept",
  });
  assert.equal(after.ok, true);
  if (!after.ok) return;
  assert.equal(closeBlockedByPending([after.transfer], A.drawerId).ok, true);
});

test("transfer after close started is rejected", () => {
  const req = requestTillTransfer({
    id: "xfr_4",
    locationId: "loc",
    amountCents: 500,
    from: { ...B, counting: true },
    to: A,
  });
  assert.equal(req.ok, false);
  const pending = requestTillTransfer({
    id: "xfr_5",
    locationId: "loc",
    amountCents: 500,
    from: B,
    to: A,
  });
  assert.equal(pending.ok, true);
  if (!pending.ok) return;
  const acc = respondTillTransfer({
    transfer: pending.transfer,
    actor: { id: B.employeeId, name: B.employeeName },
    actorTillId: B.drawerId,
    action: "accept",
    countingFrom: true,
  });
  assert.equal(acc.ok, false);
});

test("cannot accept own request; cancel while pending does not move cash", () => {
  const req = requestTillTransfer({
    id: "xfr_6",
    locationId: "loc",
    amountCents: 1000,
    from: B,
    to: A,
  });
  assert.equal(req.ok, true);
  if (!req.ok) return;
  const self = respondTillTransfer({
    transfer: req.transfer,
    actor: { id: A.employeeId, name: A.employeeName },
    actorTillId: B.drawerId,
    action: "accept",
  });
  assert.equal(self.ok, false);
  const cancel = cancelTillTransfer({ transfer: req.transfer, actorId: A.employeeId });
  assert.equal(cancel.ok, true);
  if (!cancel.ok) return;
  assert.equal(cancel.transfer.status, "cancelled");
  assert.equal(acceptedTotalsForTill([cancel.transfer], A.drawerId).transfersInCents, 0);
});

test("manager reverse after accept creates opposite accepted transfer", () => {
  const req = requestTillTransfer({
    id: "xfr_7",
    locationId: "loc",
    amountCents: 4000,
    from: B,
    to: A,
  });
  assert.equal(req.ok, true);
  if (!req.ok) return;
  const acc = respondTillTransfer({
    transfer: req.transfer,
    actor: { id: B.employeeId, name: B.employeeName },
    actorTillId: B.drawerId,
    action: "accept",
  });
  assert.equal(acc.ok, true);
  if (!acc.ok) return;
  const rev = reverseTillTransfer({
    original: acc.transfer,
    newId: "xfr_7r",
    manager: { id: "mgr", name: "Morgan" },
  });
  assert.equal(rev.ok, true);
  if (!rev.ok) return;
  assert.equal(rev.original.status, "reversed");
  assert.equal(rev.reverse.status, "accepted");
  assert.equal(rev.reverse.fromDrawerId, A.drawerId);
  assert.equal(rev.reverse.toDrawerId, B.drawerId);
  assert.equal(rev.reverse.amountCents, 4000);
  const both = [rev.original, rev.reverse];
  assert.equal(acceptedTotalsForTill(both, A.drawerId).transfersInCents, 4000);
  assert.equal(acceptedTotalsForTill(both, A.drawerId).transfersOutCents, 4000);
  assert.equal(acceptedTotalsForTill(both, B.drawerId).transfersOutCents, 4000);
  assert.equal(acceptedTotalsForTill(both, B.drawerId).transfersInCents, 4000);
  assert.equal(
    expectedTillCashCents({
      openingBankCents: 15000,
      cashSalesCents: 0,
      cashRefundsCents: 0,
      paidOutsCents: 0,
      paidInsCents: 0,
      dropsCents: 0,
      ...acceptedTotalsForTill(both, A.drawerId),
    }),
    15000,
  );
});

test("handed denoms must equal transfer total", () => {
  const req = requestTillTransfer({
    id: "xfr_8",
    locationId: "loc",
    amountCents: 2000,
    from: B,
    to: A,
  });
  assert.equal(req.ok, true);
  if (!req.ok) return;
  const bad = respondTillTransfer({
    transfer: req.transfer,
    actor: { id: B.employeeId, name: B.employeeName },
    actorTillId: B.drawerId,
    action: "accept",
    handedDenoms: { "1": 1 },
  });
  assert.equal(bad.ok, false);
  const ok = respondTillTransfer({
    transfer: req.transfer,
    actor: { id: B.employeeId, name: B.employeeName },
    actorTillId: B.drawerId,
    action: "accept",
    handedDenoms: { "10": 2 },
  });
  assert.equal(ok.ok, true);
});

test("expected formula includes accepted transfers only", () => {
  const snap = snapshotExpected({
    openingBankCents: 15000,
    cashSalesCents: 8000,
    cashRefundsCents: 0,
    paidOutsCents: 0,
    paidInsCents: 0,
    dropsCents: 1000,
    transfersInCents: 2000,
    transfersOutCents: 500,
  });
  assert.equal(snap.expectedCents, 15000 + 8000 - 1000 + 2000 - 500);
});

test("cannot transfer more than cash in that till", () => {
  const req = requestTillTransfer({
    id: "xfr_9",
    locationId: "loc",
    amountCents: 5000,
    from: B,
    to: A,
    availableFromCents: 2000,
  });
  assert.equal(req.ok, false);
  const pending = requestTillTransfer({
    id: "xfr_10",
    locationId: "loc",
    amountCents: 2000,
    from: B,
    to: A,
    availableFromCents: 2000,
  });
  assert.equal(pending.ok, true);
  if (!pending.ok) return;
  const acc = respondTillTransfer({
    transfer: pending.transfer,
    actor: { id: B.employeeId, name: B.employeeName },
    actorTillId: B.drawerId,
    action: "accept",
    availableFromCents: 500,
  });
  assert.equal(acc.ok, false);
});

test("transfer slip names both tills and keep-with-drawer", () => {
  const req = requestTillTransfer({
    id: "xfr_11",
    locationId: "loc",
    amountCents: 2000,
    from: B,
    to: A,
    requestedDenoms: { "1": 10, "5": 2 },
  });
  assert.equal(req.ok, true);
  if (!req.ok) return;
  const lines = formatTransferSlipLines(req.transfer);
  assert.equal(lines[0], "TILL TRANSFER");
  assert.match(lines.join("\n"), /FROM Till B/);
  assert.match(lines.join("\n"), /TO Till A/);
  assert.match(lines.join("\n"), /AMOUNT \$20\.00/);
  assert.match(lines.join("\n"), /Keep with drawer until drop \/ close\./);
  const line = formatTransferLine({
    dir: "in",
    amountCents: 4000,
    otherTillName: "Till 2",
    otherEmployeeName: "Blair",
    id: "xfr",
  });
  assert.equal(line, "In: +$40.00 from Till 2");
  const open = listOpenTills({
    excludeDrawerId: "drw_a",
    employees: [
      { id: "emp_a", name: "Alex" },
      { id: "emp_b", name: "Blair" },
    ],
    drawers: {
      drw_a: {},
      drw_b: {},
      drw_closed: { closedAt: 1 },
    },
    banks: {},
    drawerMeta: [
      { id: "drw_a", name: "Till A", assignedEmployeeIds: ["emp_a"] },
      { id: "drw_b", name: "Till B", assignedEmployeeIds: ["emp_b"] },
      { id: "drw_closed", name: "Closed", assignedEmployeeIds: ["emp_b"] },
    ],
    countingIds: [],
  });
  assert.equal(open.length, 1);
  assert.equal(open[0]?.drawerId, "drw_b");
});
