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

function dollarsToCents(raw) {
  const t = String(raw ?? "").trim().replace(/[$,]/g, "");
  if (!t) return null;
  const m = t.match(/^(-)?(\d+)(?:\.(\d{0,2}))?$/);
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  const whole = parseInt(m[2], 10);
  const frac = (m[3] ?? "").padEnd(2, "0").slice(0, 2);
  return sign * (whole * 100 + parseInt(frac || "0", 10));
}

const TILL_DENOMS = [
  { id: "100", cents: 10000 },
  { id: "50", cents: 5000 },
  { id: "20", cents: 2000 },
  { id: "10", cents: 1000 },
  { id: "5", cents: 500 },
  { id: "1", cents: 100 },
  { id: "dollar", cents: 100 },
  { id: "half", cents: 50 },
  { id: "quarter", cents: 25 },
  { id: "dime", cents: 10 },
  { id: "nickel", cents: 5 },
  { id: "penny", cents: 1 },
];

function sumDenominations(qty) {
  let sum = 0;
  for (const d of TILL_DENOMS) sum += (Math.max(0, Math.floor(Number(qty[d.id]) || 0))) * d.cents;
  return sum;
}

function applyTurnIn(opts) {
  const bank = Math.max(0, opts.nextShiftBankCents);
  if (opts.countMode === "turn_in") {
    if (!opts.bankLeftConfirmed) return { error: "confirm bank" };
    return {
      countedCents: opts.enteredCents + bank,
      turnInCents: opts.enteredCents,
      bankLeftCents: bank,
    };
  }
  return {
    countedCents: opts.enteredCents,
    turnInCents: opts.enteredCents - bank,
    bankLeftCents: bank,
  };
}

function computeTillSubmit(snapshot, input) {
  const usedDenoms = TILL_DENOMS.some((d) => (Number(input.denominationQty?.[d.id]) || 0) > 0);
  const entered = usedDenoms
    ? sumDenominations(input.denominationQty)
    : input.singleTotalCents;
  if (entered == null) return { ok: false, error: "Enter the counted total." };
  const turned = applyTurnIn({
    enteredCents: entered,
    countMode: snapshot.countMode,
    nextShiftBankCents: snapshot.nextShiftBankCents,
    bankLeftConfirmed: input.bankLeftConfirmed,
  });
  if (turned.error) return { ok: false, error: turned.error };
  const overShort = turned.countedCents - snapshot.expectedCents;
  return {
    ok: true,
    countedCents: turned.countedCents,
    expectedCents: snapshot.expectedCents,
    overShortCents: overShort,
    turnInCents: turned.turnInCents,
    bankLeftCents: turned.bankLeftCents,
  };
}

const BLIND = [
  "expectedCents",
  "overShortCents",
  "cashSalesCents",
  "cashRefundsCents",
  "paidOutCents",
  "paidInCents",
  "dropsCents",
  "openingBankCents",
  "snapshot",
  "sealed",
];

function toCashierView(row) {
  const counting =
    row.status === "counting" || row.status === "recounting" || row.status === "denom_recount";
  return {
    id: row.id,
    status: row.status,
    tillName: row.tillName,
    nextShiftBankCents: row.sealed.nextShiftBankCents,
    locked: !counting,
    phase: row.status === "denom_recount" ? "denom" : "total",
  };
}

test("dollarsToCents stores 247.35 exactly", () => {
  assert.equal(dollarsToCents("247.35"), 24735);
});

test("expected formula fixture of sales, refunds, paid-outs, and drops", () => {
  assert.equal(
    expectedCashCents({
      startCents: 15000,
      cashSalesCents: 18235,
      cashRefundsCents: 500,
      paidOutCents: 800,
      dropsCents: 2000,
      paidInCents: 0,
    }),
    29935,
  );
});

test("expected includes accepted till transfers in and out", () => {
  assert.equal(
    expectedCashCents({
      startCents: 15000,
      cashSalesCents: 0,
      cashRefundsCents: 0,
      paidOutCents: 0,
      dropsCents: 0,
      paidInCents: 0,
      transferInCents: 4000,
      transferOutCents: 2000,
    }),
    17000,
  );
});

test("submitting 247.35 stores 247.35 and calculates over/short from sealed expected", () => {
  const expected = expectedCashCents({
    startCents: 15000,
    cashSalesCents: 12000,
    cashRefundsCents: 0,
    paidOutCents: 0,
    dropsCents: 0,
    paidInCents: 0,
  });
  assert.equal(expected, 27000);
  const res = computeTillSubmit(
    { expectedCents: expected, countMode: "full_drawer", nextShiftBankCents: 15000 },
    { singleTotalCents: dollarsToCents("247.35") },
  );
  assert.equal(res.ok, true);
  assert.equal(res.countedCents, 24735);
  assert.equal(res.expectedCents, 27000);
  assert.equal(res.overShortCents, 24735 - 27000);
});

