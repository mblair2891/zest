import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  giftSellBlockedReason,
  parseGiftLimits,
  DEFAULT_GIFT_LIMITS,
} from "../src/lib/pos/gift-limits.ts";
import { MCC_5813_COPY, parseEntityKyc } from "../src/lib/payments/entity-kyc.ts";

test("gift sell is blocked above the $500 default cap", () => {
  const limits = parseGiftLimits(undefined);
  assert.equal(limits.maxSellPerTxnCents, DEFAULT_GIFT_LIMITS.maxSellPerTxnCents);
  assert.equal(limits.maxLoadCents, 50_000);
  assert.equal(limits.maxBalanceCents, 50_000);
  assert.equal(limits.cashOutRemainder, false);
  const over = giftSellBlockedReason(50_001, 0, limits);
  assert.ok(over);
  assert.match(over, /Max sell per transaction/);
  assert.equal(giftSellBlockedReason(50_000, 0, limits), null);
  assert.match(
    giftSellBlockedReason(100, 49_950, limits) ?? "",
    /Max balance per card/,
  );
});

test("KYC parse keeps MCC 5813 and Finix statuses", () => {
  const kyc = parseEntityKyc({
    legalName: "Copper Bar LLC",
    dba: "Copper Bar",
    ein: "98-7654321",
    owners: "B. Ortiz",
    address: "100 Summit Ave",
    city: "Portland",
    state: "or",
    postal: "97201",
    mcc: "5813",
    bankName: "First National",
    bankLast4: "7788",
    routingLast4: "0210",
    status: "submitted",
  });
  assert.equal(kyc.mcc, "5813");
  assert.equal(kyc.state, "OR");
  assert.equal(kyc.status, "submitted");
  assert.match(
    MCC_5813_COPY,
    /On-premise retail only\. Summex does not support online or shipped alcohol sales\./,
  );
});

test("Payments / KYC form is fields, not JSON, with 5813 helper", () => {
  const panel = readFileSync("src/components/payments/QuantumPaymentsOnboardPanel.tsx", "utf8");
  assert.match(panel, /Legal name/);
  assert.match(panel, /DBA/);
  assert.match(panel, /EIN/);
  assert.match(panel, /Owners/);
  assert.match(panel, /Bank \/ payout account/);
  assert.match(panel, /Finix sub-merchant application status/);
  assert.match(panel, /MCC_5813_COPY/);
  assert.match(panel, /data-demo="mcc-5813"/);
  assert.doesNotMatch(panel, /JSON\.stringify\(kyc/);
  const peer = readFileSync("src/components/pos/QuantumPaymentsSettings.tsx", "utf8");
  assert.match(peer, /The building has no Finix merchant and no venue payout/);
  assert.match(peer, /Open application/);
  assert.match(peer, /vendors\.filter/);
});

test("station gift sell/redeem has no online purchase copy", () => {
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /data-demo="gift-sell"/);
  assert.match(pay, /Sell gift card/);
  assert.match(pay, /Check balance/);
  assert.match(pay, /No public website purchase/);
  assert.doesNotMatch(pay, /buy gift cards online/i);
  const guests = readFileSync("src/components/pos/CustomersView.tsx", "utf8");
  assert.match(guests, /data-demo="gift-admin"/);
  assert.match(guests, /Freeze/);
  assert.match(guests, /Void/);
  assert.match(guests, /data-demo="gift-limits"/);
  assert.doesNotMatch(guests, /buy gift cards online/i);
});

test("guest check itemizes vendor totals then grand total", () => {
  const check = readFileSync("src/components/pos/GuestCheckByVendor.tsx", "utf8");
  assert.match(check, /displayName\} total/);
  assert.match(check, />Total</);
  const qr = readFileSync("src/components/pos/GuestTablePage.tsx", "utf8");
  assert.match(qr, /You are at this location/);
  const house = readFileSync("src/components/platform/VenueHouseSettings.tsx", "utf8");
  assert.match(house, /On-premise only \(table tent \/ check QR\)/);
});

test("Summit Hall seeds Copper 5813 KYC and gift $500 caps", () => {
  const seed = readFileSync("src/lib/saas/summit-hall-seed.server.ts", "utf8");
  assert.match(seed, /mcc: "5813"/);
  assert.match(seed, /giftMaxSellPerTxnCents: 50000/);
  const devices = readFileSync("src/lib/pos/location-devices.ts", "utf8");
  assert.match(devices, /kitchen_printer: "Order printer"/);
});
