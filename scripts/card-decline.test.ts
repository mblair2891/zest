import assert from "node:assert/strict";
import test from "node:test";
import {
  DECLINE_AVS,
  DECLINE_CANCELED,
  DECLINE_CVV,
  DECLINE_GENERIC,
  DECLINE_INSUFFICIENT,
  DECLINE_INVALID_NUMBER,
  displayCardDecline,
  staffCardDecline,
} from "../src/lib/payments/card-decline.ts";

const SALE = "failure_message The transaction was declined. code 102 state FAILED trace SALE_9f3";

test("processor text maps to the short staff line", () => {
  assert.equal(displayCardDecline({ message: "Insufficient funds" }), DECLINE_INSUFFICIENT);
  assert.equal(displayCardDecline({ message: "Host response 51 Insufficient funds" }), DECLINE_INSUFFICIENT);
  assert.equal(displayCardDecline({ message: "Invalid card number" }), DECLINE_INVALID_NUMBER);
  assert.equal(displayCardDecline({ message: "DECLINED" }), DECLINE_GENERIC);
  assert.equal(displayCardDecline({ message: "Do not honor" }), DECLINE_GENERIC);
  assert.equal(displayCardDecline({ message: "Transaction cancelled" }), DECLINE_CANCELED);
  assert.equal(displayCardDecline({ message: "AVS failure" }), DECLINE_AVS);
  assert.equal(displayCardDecline({ message: "Address mismatch" }), DECLINE_AVS);
  assert.equal(displayCardDecline({ message: "CVC failure" }), DECLINE_CVV);
  assert.equal(displayCardDecline({ message: "Invalid CVV" }), DECLINE_CVV);
  assert.equal(displayCardDecline({ message: "security code does not match" }), DECLINE_CVV);
  assert.equal(displayCardDecline({ message: "Expired card" }), DECLINE_GENERIC);
  assert.equal(displayCardDecline({ message: "Something the reader did not name" }), null);
});

test("a long processor blob does not show the sale id", () => {
  const shown = staffCardDecline(SALE);
  assert.equal(shown, DECLINE_GENERIC);
  assert.equal(shown.includes("SALE"), false);
  assert.equal(shown.includes("trace"), false);
  assert.equal(shown.includes("failure_message"), false);
});

test("training amounts use the short line even when the blob is generic", () => {
  const cases: Array<[number, string]> = [
    [102, DECLINE_GENERIC],
    [103, DECLINE_CANCELED],
    [193, DECLINE_INSUFFICIENT],
    [194, DECLINE_INVALID_NUMBER],
    [889986, DECLINE_AVS],
    [889987, DECLINE_CVV],
  ];
  for (const [cents, line] of cases) {
    assert.equal(displayCardDecline({ message: SALE, amountCents: cents, training: true }), line);
    assert.equal(displayCardDecline({ message: "", amountCents: cents, training: true }), line);
  }
});

test("a live charge follows the processor text, not the cent amount", () => {
  assert.equal(
    displayCardDecline({ message: "AVS failure", amountCents: 193, training: false }),
    DECLINE_AVS,
  );
  assert.equal(
    displayCardDecline({ message: "Insufficient funds", amountCents: 102, training: false }),
    DECLINE_INSUFFICIENT,
  );
});

test("operational errors stay off the decline list", () => {
  const lines = [
    "The card read timed out. The check is not paid. Try again.",
    "The chip could not be read. The check stays open.",
    "The reader disconnected. The check is not paid. Try again.",
    "Card requires connection. Take cash or keep the check open.",
    "Card reader not connected",
    "The authorization could not be voided. The check stays open.",
    "The processor did not add the tip.",
    "This reader is registered to another selling entity.",
  ];
  for (const line of lines) {
    assert.equal(displayCardDecline({ message: line, amountCents: 193, training: true }), null);
    assert.equal(staffCardDecline(line, { amountCents: 193, training: true }), line);
  }
});
