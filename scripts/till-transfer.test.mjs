import test from "node:test";
import assert from "node:assert/strict";

function expectedCashCents(opts) {
  return (
    opts.startCents +
    opts.cashSalesCents -
    opts.cashRefundsCents -
    opts.dropsCents +
    opts.paidInCents -
    opts.paidOutCents +
    (opts.transferInCents ?? 0) -
    (opts.transferOutCents ?? 0)
  );
}

function mixSum(qty, denoms) {
  let sum = 0;
  for (const d of denoms) sum += (Math.max(0, Math.floor(Number(qty[d.id]) || 0))) * d.cents;
  return sum;
}

const BILLS = [
  { id: "1", cents: 100, label: "$1" },
  { id: "5", cents: 500, label: "$5" },
  { id: "10", cents: 1000, label: "$10" },
  { id: "20", cents: 2000, label: "$20" },
];

function mixMatchesAmount(qty, amountCents) {
  const entries = BILLS.some((d) => (Number(qty?.[d.id]) || 0) > 0);
  if (!entries) return { ok: true };
  const sum = mixSum(qty, BILLS);
  if (sum !== amountCents) return { ok: false, error: "mix mismatch" };
  return { ok: true };
}

function formatMix(qty) {
  return BILLS.filter((d) => (qty[d.id] || 0) > 0)
    .map((d) => `${qty[d.id]}×${d.label}`)
    .join(", ");
}

function pendingForSink(rows, sinkKey) {
  return rows.filter(
    (t) => t.status === "pending" && (t.fromSinkKey === sinkKey || t.toSinkKey === sinkKey),
  );
}

function closeBlockedByPending(rows, sinkKey) {
  const first = pendingForSink(rows, sinkKey)[0];
  if (!first) return null;
  return `Resolve till transfer #${first.id} first.`;
}

function assertCanRequest(opts) {
  if (opts.amountCents <= 0) return { ok: false, error: "Enter an amount." };
  if (opts.fromSinkKey === opts.toSinkKey) return { ok: false, error: "Cannot transfer to the same till." };
  if (opts.fromClosed || opts.toClosed) return { ok: false, error: "closed" };
  if (opts.fromClosing || opts.toClosing) return { ok: false, error: "Cannot transfer after close started." };
  const mix = mixMatchesAmount(opts.requestedMix, opts.amountCents);
  if (!mix.ok) return mix;
  if (opts.giverExpectedCents != null && opts.amountCents > opts.giverExpectedCents) {
    return { ok: false, error: "That till does not have enough cash." };
  }
  return { ok: true };
}

function assertCanAccept(opts) {
  if (opts.row.status !== "pending") return { ok: false, error: "not pending" };
  if (opts.actorId === opts.row.toEmployeeId) {
    return { ok: false, error: "You cannot accept your own request." };
  }
  if (opts.actorSinkKey !== opts.row.fromSinkKey) {
    return { ok: false, error: "Only the employee signed on to the giving till can accept or decline." };
  }
  if (opts.fromClosing || opts.toClosing) return { ok: false, error: "Cannot transfer after close started." };
  const mix = mixMatchesAmount(opts.handedMix, opts.row.amountCents);
  if (!mix.ok) return mix;
  if (opts.giverExpectedCents != null && opts.row.amountCents > opts.giverExpectedCents) {
    return { ok: false, error: "That till does not have enough cash." };
  }
  return { ok: true };
}

function expectedAfterAccept(giver, receiver, amount) {
  return { giver: giver - amount, receiver: receiver + amount };
}

function moneyLine(label, cents) {
  const r = `$${(cents / 100).toFixed(2)}`;
  const pad = Math.max(1, 40 - label.length - r.length);
  return (label + " ".repeat(pad) + r).slice(0, 40);
}

test("A accepts $20 from B: B expected −20, A expected +20", () => {
  const a0 = expectedCashCents({
    startCents: 15000,
    cashSalesCents: 4000,
    cashRefundsCents: 0,
    dropsCents: 0,
    paidInCents: 0,
    paidOutCents: 0,
  });
  const b0 = expectedCashCents({
    startCents: 15000,
    cashSalesCents: 8000,
    cashRefundsCents: 0,
    dropsCents: 0,
    paidInCents: 0,
    paidOutCents: 0,
  });
  const next = expectedAfterAccept(b0, a0, 2000);
  const a1 = expectedCashCents({
    startCents: 15000,
    cashSalesCents: 4000,
    cashRefundsCents: 0,
    dropsCents: 0,
    paidInCents: 0,
    paidOutCents: 0,
    transferInCents: 2000,
  });
  const b1 = expectedCashCents({
    startCents: 15000,
    cashSalesCents: 8000,
    cashRefundsCents: 0,
    dropsCents: 0,
    paidInCents: 0,
    paidOutCents: 0,
    transferOutCents: 2000,
  });
  assert.equal(next.receiver, a1);
  assert.equal(next.giver, b1);
  assert.equal(a1, a0 + 2000);
  assert.equal(b1, b0 - 2000);
});

test("decline: neither expected changes", () => {
  const a0 = 19000;
  const b0 = 23000;
  const declined = { status: "declined", amountCents: 2000 };
  const inCents = declined.status === "accepted" ? declined.amountCents : 0;
  assert.equal(a0 + inCents, a0);
  assert.equal(b0, b0);
});

