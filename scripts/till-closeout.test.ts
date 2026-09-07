import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCountAttempt,
  applyRecount,
  DENOM_MISMATCH_MESSAGE,
  applyTurnIn,
  assertBlindScreen,
  countedFromDenoms,
  expectedTillCashCents,
  isCountLocked,
  officialCountedCents,
  overShortCents,
  snapshotExpected,
  toBlindScreen,
  dropBlockedForPrint,
  toResult,
  turnInPlusBankEqualsCounted,
  type TillCloseConfig,
  type TillCloseRecord,
} from "../src/lib/pos/till-closeout.ts";
import {
  TURN_IN_SLIP_WIDTH,
  formatTurnInSlip,
  formatTurnInSlipLines,
  turnInSlipFromRecord,
} from "../src/lib/pos/till-turn-in-slip.ts";


const TILL: TillCloseConfig = {
  countMode: "full_drawer",
  denominationRequired: false,
  dualControlRequired: false,
  dropBagRequired: false,
  otherTendersEnabled: true,
  nextShiftBankCents: 15000,
  varianceAction: "warn",
  bankMix: [],
  turnInSlipCopies: 1,
  matchToleranceCents: 0,
  revealVarianceAfterFinalMismatch: false,
  notifyInApp: true,
  notifySms: true,
  notifyEmail: true,
  notifyPush: true,
  notifyEmails: [],
};

function rec(over?: Partial<TillCloseRecord>): TillCloseRecord {
  const expected = snapshotExpected({
    openingBankCents: 15000,
    cashSalesCents: 12000,
    cashRefundsCents: 500,
    paidOutsCents: 300,
    paidInsCents: 0,
    dropsCents: 2000,
  });
  return {
    id: "tcl_1",
    locationId: "loc",
    drawerId: "drw_front",
    drawerName: "Front",
    sinkType: "drawer",
    employeeId: "emp_1",
    employeeName: "Alex",
    employeeRole: "cashier",
    status: "counting",
    countMode: "full_drawer",
    denominationRequired: false,
    nextShiftBankCents: 15000,
    denoms: null,
    countedCents: null,
    turnInCents: null,
    bankLeftCents: null,
    overShortCents: null,
    checksCents: 0,
    moneyOrdersCents: 0,
    bagNumber: null,
    comment: null,
    managerNote: null,
    witnessEmployeeId: null,
    witnessEmployeeName: null,
    startedAt: 1,
    submittedAt: null,
    acceptedAt: null,
    acceptedById: null,
    acceptedByName: null,
    droppedAt: null,
    droppedById: null,
    voidedAt: null,
    voidedById: null,
    recountOfId: null,
    recountCount: 0,
    deviceId: "dev_1",
    ip: "10.0.0.8",
    cashBlocked: true,
    openingBankCorrectedCents: null,
    counterfeitPulledCents: 0,
    expected,
    slipPrintOk: false,
    slipPrintedAt: null,
    slipReprintCount: 0,
    printOverrideReason: null,
    printOverrideById: null,
    printOverrideByName: null,
    firstCountedCents: null,
    firstSubmittedAt: null,
    denomCountedCents: null,
    managerAckAt: null,
    managerAckById: null,
    notifySentAt: null,
    ...over,
  };
}

test("expected formula: opening + sales − refunds − paid-outs − drops + paid-ins", () => {
  assert.equal(
    expectedTillCashCents({
      openingBankCents: 15000,
      cashSalesCents: 12000,
      cashRefundsCents: 500,
      paidOutsCents: 300,
      paidInsCents: 100,
      dropsCents: 2000,
    }),
    15000 + 12000 - 500 - 300 - 2000 + 100,
  );
});

test("fixture: sales, refunds, paid-outs, and mid-shift drops", () => {
  // $150 bank + $247.35 sales − $12 refund − $20 paid-out − $50 drop
  const expected = expectedTillCashCents({
    openingBankCents: 15000,
    cashSalesCents: 24735,
    cashRefundsCents: 1200,
    paidOutsCents: 2000,
    paidInsCents: 0,
    dropsCents: 5000,
  });
  assert.equal(expected, 15000 + 24735 - 1200 - 2000 - 5000);
  assert.equal(expected, 31535);
});