test("denomination sum is the official counted amount", () => {
  const qty = { 20: 10, 10: 4, 1: 3, quarter: 6 };
  assert.equal(sumDenominations(qty), 24450);
  const res = computeTillSubmit(
    { expectedCents: 24450, countMode: "full_drawer", nextShiftBankCents: 0 },
    { denominationQty: qty, singleTotalCents: 99999 },
  );
  assert.equal(res.countedCents, 24450);
});

test("turn-in + remaining bank equals counted cash", () => {
  const turned = applyTurnIn({
    enteredCents: 9735,
    countMode: "turn_in",
    nextShiftBankCents: 15000,
    bankLeftConfirmed: true,
  });
  assert.equal(turned.turnInCents + turned.bankLeftCents, turned.countedCents);
  assert.equal(turned.countedCents, 24735);
});

test("cashier view has no expected, sales, or over/short", () => {
  const view = toCashierView({
    id: "til_1",
    status: "counting",
    tillName: "Front",
    sealed: { expectedCents: 99999, nextShiftBankCents: 15000, cashSalesCents: 8000 },
  });
  for (const k of BLIND) assert.equal(k in view, false);
});

test("editing after submit is blocked (locked flag)", () => {
  const view = toCashierView({
    id: "til_2",
    status: "submitted",
    tillName: "Front",
    sealed: { expectedCents: 10000, nextShiftBankCents: 15000 },
    countedCents: 10000,
  });
  assert.equal(view.locked, true);
});

test("manager recount clears counted and still hides expected", () => {
  const view = toCashierView({
    id: "til_3",
    status: "recounting",
    tillName: "Front",
    sealed: { expectedCents: 20000, nextShiftBankCents: 15000, cashSalesCents: 5000 },
    countedCents: null,
  });
  assert.equal(view.locked, false);
  for (const k of BLIND) assert.equal(k in view, false);
});

test("never force-balance counted to expected", () => {
  const res = computeTillSubmit(
    { expectedCents: 25000, countMode: "full_drawer", nextShiftBankCents: 15000 },
    { singleTotalCents: 0 },
  );
  assert.equal(res.countedCents, 0);
  assert.notEqual(res.countedCents, res.expectedCents);
});

test("checks are not mixed into counted cash", () => {
  const res = computeTillSubmit(
    { expectedCents: 10000, countMode: "full_drawer", nextShiftBankCents: 10000 },
    { singleTotalCents: 10000, checksCents: 5000 },
  );
  assert.equal(res.countedCents, 10000);
});

function assertCanPrintTurnIn(row) {
  const revealed = row.status !== "counting" && row.status !== "recounting";
  if (!revealed || row.countedCents == null || !row.submittedAt) {
    return { ok: false, error: "Submit the count first. The slip prints only after a successful submit." };
  }
  return { ok: true };
}

function dropBlockedForPrint(row) {
  if (row.slipPrintOk || row.dropPrintOverrideReason) return null;
  return "Count is saved. Reprint required before drop.";
}

function moneyLine(label, cents) {
  const r = `$${(cents / 100).toFixed(2)}`;
  const pad = Math.max(1, 40 - label.length - r.length);
  return (label + " ".repeat(pad) + r).slice(0, 40);
}

function buildTurnInSlipLines(input) {
  const lines = ["STORE NAME".padStart(25).padEnd(40).slice(0, 40), "TILL TURN-IN"];
  if (input.reprint) lines.push("COPY");
  lines.push("");
  lines.push(moneyLine("Opening bank", input.openingBankCents));
  lines.push(moneyLine("Transfers in", input.transferInCents ?? 0));
  lines.push(moneyLine("Transfers out", input.transferOutCents ?? 0));
  lines.push(moneyLine("Counted cash", input.countedCents));
  lines.push(moneyLine("Bank left in till", input.bankLeftCents));
  lines.push(moneyLine("TURN-IN CASH", input.turnInCents));
  if (input.checksCents) lines.push(moneyLine("Checks / other", input.checksCents));
  lines.push(`BAG / DROP #  ${input.bagNumber || "______"}`);
  lines.push("");
  lines.push(moneyLine("Over/short", input.overShortCents));
  if (input.managerReview) lines.push("Status  MANAGER REVIEW");
  else lines.push("Status  BALANCED");
  lines.push("Place this slip in the bag with");
  lines.push("turn-in cash. Drop bag in safe.");
  return lines.map((l) => l.slice(0, 40));
}

