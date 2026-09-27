import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cardPresentDispatch } from "../src/lib/payments/adapter.ts";
import {
  SQUARE_PING_CENTS,
  checkoutOutcome,
  defaultCardPresentRail,
  deviceCodeBody,
  parseSquareWebhook,
  squareChargePlan,
  squareWebhookSignature,
  terminalCheckoutBody,
  verifySquareWebhook,
} from "../src/lib/payments/square-terminal.ts";

test("the rail defaults from which keys exist", () => {
  assert.equal(defaultCardPresentRail({ finix: true, square: true }), "finix");
  assert.equal(defaultCardPresentRail({ finix: true, square: false }), "finix");
  assert.equal(defaultCardPresentRail({ finix: false, square: true }), "square");
  assert.equal(defaultCardPresentRail({ finix: false, square: false }), "none");
  assert.equal(cardPresentDispatch("square"), "square");
  assert.equal(cardPresentDispatch("finix"), "finix");
  assert.equal(cardPresentDispatch("none"), "none");
});

test("a Square checkout has no split and training does not use production", () => {
  const body = terminalCheckoutBody({
    amountCents: 1860,
    deviceId: "device-1",
    referenceId: "check-18",
    note: "Check 18 · table 4",
    idempotencyKey: "idem123",
  });
  assert.equal(JSON.stringify(body).includes("split_transfer"), false);
  const checkout = body.checkout as { amount_money: { amount: number }; reference_id: string; note: string };
  assert.equal(checkout.amount_money.amount, 1860);
  assert.equal(checkout.reference_id, "check-18");
  assert.match(checkout.note, /table 4/);
  const code = deviceCodeBody({ idempotencyKey: "code1", locationId: "loc-1" });
  assert.equal((code.device_code as { product_type: string }).product_type, "TERMINAL_API");
  assert.equal(SQUARE_PING_CENTS, 100);

  assert.equal(
    squareChargePlan({
      locationLive: false,
      squareLiveCards: false,
      environment: "production",
      hasToken: true,
      deviceId: "device-1",
    }).ok &&
      (squareChargePlan({
        locationLive: false,
        squareLiveCards: false,
        environment: "production",
        hasToken: true,
        deviceId: "device-1",
      }) as { simulate: boolean }).simulate,
    true,
  );
  const liveOff = squareChargePlan({
    locationLive: true,
    squareLiveCards: false,
    environment: "production",
    hasToken: true,
    deviceId: "device-1",
  });
  assert.equal(liveOff.ok, false);
  const liveOn = squareChargePlan({
    locationLive: true,
    squareLiveCards: true,
    environment: "production",
    hasToken: true,
    deviceId: "device-1",
  });
  assert.equal(liveOn.ok, true);
  if (liveOn.ok) assert.equal(liveOn.simulate, false);
  const trainingNoDevice = squareChargePlan({
    locationLive: false,
    squareLiveCards: false,
    environment: "sandbox",
    hasToken: true,
    deviceId: "",
  });
  assert.equal(trainingNoDevice.ok, true);
  if (trainingNoDevice.ok) assert.equal(trainingNoDevice.simulate, true);
});

test("the webhook verifies a signature and ignores unknown events", () => {
  const url = "https://app.example.com/api/webhooks/square";
  const raw = JSON.stringify({
    type: "terminal.checkout.updated",
    event_id: "evt-1",
    data: {
      id: "checkout-1",
      object: {
        checkout: {
          id: "checkout-1",
          status: "COMPLETED",
          reference_id: "check-18",
          payment_ids: ["pay-9"],
        },
      },
    },
  });
  const header = squareWebhookSignature("sig-key", url, raw);
  assert.equal(verifySquareWebhook({ signatureKey: "sig-key", notificationUrl: url, rawBody: raw, header }), true);
  assert.equal(verifySquareWebhook({ signatureKey: "sig-key", notificationUrl: url, rawBody: raw, header: "nope" }), false);
  const parsed = parseSquareWebhook(JSON.parse(raw));
  assert.equal(parsed.kind, "checkout");
  if (parsed.kind === "checkout") {
    assert.equal(parsed.paymentId, "pay-9");
    assert.equal(checkoutOutcome(parsed.status), "completed");
  }
  assert.equal(parseSquareWebhook({ type: "payment.created", event_id: "evt-2" }).kind, "ignore");
  assert.equal(checkoutOutcome("CANCELED"), "canceled");
  assert.equal(checkoutOutcome("FAILED"), "failed");
});

test("Square pay does not call Finix, and QR does not charge a card", () => {
  const facade = readFileSync("src/lib/payments/facade.server.ts", "utf8");
  const squareAt = facade.indexOf('if (dispatch === "square")');
  const finixAt = facade.lastIndexOf("captureLiveCardPresent(");
  assert.ok(squareAt > 0 && finixAt > squareAt);
  const squareServer = readFileSync("src/lib/payments/square-terminal.server.ts", "utf8");
  assert.doesNotMatch(squareServer, /captureLiveCardPresent|finix/i);
  const dialog = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(dialog, /startSquareCheckoutFn/);
  assert.match(dialog, /squarePaymentId/);
  assert.doesNotMatch(dialog, /window\.print/);
  const guest = readFileSync("src/components/pos/GuestTablePage.tsx", "utf8");
  assert.match(guest, /Pay the server, or use cash or gift/);
  assert.match(guest, /data-qr-card="server"/);
  const guide = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(guide, /Square Terminal \(temporary single merchant\)/);
  const hook = readFileSync("src/routes/api/webhooks/square.ts", "utf8");
  assert.match(hook, /x-square-hmacsha256-signature/);
  assert.match(hook, /\/api\/webhooks\/square/);
});