test("matching first total closes without a denom screen or manager notify", () => {
  const row = rec({
    expected: snapshotExpected({
      openingBankCents: 15000,
      cashSalesCents: 10000,
      cashRefundsCents: 0,
      paidOutsCents: 0,
      paidInsCents: 0,
      dropsCents: 0,
    }),
  });
  const applied = applyCountAttempt(row, { countedTotalCents: 25000 }, TILL);
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.kind, "matched");
  if (applied.kind !== "matched") return;
  assert.equal(applied.rec.countedCents, 25000);
  assert.equal(applied.rec.overShortCents, 0);
  assert.equal(applied.rec.denoms, null);
  assert.equal(applied.rec.status, "auto_accepted");
  assert.equal(isCountLocked(applied.rec.status), true);
  const screen = toBlindScreen(applied.rec, TILL);
  assert.equal(screen.step, "total");
});

test("denomination sum is the official counted amount", () => {
  const sum = countedFromDenoms({ "20": 10, "10": 4, "1": 7, quarter: 6, dime: 1, nickel: 1 });
  // 10×20 + 4×10 + 7×1 + 6×0.25 + 0.10 + 0.05 = 200+40+7+1.50+0.10+0.05 = 248.65
  assert.equal(sum, 24865);
  const official = officialCountedCents({
    denoms: { "20": 10 },
    countedTotalCents: 99999,
    denominationRequired: false,
  });
  assert.equal(official.ok, true);
  if (official.ok) assert.equal(official.countedCents, 20000);
});

test("do not prefill counted with expected — empty submit is rejected", () => {
  const official = officialCountedCents({
    denoms: {},
    countedTotalCents: null,
    denominationRequired: false,
  });
  assert.equal(official.ok, false);
});

test("never force-balance: a $0 first total does not close as expected", () => {
  const row = rec();
  const expected = row.expected!.expectedCents;
  const applied = applyCountAttempt(row, { countedTotalCents: 0 }, TILL);
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.kind, "need_denoms");
  if (applied.kind !== "need_denoms") return;
  assert.equal(applied.rec.countedCents, null);
  assert.equal(applied.rec.firstCountedCents, 0);
  assert.notEqual(applied.rec.firstCountedCents, expected);
  assert.equal(applied.rec.status, "denom_required");
  assert.equal(applied.message, DENOM_MISMATCH_MESSAGE);
  const screen = toBlindScreen(applied.rec, TILL);
  assert.equal(screen.step, "denom");
  assert.deepEqual(assertBlindScreen(screen), []);
  assert.equal(JSON.stringify(screen).includes("expectedCents"), false);
  assert.equal(JSON.stringify(screen).includes("overShort"), false);
});

test("mismatch then matching denoms: no notify, both attempts stored, slip balanced", () => {
  const expected = rec().expected!.expectedCents;
  const first = applyCountAttempt(rec(), { countedTotalCents: 10000 }, TILL);
  assert.equal(first.ok && first.kind === "need_denoms", true);
  if (!first.ok || first.kind !== "need_denoms") return;
  assert.equal(JSON.stringify(toBlindScreen(first.rec, TILL)).includes("expectedCents"), false);
  const denoms = { "100": 2, "20": 2, "1": 2 };
  assert.equal(countedFromDenoms(denoms), expected);
  const second = applyCountAttempt(first.rec, { denoms }, TILL);
  assert.equal(second.ok && second.kind === "matched", true);
  if (!second.ok || second.kind !== "matched") return;
  assert.equal(second.rec.firstCountedCents, 10000);
  assert.equal(second.rec.denomCountedCents, expected);
  assert.equal(second.rec.countedCents, expected);
  assert.equal(second.rec.overShortCents, 0);
  assert.equal(second.rec.status, "auto_accepted");
});

test("mismatch twice: notify path, close locked, MANAGER REVIEW", () => {
  const first = applyCountAttempt(rec(), { countedTotalCents: 10000 }, TILL);
  assert.equal(first.ok && first.kind === "need_denoms", true);
  if (!first.ok || first.kind !== "need_denoms") return;
  const second = applyCountAttempt(first.rec, { denoms: { "20": 1 } }, TILL);
  assert.equal(second.ok && second.kind === "pending_review", true);
  if (!second.ok || second.kind !== "pending_review") return;
  assert.equal(second.rec.status, "pending_review");
  assert.equal(second.rec.firstCountedCents, 10000);
  assert.equal(second.rec.denomCountedCents, 2000);
  assert.equal(second.rec.countedCents, 2000);
  assert.equal(isCountLocked(second.rec.status), true);
  const result = toResult(second.rec);
  assert.equal("error" in result, false);
  if ("error" in result) return;
  assert.equal(result.slipStatus, "MANAGER REVIEW");
  assert.equal(result.revealVariance, false);
  const slip = turnInSlipFromRecord(second.rec, { storeName: "Harbor Grill" });
  assert.equal(slip.ok, true);
  if (slip.ok) assert.match(formatTurnInSlip(slip.slip), /MANAGER REVIEW/);
  const retype = applyCountAttempt(second.rec, { countedTotalCents: expectedTillCashCents(second.rec.expected!) }, TILL);
  assert.equal(retype.ok, false);
});

