import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cardTenderAllowed,
  parseCardProcessor,
  stripeCapturePlan,
  stripePayoutPlan,
  stripeReaderAllowed,
  stripeTestPaymentIntentId,
} from "../src/lib/payments/adapter.ts";
import {
  DEFAULT_PAYMENT_METHODS,
  methodEnabled,
  payConfigForProcessor,
} from "../src/lib/pos/payment-methods.ts";

test("none hides card and leaves cash; stripe test reader completes the check", () => {
  assert.equal(parseCardProcessor("stripe"), "stripe");
  assert.equal(parseCardProcessor("none"), "none");
  assert.equal(parseCardProcessor(undefined), "finix");

  const methods = { ...DEFAULT_PAYMENT_METHODS, cash: true, card: true };
  const none = payConfigForProcessor(methods, "none");
  assert.equal(cardTenderAllowed("none", true), false);
  assert.equal(methodEnabled(none, "card"), false);
  assert.equal(methodEnabled(none, "cash"), true);

  const stripe = payConfigForProcessor(methods, "stripe");
  assert.equal(methodEnabled(stripe, "card"), true);
  assert.equal(methodEnabled(stripe, "cash"), true);

  const plan = stripeCapturePlan({
    locationLive: false,
    secret: undefined,
    readerId: "tmr_simulated",
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.test, true);
  assert.equal(plan.simulate, true);

  const blocked = stripeCapturePlan({
    locationLive: false,
    secret: "sk_live_secret",
    readerId: "tmr_1",
  });
  assert.equal(blocked.ok, false);

  const liveTestKey = stripeCapturePlan({
    locationLive: true,
    secret: "sk_test_secret",
    readerId: "tmr_1",
  });
  assert.equal(liveTestKey.ok, false);

  const pi = stripeTestPaymentIntentId("chk-1", 1800);
  assert.match(pi, /^pi_test_/);

  let balance = 1800;
  let status: "open" | "paid" = "open";
  let stored: { processor?: string; processorPaymentId?: string } | null = null;
  const pay = (method: "cash" | "card", processor: "finix" | "stripe" | "none") => {
    const cfg = payConfigForProcessor(methods, processor);
    if (!methodEnabled(cfg, method)) return { ok: false as const };
    stored =
      method === "card"
        ? { processor: "stripe", processorPaymentId: pi }
        : { processor: undefined };
    balance = 0;
    status = "paid";
    return { ok: true as const };
  };
  assert.equal(pay("card", "none").ok, false);
  assert.equal(status, "open");
  assert.equal(balance, 1800);
  assert.equal(pay("card", "stripe").ok, true);
  assert.equal(status, "paid");
  assert.equal(balance, 0);
  assert.equal(stored?.processor, "stripe");
  assert.equal(stored?.processorPaymentId, pi);

  balance = 900;
  status = "open";
  assert.equal(pay("cash", "none").ok, true);
  assert.equal(status, "paid");

  const report = stripePayoutPlan([
    { entityId: "food", displayName: "Food", amountCents: 1200 },
    { entityId: "bar", displayName: "Bar", amountCents: 600 },
  ]);
  assert.equal(report.mode, "settlement_report");
  const connected = stripePayoutPlan([
    { entityId: "food", displayName: "Food", amountCents: 1200, stripeAccountId: "acct_food" },
    { entityId: "bar", displayName: "Bar", amountCents: 600, stripeAccountId: "acct_bar" },
  ]);
  assert.equal(connected.mode, "connected");
  assert.equal(connected.transfers[0]?.amountCents, 1200);
  assert.equal(stripeReaderAllowed("BBPOS WisePOS E", "reader"), true);
  assert.equal(stripeReaderAllowed("Pixel 8", "tap_to_pay"), true);
  assert.equal(stripeReaderAllowed("generic tablet", "tap_to_pay"), false);

  const facade = readFileSync("src/lib/payments/facade.server.ts", "utf8");
  assert.match(facade, /processor === "none"/);
  assert.match(facade, /processor === "stripe"/);
  assert.match(facade, /journalOnly: true/);
  assert.match(facade, /captureLiveCardPresent/);
  const hook = readFileSync("src/routes/api/payments/stripe/webhook.ts", "utf8");
  assert.match(hook, /\/api\/payments\/stripe\/webhook/);
  assert.match(hook, /applyStripeWebhookEvent/);
});
