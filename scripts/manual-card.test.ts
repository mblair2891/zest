import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  finixFailureText,
  manualBuyerBody,
  manualCardEntryVisible,
  manualInstrumentBody,
  manualTransferApproved,
  manualTransferBody,
  parseManualCard,
  redactCardText,
} from "../src/lib/payments/manual-card.ts";

const CARD = "5200828282828210";

test("manual entry shows in training and sandbox and hides when the location is live", () => {
  assert.equal(manualCardEntryVisible({ lifecycleStatus: "training" }), true);
  assert.equal(
    manualCardEntryVisible({ lifecycleStatus: "onboarding", paymentsMode: "sandbox" }),
    true,
  );
  assert.equal(
    manualCardEntryVisible({ lifecycleStatus: "scheduled_live", lifecycleForcesSandbox: true }),
    true,
  );
  assert.equal(
    manualCardEntryVisible({ lifecycleStatus: "live", paymentsMode: "sandbox" }),
    false,
  );
  assert.equal(manualCardEntryVisible({ lifecycleStatus: "live", paymentsMode: "live" }), false);
  assert.equal(manualCardEntryVisible({ paymentsMode: "live" }), false);
});

test("a typed card becomes a sandbox sale and a failed transfer does not close the check", () => {
  const parsed = parseManualCard({
    number: CARD,
    expiration: "12/29",
    securityCode: "022",
    postalCode: "94404",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.card.expirationMonth, 12);
  assert.equal(parsed.card.expirationYear, 2029);
  assert.equal(parseManualCard({ number: "4242", expiration: "12/29", securityCode: "022", postalCode: "94404" }).ok, false);
  assert.equal(parseManualCard({ number: CARD, expiration: "13/29", securityCode: "022", postalCode: "94404" }).ok, false);
  assert.equal(parseManualCard({ number: CARD, expiration: "12/29", securityCode: "2", postalCode: "94404" }).ok, false);
  assert.equal(parseManualCard({ number: CARD, expiration: "12/29", securityCode: "022", postalCode: "94" }).ok, false);

  const buyer = manualBuyerBody("94404", "chk_1");
  assert.equal((buyer.identity_roles as string[])[0], "BUYER");
  assert.equal(JSON.stringify(buyer).includes(CARD), false);

  const instrument = manualInstrumentBody(parsed.card, "IDbuyer");
  assert.equal(instrument.type, "PAYMENT_CARD");
  assert.equal(instrument.identity, "IDbuyer");
  assert.equal(instrument.number, CARD);

  const transfer = manualTransferBody({
    amountCents: 1250,
    merchantId: "MUmerchant",
    sourceId: "PIcard",
    checkId: "chk_1",
    splits: [{ merchantId: "MUother", amountCents: 400 }],
  });
  assert.equal(transfer.merchant, "MUmerchant");
  assert.equal(transfer.source, "PIcard");
  assert.equal(transfer.amount, 1250);
  assert.deepEqual(transfer.split_transfers, [{ merchant: "MUother", amount: 400 }]);

  assert.equal(manualTransferApproved({ id: "TRok", state: "SUCCEEDED" }), true);
  assert.equal(manualTransferApproved({ id: "TRpend", state: "PENDING" }), true);
  assert.equal(manualTransferApproved({ id: "TRno", state: "FAILED" }), false);
  assert.equal(manualTransferApproved({ state: "SUCCEEDED" }), false);
  assert.match(finixFailureText({ failure_message: "Insufficient funds" }), /Insufficient funds/);
  assert.equal(redactCardText(`declined ${CARD} cvv 022`, [CARD, "022"]).includes(CARD), false);
  assert.equal(redactCardText(`declined ${CARD} cvv 022`, [CARD, "022"]).includes("022"), false);

  const dialog = readFileSync(new URL("../src/components/pos/PaymentDialog.tsx", import.meta.url), "utf8");
  assert.match(dialog, /data-manual-entry/);
  assert.match(dialog, /data-manual-number/);
  assert.match(dialog, /data-manual-submit/);
  assert.match(dialog, /chargeManualCardFn/);
  assert.match(dialog, /finixTransferId = charged\.transferId/);

  const server = readFileSync(new URL("../src/lib/payments/manual-card.server.ts", import.meta.url), "utf8");
  assert.match(server, /Manual entry is off when the location is live/);
  assert.match(server, /chargeManualCardOnFinix/);
  assert.match(server, /parentMerchantForCapture/);
});