test("cashier cannot retype a single total on the denom screen", () => {
  const first = applyCountAttempt(rec(), { countedTotalCents: 10000 }, TILL);
  assert.equal(first.ok && first.kind === "need_denoms", true);
  if (!first.ok || first.kind !== "need_denoms") return;
  const guess = applyCountAttempt(first.rec, { countedTotalCents: first.rec.expected!.expectedCents }, TILL);
  assert.equal(guess.ok, false);
  if (!guess.ok) assert.match(guess.error, /denomination/i);
});

test("editing after a locked close is blocked", () => {
  const matched = applyCountAttempt(rec(), { countedTotalCents: rec().expected!.expectedCents }, TILL);
  assert.equal(matched.ok && matched.kind === "matched", true);
  if (!matched.ok || matched.kind !== "matched") return;
  const again = applyCountAttempt(matched.rec, { countedTotalCents: 1 }, TILL);
  assert.equal(again.ok, false);
  if (!again.ok) assert.match(again.error, /locked/i);
});

test("manager recount clears both attempts and still hides expected", () => {
  const first = applyCountAttempt(rec(), { countedTotalCents: 10000 }, TILL);
  assert.equal(first.ok && first.kind === "need_denoms", true);
  if (!first.ok || first.kind !== "need_denoms") return;
  const second = applyCountAttempt(first.rec, { denoms: { "20": 1 } }, TILL);
  assert.equal(second.ok && second.kind === "pending_review", true);
  if (!second.ok || second.kind !== "pending_review") return;
  const recounted = applyRecount(second.rec, "mgr_1");
  assert.equal(recounted.status, "recounting");
  assert.equal(recounted.countedCents, null);
  assert.equal(recounted.firstCountedCents, null);
  assert.equal(recounted.denomCountedCents, null);
  const screen = toBlindScreen(recounted, TILL);
  assert.equal(screen.step, "total");
  assert.deepEqual(assertBlindScreen(screen), []);
  assert.equal("error" in toResult(recounted), true);
});

test("blind count screen has no expected, sales, or variance", () => {
  const screen = toBlindScreen(rec(), TILL);
  assert.deepEqual(assertBlindScreen(screen), []);
  const keys = Object.keys(screen);
  assert.equal(keys.includes("expected"), false);
  assert.equal(keys.includes("expectedCents"), false);
  assert.equal(keys.includes("overShortCents"), false);
  assert.equal(keys.includes("cashSalesCents"), false);
  assert.equal((screen as { expected?: unknown }).expected, undefined);
});

test("turn-in + remaining bank equals counted cash", () => {
  const turn = applyTurnIn({
    countMode: "turn_in",
    enteredCents: 9735,
    nextShiftBankCents: 15000,
    bankRemoved: true,
  });
  assert.equal(turn.ok, true);
  if (!turn.ok) return;
  assert.equal(turn.countedCents, 24735);
  assert.equal(turn.turnInCents, 9735);
  assert.equal(turn.bankLeftCents, 15000);
  assert.equal(turnInPlusBankEqualsCounted(turn.turnInCents, turn.bankLeftCents, turn.countedCents), true);

  const full = applyTurnIn({
    countMode: "full_drawer",
    enteredCents: 24735,
    nextShiftBankCents: 15000,
    bankRemoved: true,
  });
  assert.equal(full.ok, true);
  if (!full.ok) return;
  assert.equal(full.turnInCents + full.bankLeftCents, full.countedCents);
});

test("turn-in mode refuses submit until the bank-left checkbox is set", () => {
  const blocked = applyTurnIn({
    countMode: "turn_in",
    enteredCents: 9735,
    nextShiftBankCents: 15000,
    bankRemoved: false,
  });
  assert.equal(blocked.ok, false);
});

test("mid-shift drops are in expected and must not be counted again in the till", () => {
  const withDrop = expectedTillCashCents({
    openingBankCents: 20000,
    cashSalesCents: 10000,
    cashRefundsCents: 0,
    paidOutsCents: 0,
    paidInsCents: 0,
    dropsCents: 5000,
  });
  const withoutDrop = expectedTillCashCents({
    openingBankCents: 20000,
    cashSalesCents: 10000,
    cashRefundsCents: 0,
    paidOutsCents: 0,
    paidInsCents: 0,
    dropsCents: 0,
  });
  assert.equal(withDrop, withoutDrop - 5000);
});

