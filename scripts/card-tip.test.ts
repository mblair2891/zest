import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CARD_TIP_PERCENTS,
  appendTipKey,
  cardChargeCents,
  centsFromMoneyDigits,
  percentFromDigits,
  tipCentsForChoice,
  tipCentsForPercent,
  tipFromKeypad,
} from "../src/lib/pos/card-tip.ts";
import {
  TIP_CAPTURE_FAILED,
  TIP_PROCESSOR_DECLINED,
  cardCloseSimulatesTip,
  visibleTipFailure,
} from "../src/lib/payments/tip-capture.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("card percents are 18, 20, and 25", () => {
  assert.deepEqual(CARD_TIP_PERCENTS, [18, 20, 25]);
  assert.equal(tipCentsForPercent(1000, 18), 180);
  assert.equal(tipCentsForPercent(1000, 20), 200);
  assert.equal(tipCentsForPercent(1000, 25), 250);
  assert.equal(tipCentsForPercent(333, 20), 67);
  assert.equal(tipCentsForPercent(0, 20), 0);
});

test("a percent adds the tip before the card total", () => {
  const base = 2450;
  const tip = tipCentsForChoice({ kind: "percent", percent: 20 }, base);
  assert.equal(tip, 490);
  assert.equal(cardChargeCents(base, tip), 2940);
});

test("custom amount and custom percent update the total", () => {
  assert.equal(centsFromMoneyDigits("500"), 500);
  assert.equal(centsFromMoneyDigits("000500"), 500);
  const amountTip = tipFromKeypad("500", "amount", 2000);
  assert.equal(amountTip, 500);
  assert.equal(
    cardChargeCents(2000, tipCentsForChoice({ kind: "custom-amount", cents: 500 }, 2000)),
    2500,
  );
  assert.equal(percentFromDigits("15"), 15);
  assert.equal(percentFromDigits("18.5"), 18.5);
  assert.equal(tipFromKeypad("15", "percent", 2000), 300);
  assert.equal(tipFromKeypad("18.5", "percent", 1000), 185);
  assert.equal(percentFromDigits("101"), null);
  assert.equal(tipFromKeypad("", "amount", 2000), null);
});

test("no tip is zero and the total is the check", () => {
  assert.equal(tipCentsForChoice({ kind: "none" }, 1800), 0);
  assert.equal(cardChargeCents(1800, 0), 1800);
  assert.equal(tipFromKeypad("0", "amount", 1800), 0);
});

test("keypad accepts dollars or a percent and refuses a percent over 100", () => {
  let amount = "";
  for (const key of ["1", "0", "0"]) amount = appendTipKey(amount, key, "amount");
  assert.equal(amount, "100");
  assert.equal(centsFromMoneyDigits(amount), 100);
  amount = appendTipKey(amount, "back", "amount");
  assert.equal(amount, "10");
  assert.equal(appendTipKey("12", "clear", "amount"), "");

  let pct = "";
  for (const key of ["2", "0"]) pct = appendTipKey(pct, key, "percent");
  assert.equal(pct, "20");
  pct = appendTipKey(appendTipKey("", "1", "percent"), "8", "percent");
  pct = appendTipKey(pct, ".", "percent");
  pct = appendTipKey(pct, "5", "percent");
  assert.equal(pct, "18.5");
  assert.equal(appendTipKey("100", "1", "percent"), "100");
  assert.equal(appendTipKey("18.5", "5", "percent"), "18.5");
});