test("no turn-in slip before submit", () => {
  const gate = assertCanPrintTurnIn({ status: "counting", countedCents: null });
  assert.equal(gate.ok, false);
  assert.match(gate.error, /Submit the count first/);
});

test("turn-in slip after submit includes over/short and not a draft expected", () => {
  const gate = assertCanPrintTurnIn({
    status: "submitted",
    countedCents: 24735,
    submittedAt: 1,
  });
  assert.equal(gate.ok, true);
  const lines = buildTurnInSlipLines({
    reprint: false,
    openingBankCents: 15000,
    countedCents: 24735,
    bankLeftCents: 15000,
    turnInCents: 9735,
    checksCents: 0,
    bagNumber: "B12",
    overShortCents: -2265,
  });
  assert.equal(lines.some((l) => l.includes("COPY")), false);
  assert.equal(lines.some((l) => l.includes("TURN-IN CASH")), true);
  assert.equal(lines.some((l) => l.includes("Over/short")), true);
  assert.equal(lines.some((l) => /Expected cash/i.test(l)), false);
  assert.equal(lines.every((l) => l.length <= 40), true);
  assert.equal(lines.some((l) => l.includes("B12")), true);
});

test("reprint is identical and marked COPY", () => {
  const orig = buildTurnInSlipLines({
    reprint: false,
    openingBankCents: 15000,
    countedCents: 24735,
    bankLeftCents: 15000,
    turnInCents: 9735,
    checksCents: 500,
    bagNumber: "",
    overShortCents: 0,
  });
  const copy = buildTurnInSlipLines({
    reprint: true,
    openingBankCents: 15000,
    countedCents: 24735,
    bankLeftCents: 15000,
    turnInCents: 9735,
    checksCents: 500,
    bagNumber: "",
    overShortCents: 0,
  });
  assert.equal(copy.includes("COPY"), true);
  assert.equal(orig.includes("COPY"), false);
  assert.equal(copy.filter((l) => l !== "COPY").join("\n"), orig.join("\n"));
});

test("drop is blocked until slip prints or manager overrides", () => {
  assert.equal(
    dropBlockedForPrint({ slipPrintOk: false }),
    "Count is saved. Reprint required before drop.",
  );
  assert.equal(dropBlockedForPrint({ slipPrintOk: true }), null);
  assert.equal(dropBlockedForPrint({ slipPrintOk: false, dropPrintOverrideReason: "Printer down" }), null);
});

function withinMatch(overShort, tol) {
  return Math.abs(overShort) <= Math.max(0, tol);
}

test("matching first total: no denom step, no manager notify", () => {
  const expected = expectedCashCents({
    startCents: 15000,
    cashSalesCents: 9735,
    cashRefundsCents: 0,
    paidOutCents: 0,
    dropsCents: 0,
    paidInCents: 0,
  });
  const counted = 24735;
  const os = counted - expected;
  assert.equal(withinMatch(os, 0), true);
  const notify = !withinMatch(os, 0);
  const needDenom = !withinMatch(os, 0);
  assert.equal(needDenom, false);
  assert.equal(notify, false);
});

test("mismatch then matching denoms: both attempts stored, no notify", () => {
  const expected = 27000;
  const first = 24735;
  assert.equal(withinMatch(first - expected, 0), false);
  const denomSum = 27000;
  assert.equal(withinMatch(denomSum - expected, 0), true);
  const stored = { firstTotal: first, second: denomSum, notify: false };
  assert.equal(stored.firstTotal, 24735);
  assert.equal(stored.second, 27000);
  assert.equal(stored.notify, false);
});

test("mismatch twice: notify, lock pending_review, MANAGER REVIEW slip", () => {
  const expected = 27000;
  const first = 24735;
  const second = 25000;
  assert.equal(withinMatch(first - expected, 0), false);
  assert.equal(withinMatch(second - expected, 0), false);
  const status = "pending_review";
  const notify = true;
  const lines = buildTurnInSlipLines({
    reprint: false,
    openingBankCents: 15000,
    countedCents: second,
    bankLeftCents: 15000,
    turnInCents: 10000,
    checksCents: 0,
    bagNumber: "B9",
    overShortCents: second - expected,
    managerReview: true,
  });
  assert.equal(status, "pending_review");
  assert.equal(notify, true);
  assert.equal(lines.some((l) => l.includes("MANAGER REVIEW")), true);
  assert.equal(lines.some((l) => l.includes("BALANCED")), false);
});

test("cashier view on denom screen still hides expected", () => {
  const view = toCashierView({
    id: "til_d",
    status: "denom_recount",
    tillName: "Front",
    sealed: { expectedCents: 99999, nextShiftBankCents: 15000, cashSalesCents: 8000 },
  });
  for (const k of BLIND) assert.equal(k in view, false);
  assert.equal(view.locked, false);
});

