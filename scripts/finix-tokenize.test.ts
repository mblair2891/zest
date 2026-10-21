import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buyerIdentityBody,
  cardNotPresentCollection,
  cardNotPresentRejectsRawCard,
  finixJsEnvironment,
  instrumentChargeBody,
  parseFinixIdentityId,
  parseFinixInstrumentId,
  parseFinixTokenId,
  tokenInstrumentBody,
} from "../src/lib/payments/finix-tokenize.ts";

test("a token becomes a payment instrument body with no card fields", () => {
  const body = tokenInstrumentBody("TKabc12345", "IDabc12345");
  assert.deepEqual(body, { type: "TOKEN", token: "TKabc12345", identity: "IDabc12345" });
  assert.equal("number" in body, false);
  assert.equal("security_code" in body, false);
  assert.equal("expiration" in body, false);
  assert.equal(finixJsEnvironment("sandbox"), "sandbox");
  assert.equal(finixJsEnvironment("live"), "prod");
  assert.equal(cardNotPresentCollection(), "finix-payment-form");
});

test("online card pay rejects a raw card and keeps a token id", () => {
  assert.equal(cardNotPresentRejectsRawCard({ token: "TKabc12345" }), null);
  assert.equal(cardNotPresentRejectsRawCard({ cvv: "  " }), null);
  assert.match(String(cardNotPresentRejectsRawCard({ number: "4111111111111111" })), /Finix form/);
  assert.match(String(cardNotPresentRejectsRawCard({ cardNumber: "4111" })), /Finix form/);
  assert.match(String(cardNotPresentRejectsRawCard({ security_code: "123" })), /Finix form/);
  assert.match(String(cardNotPresentRejectsRawCard({ expiration: "12/28" })), /Finix form/);
  assert.equal(parseFinixTokenId("TKabc1"), "TKabc1");
  assert.equal(parseFinixTokenId("PIabc1"), null);
  assert.equal(parseFinixTokenId("not-a-token"), null);
  assert.equal(parseFinixInstrumentId("PIabcd"), "PIabcd");
  assert.equal(parseFinixInstrumentId("TKabcd"), null);
  assert.equal(parseFinixIdentityId("IDabcd"), "IDabcd");
});

test("a transfer source is the stored payment instrument", () => {
  const body = instrumentChargeBody({
    amountCents: 100,
    merchantId: "MUexample",
    instrumentId: "PIexample1",
    orderId: "order-1",
  });
  assert.equal(body.source, "PIexample1");
  assert.equal(body.merchant, "MUexample");
  assert.equal(body.amount, 100);
  assert.equal(body.currency, "USD");
  const buyer = buyerIdentityBody({});
  const entity = buyer.entity as { first_name: string; last_name: string };
  assert.equal(entity.first_name, "Guest");
  assert.equal(entity.last_name, "Online");
  assert.deepEqual(buyer.identity_roles, ["BUYER"]);
  assert.equal("number" in buyer, false);
});

test("the card form, the token exchange, and the guide stay on the hosted form", () => {
  const ui = readFileSync("src/components/payments/CardNotPresentReview.tsx", "utf8");
  const online = readFileSync("src/routes/online.tsx", "utf8");
  const server = readFileSync("src/lib/payments/card-not-present.server.ts", "utf8");
  const finix = readFileSync("src/lib/payments/finix.ts", "utf8");
  const tokenize = readFileSync("src/lib/payments/finix-tokenize.ts", "utf8");
  const guide = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  const migration = readFileSync("migrations/0065_card_not_present.sql", "utf8");
  const settings = readFileSync("src/components/pos/QuantumPaymentsSettings.tsx", "utf8");
  assert.match(tokenize, /https:\/\/js\.finix\.com\/v\/2\/finix\.js/);
  assert.match(ui, /FINIX_JS_SRC/);
  assert.match(ui, /script\.src = FINIX_JS_SRC/);
  assert.match(ui, /PaymentForm/);
  assert.match(ui, /paymentMethods: \["card"\]/);
  assert.match(ui, /data-payment-instrument/);
  assert.match(ui, /data-create-transfer/);
  assert.match(online, /CardNotPresentReview/);
  assert.match(online, /paymentInstrumentId/);
  assert.match(online, /guest/);
  assert.doesNotMatch(online, /cardNumber/);
  assert.match(settings, /CardNotPresentReview/);
  assert.match(server, /payment_instrument_id/);
  assert.doesNotMatch(server, /security_code/);
  const exchangeStart = finix.indexOf("export async function exchangeFinixCardToken");
  const chargeStart = finix.indexOf("export async function chargeFinixPaymentInstrument");
  const deviceStart = finix.indexOf("export async function createPaxD135Device");
  const exchange = finix.slice(exchangeStart, chargeStart);
  const charge = finix.slice(chargeStart, deviceStart);
  assert.match(exchange, /tokenInstrumentBody/);
  assert.match(exchange, /application: false/);
  assert.doesNotMatch(exchange, /security_code/);
  assert.doesNotMatch(exchange, /number:/);
  assert.match(charge, /instrumentChargeBody/);
  assert.match(charge, /\/transfers/);
  assert.match(charge, /\/authorizations/);
  assert.match(guide, /id: "card-not-present"/);
  assert.match(guide, /Settings → Payments/);
  assert.match(guide, /matches Guide v2026\.10\.328/);
  assert.match(migration, /payment_instrument_id/);
  assert.doesNotMatch(migration, /token_id/);
});

test("the platform tokenization test uses the hosted sandbox form and does not store the token", () => {
  const page = readFileSync("src/components/payments/OnlineTokenizationTest.tsx", "utf8");
  const server = readFileSync("src/lib/payments/tokenize-test.server.ts", "utf8");
  const api = readFileSync("src/lib/payments/api.ts", "utf8");
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  const online = readFileSync("src/routes/online.tsx", "utf8");
  const guide = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(page, /Sandbox tokenization form for Finix review\. Simulates online order card entry\./);
  assert.match(page, /Tokenization complete — Payment Instrument created\./);
  assert.match(page, /FinixCardForm/);
  assert.match(page, /environment="sandbox"/);
  assert.match(page, /data-card-token/);
  assert.match(page, /data-payment-instrument/);
  assert.match(page, /data-tokenize-test-only/);
  assert.doesNotMatch(page, /cardNumber/);
  assert.doesNotMatch(page, /security_code/);
  assert.match(server, /readFinixApiCreds\("sandbox"\)/);
  assert.match(server, /exchangeFinixCardToken/);
  assert.match(server, /mode: "sandbox"/);
  assert.match(server, /isPlatformAdmin/);
  assert.doesNotMatch(server, /insert into/);
  assert.doesNotMatch(server, /console\.(log|info|debug|error|warn)/);
  assert.match(api, /sandboxExchangeTokenFn/);
  assert.match(api, /Card number, expiration, and CVV stay in the Finix form/);
  assert.match(venue, /audience === "platform" \? <OnlineTokenizationTest \/> : null/);
  assert.doesNotMatch(online, /OnlineTokenizationTest/);
  assert.match(guide, /Online Tokenization Test/);
  assert.match(guide, /Sandbox tokenization form for Finix review\. Simulates online order card entry\./);
  assert.match(guide, /The token is not stored/);
});