test("training and a zero tip close, and the stuck sentence is not shown", () => {
  assert.equal(cardCloseSimulatesTip({ lifecycleStatus: "training" }), true);
  assert.equal(cardCloseSimulatesTip({ lifecycleStatus: "onboarding" }), true);
  assert.equal(cardCloseSimulatesTip({ lifecycleStatus: "scheduled_live" }), true);
  assert.equal(cardCloseSimulatesTip({ lifecycleStatus: "awaiting_entities" }), true);
  assert.equal(cardCloseSimulatesTip({ paymentsMode: "sandbox" }), true);
  assert.equal(cardCloseSimulatesTip({ lifecycleForcesSandbox: true }), true);
  assert.equal(cardCloseSimulatesTip({ captureSandbox: true }), true);
  assert.equal(cardCloseSimulatesTip({ serverSandbox: true }), true);
  assert.equal(cardCloseSimulatesTip({ lifecycleStatus: "live" }), false);
  assert.equal(cardCloseSimulatesTip({}), false);
  assert.equal(cardCloseSimulatesTip({ lifecycleStatus: null, paymentsMode: null }), false);
  assert.equal(visibleTipFailure(TIP_CAPTURE_FAILED), TIP_PROCESSOR_DECLINED);
  assert.equal(visibleTipFailure(""), TIP_PROCESSOR_DECLINED);
  assert.equal(visibleTipFailure("capture_amount exceeds the authorization"), "capture_amount exceeds the authorization");
});

test("card payment screen source shows the four buttons and no tip", () => {
  const row = read("src/components/pos/CardTipRow.tsx");
  const pay = read("src/components/pos/PaymentDialog.tsx");
  assert.match(row, /flex flex-nowrap/);
  assert.match(row, /min-h-14/);
  assert.match(row, /data-card-tip-row/);
  assert.match(row, /data-card-tip-custom/);
  assert.match(row, /data-card-tip-keypad/);
  assert.match(row, /data-card-tip-none/);
  assert.match(row, /\{percent\}%/);
  assert.match(row, />\s*Custom\s*</);
  assert.match(row, />\s*No tip\s*</);
  assert.match(row, />\s*Amount\s*</);
  assert.match(row, />\s*Percent\s*</);
  assert.doesNotMatch(row, /15%/);
  assert.match(pay, /<CardTipRow/);
  assert.match(pay, /method === "card" \? \([\s\S]*<CardTipRow/);
  assert.match(pay, /data-card-charge-total/);
  assert.match(pay, /data-pay-cancel/);
  assert.match(pay, /data-pay-back/);
  assert.match(pay, /data-pay-try-another/);
  assert.match(pay, /data-close-no-tip/);
  assert.match(pay, /data-tip-retry/);
  assert.match(row, /aria-expanded/);
  assert.match(row, /scrollIntoView/);
  assert.match(pay, /simulateClose/);
  assert.match(pay, /payTip <= 0/);
  assert.match(pay, /logTipAdjust/);
  assert.match(pay, /cardCloseSimulatesTip/);
  assert.match(pay, /visibleTipFailure/);
  assert.match(pay, /station-pay-overlay/);
  assert.match(pay, /data-pay-tip-panel/);
  assert.doesNotMatch(pay, /The tip could not be captured\. The check stays open\./);
  const css = read("src/styles.css");
  assert.match(css, /station-pay-overlay/);
  assert.match(css, /--pay-nav-clear/);
  assert.doesNotMatch(css, /\[data-station-pay\][\s\S]{0,400}max-height:\s*var\(--station-vh/);
});

test("payments and tipping guides describe the card tip buttons", () => {
  const payments = read("src/lib/guide/content/payments.ts");
  const tipping = read("src/lib/guide/content/cash-gifts.ts");
  const types = read("src/lib/guide/types.ts");
  assert.match(payments, /18%, 20%, 25%, and Custom/);
  assert.match(payments, /Sandbox keys send the charge to the Finix sandbox/);
  assert.match(payments, /matches Guide v2026\.10\.315/);
  assert.match(payments, /Insufficient funds, Invalid card number, Card declined, Canceled, Address mismatch, or Invalid CVV/);
  assert.match(payments, /does not reuse the original sale key/);
  assert.match(payments, /own idempotency id/);
  assert.match(payments, /A card reader connects by Bluetooth, Network, or USB/);
  assert.match(payments, /No tip closes the check with a \$0 tip/);
  assert.match(payments, /close with no tip, retry, or cancel/);
  assert.match(tipping, /18%, 20%, 25%, and Custom/);
  assert.match(tipping, /No tip closes the check at \$0/);
  assert.match(types, /GUIDE_VERSION = "2026\.10\.315"/);
  assert.match(types, /Full-screen check/);
  assert.match(types, /Card sale idempotency/);
  assert.match(payments, /The station PIN pad and the floor, order, pay, and kitchen screens fit the display/);
});