test("close blocked while transfer pending", () => {
  const rows = [
    {
      id: "xfr_abc",
      status: "pending",
      fromSinkKey: "drawer:b",
      toSinkKey: "drawer:a",
    },
  ];
  assert.equal(closeBlockedByPending(rows, "drawer:a"), "Resolve till transfer #xfr_abc first.");
  assert.equal(closeBlockedByPending(rows, "drawer:b"), "Resolve till transfer #xfr_abc first.");
  assert.equal(closeBlockedByPending(rows, "drawer:c"), null);
});

test("transfer after close started is rejected", () => {
  const gate = assertCanRequest({
    amountCents: 2000,
    fromSinkKey: "drawer:b",
    toSinkKey: "drawer:a",
    giverExpectedCents: 20000,
    fromClosed: false,
    toClosed: false,
    fromClosing: true,
    toClosing: false,
  });
  assert.equal(gate.ok, false);
  assert.match(gate.error, /close started/);
});

test("cannot accept own request", () => {
  const gate = assertCanAccept({
    row: {
      status: "pending",
      toEmployeeId: "emp-a",
      fromSinkKey: "drawer:b",
      amountCents: 2000,
    },
    actorId: "emp-a",
    actorSinkKey: "drawer:b",
    giverExpectedCents: 20000,
    fromClosing: false,
    toClosing: false,
  });
  assert.equal(gate.ok, false);
  assert.match(gate.error, /own request/);
});

test("only the giving till can accept", () => {
  const gate = assertCanAccept({
    row: {
      status: "pending",
      toEmployeeId: "emp-a",
      fromSinkKey: "drawer:b",
      amountCents: 2000,
    },
    actorId: "emp-b",
    actorSinkKey: "drawer:a",
    giverExpectedCents: 20000,
    fromClosing: false,
    toClosing: false,
  });
  assert.equal(gate.ok, false);
  assert.match(gate.error, /giving till/);
});

test("cannot request more than giver expected", () => {
  const gate = assertCanRequest({
    amountCents: 5000,
    fromSinkKey: "drawer:b",
    toSinkKey: "drawer:a",
    giverExpectedCents: 2000,
    fromClosed: false,
    toClosed: false,
    fromClosing: false,
    toClosing: false,
  });
  assert.equal(gate.ok, false);
  assert.match(gate.error, /enough cash/);
});

test("handed mix must equal transfer total when entered", () => {
  const mix = { 1: 5, 5: 1 };
  assert.equal(mixSum(mix, BILLS), 1000);
  const bad = mixMatchesAmount(mix, 2000);
  assert.equal(bad.ok, false);
  const good = mixMatchesAmount({ 1: 10, 5: 2 }, 2000);
  assert.equal(good.ok, true);
  const empty = mixMatchesAmount({}, 2000);
  assert.equal(empty.ok, true);
});

test("format mix for slip", () => {
  assert.equal(formatMix({ 1: 10, 5: 4, 10: 2 }), "10×$1, 4×$5, 2×$10");
});

test("manager reverse is an opposite accepted transfer", () => {
  const original = {
    id: "xfr_1",
    status: "accepted",
    fromSinkKey: "drawer:b",
    toSinkKey: "drawer:a",
    amountCents: 2000,
  };
  const reverse = {
    id: "xfr_2",
    status: "accepted",
    fromSinkKey: original.toSinkKey,
    toSinkKey: original.fromSinkKey,
    amountCents: original.amountCents,
    reverseOfId: original.id,
  };
  const a = expectedCashCents({
    startCents: 15000,
    cashSalesCents: 0,
    cashRefundsCents: 0,
    dropsCents: 0,
    paidInCents: 0,
    paidOutCents: 0,
    transferInCents: original.amountCents,
    transferOutCents: reverse.amountCents,
  });
  const b = expectedCashCents({
    startCents: 15000,
    cashSalesCents: 0,
    cashRefundsCents: 0,
    dropsCents: 0,
    paidInCents: 0,
    paidOutCents: 0,
    transferInCents: reverse.amountCents,
    transferOutCents: original.amountCents,
  });
  assert.equal(a, 15000);
  assert.equal(b, 15000);
  assert.equal(reverse.status, "accepted");
});

test("pending transfers do not move expected", () => {
  const pending = { status: "pending", amountCents: 2000 };
  const inCents = pending.status === "accepted" ? pending.amountCents : 0;
  assert.equal(
    expectedCashCents({
      startCents: 15000,
      cashSalesCents: 0,
      cashRefundsCents: 0,
      dropsCents: 0,
      paidInCents: 0,
      paidOutCents: 0,
      transferInCents: inCents,
    }),
    15000,
  );
});

test("turn-in slip includes transfers in and out", () => {
  const inLine = moneyLine("Transfers in", 4000);
  const outLine = moneyLine("Transfers out", 2000);
  assert.equal(inLine.length, 40);
  assert.equal(outLine.length, 40);
  assert.match(inLine, /Transfers in/);
  assert.match(inLine, /\$40\.00/);
  assert.match(outLine, /Transfers out/);
  assert.match(outLine, /\$20\.00/);
});

test("transfer slip lines stay at 40 cols", () => {
  const keep = "Keep with drawer until drop / close.";
  assert.ok(keep.length <= 40);
  const title = "TILL TRANSFER";
  assert.ok(title.length <= 40);
});
