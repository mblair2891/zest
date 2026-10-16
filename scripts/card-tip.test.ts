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
});

test("payments and tipping guides describe the card tip buttons", () => {
  const payments = read("src/lib/guide/content/payments.ts");
  const tipping = read("src/lib/guide/content/cash-gifts.ts");
  const types = read("src/lib/guide/types.ts");
  assert.match(payments, /18%, 20%, 25%, and Custom/);
  assert.match(payments, /Sandbox keys send the charge to the Finix sandbox/);
  assert.match(payments, /matches Guide v2026\.10\.272/);
  assert.match(tipping, /18%, 20%, 25%, and Custom/);
  assert.match(types, /GUIDE_VERSION = "2026\.10\.272"/);
  assert.match(types, /Card closeout/);
});