test("cannot close twice — locked record rejects another count", () => {
  const submitted = rec({
    status: "auto_accepted",
    countedCents: 24200,
    overShortCents: 0,
    submittedAt: 2,
  });
  const again = applyCountAttempt(submitted, { countedTotalCents: 1 }, TILL);
  assert.equal(again.ok, false);
});

test("checks and money orders stay off the cash counted total", () => {
  const expected = rec().expected!.expectedCents;
  const applied = applyCountAttempt(rec(), {
    countedTotalCents: expected,
    checksCents: 5000,
    moneyOrdersCents: 2500,
  }, TILL);
  assert.equal(applied.ok && applied.kind === "matched", true);
  if (!applied.ok || applied.kind !== "matched") return;
  assert.equal(applied.rec.countedCents, expected);
  assert.equal(applied.rec.checksCents, 5000);
  assert.equal(applied.rec.moneyOrdersCents, 2500);
});

test("bag number required when configured", () => {
  const applied = applyCountAttempt(rec(), { countedTotalCents: 24200 }, { ...TILL, dropBagRequired: true });
  assert.equal(applied.ok, false);
});

test("cannot print a turn-in slip before submit", () => {
  const built = turnInSlipFromRecord(rec(), { storeName: "Harbor Grill" });
  assert.equal(built.ok, false);
  if (!built.ok) assert.match(built.error, /before submit/i);
  const result = toResult(rec());
  assert.equal("error" in result, true);
});

test("after a balanced submit the slip is the bag companion, not cash sales", () => {
  const expected = rec().expected!.expectedCents;
  const applied = applyCountAttempt(rec(), { countedTotalCents: expected, bagNumber: "B-18" }, TILL);
  assert.equal(applied.ok && applied.kind === "matched", true);
  if (!applied.ok || applied.kind !== "matched") return;
  const built = turnInSlipFromRecord(applied.rec, { storeName: "Harbor Grill" });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const text = formatTurnInSlip(built.slip);
  assert.match(text, /TILL TURN-IN/);
  assert.match(text, /TURN-IN CASH/);
  assert.match(text, /Over\/short/);
  assert.match(text, /BALANCED/);
  assert.match(text, /BAG \/ DROP #/);
  assert.match(text, /B-18/);
  assert.match(text, /Place this slip in the bag/);
  assert.equal(text.includes("Cash sales"), false);
  assert.equal(text.includes("COPY"), false);
  for (const ln of formatTurnInSlipLines(built.slip)) {
    assert.ok(ln.length <= TURN_IN_SLIP_WIDTH, `"${ln}" is ${ln.length}`);
  }
  assert.equal(dropBlockedForPrint(applied.rec), true);
});

test("reprint is identical and marked COPY", () => {
  const expected = rec().expected!.expectedCents;
  const applied = applyCountAttempt(
    rec({ witnessEmployeeId: "emp_m", witnessEmployeeName: "Sam" }),
    { countedTotalCents: expected },
    TILL,
  );
  assert.equal(applied.ok && applied.kind === "matched", true);
  if (!applied.ok || applied.kind !== "matched") return;
  if (!applied.ok) return;
  const orig = turnInSlipFromRecord(applied.rec, { storeName: "Harbor Grill" });
  const copy = turnInSlipFromRecord(applied.rec, { storeName: "Harbor Grill", copy: true });
  assert.equal(orig.ok && copy.ok, true);
  if (!orig.ok || !copy.ok) return;
  const origLines = formatTurnInSlipLines(orig.slip).filter((l) => l.trim() !== "COPY");
  const copyLines = formatTurnInSlipLines(copy.slip).filter((l) => l.trim() !== "COPY");
  assert.deepEqual(origLines, copyLines);
  assert.match(formatTurnInSlip(copy.slip), /COPY/);
  assert.match(formatTurnInSlip(copy.slip), /Witness/);
});

test("print job builder refuses a counting record and allows a submitted result", () => {
  const counting = toResult(rec());
  assert.equal("error" in counting, true);
  const applied = applyCountAttempt(rec(), { countedTotalCents: rec().expected!.expectedCents }, TILL);
  assert.equal(applied.ok && applied.kind === "matched", true);
  if (!applied.ok || applied.kind !== "matched") return;
  const result = toResult(applied.rec);
  assert.equal("error" in result, false);
  if ("error" in result) return;
  const job = turnInSlipFromRecord(applied.rec, { storeName: "Harbor Grill" });
  assert.equal(job.ok, true);
  if (!job.ok) return;
  assert.equal(job.slip.closeId, applied.rec.id);
  assert.equal(job.slip.copy, false);
});

