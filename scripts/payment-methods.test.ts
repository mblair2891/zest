import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_PAYMENT_METHODS,
  enabledPayMethods,
  ensureGuestTender,
  firstEnabledMethod,
  methodEnabled,
  parsePaymentMethods,
  togglePaymentMethod,
} from "../src/lib/pos/payment-methods.ts";

test("quote/onboarding default: cash + card + gift on; check off", () => {
  assert.equal(DEFAULT_PAYMENT_METHODS.cash, true);
  assert.equal(DEFAULT_PAYMENT_METHODS.card, true);
  assert.equal(DEFAULT_PAYMENT_METHODS.giftCard, true);
  assert.equal(DEFAULT_PAYMENT_METHODS.check, false);
  assert.equal(DEFAULT_PAYMENT_METHODS.houseAccount, false);
  assert.equal(DEFAULT_PAYMENT_METHODS.comp, true);
  assert.equal(DEFAULT_PAYMENT_METHODS.other, false);
});

test("cannot turn off the last guest tender", () => {
  const onlyCard = { ...DEFAULT_PAYMENT_METHODS, cash: false, giftCard: false, card: true };
  const res = togglePaymentMethod(onlyCard, "card", false);
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /at least one guest tender/i);
  const keep = togglePaymentMethod(onlyCard, "cash", true);
  assert.equal(keep.ok, true);
});

test("parse forces a guest tender if all three are off", () => {
  const cfg = parsePaymentMethods({ cash: false, card: false, giftCard: false });
  assert.equal(cfg.card, true);
  const forced = ensureGuestTender({
    ...DEFAULT_PAYMENT_METHODS,
    cash: false,
    card: false,
    giftCard: false,
  });
  assert.equal(forced.card, true);
});

test("methodEnabled and enabledPayMethods hide disabled tenders", () => {
  const cfg = parsePaymentMethods({
    cash: true,
    card: false,
    giftCard: true,
    check: false,
    houseAccount: false,
    comp: false,
    other: false,
  });
  assert.equal(methodEnabled(cfg, "cash"), true);
  assert.equal(methodEnabled(cfg, "card"), false);
  assert.equal(methodEnabled(cfg, "gift_card"), true);
  assert.equal(methodEnabled(cfg, "check"), false);
  assert.deepEqual(enabledPayMethods(cfg), ["cash", "gift_card"]);
  assert.equal(firstEnabledMethod(cfg, "card"), "cash");
  assert.equal(firstEnabledMethod(cfg, "gift_card"), "gift_card");
});

test("settings are checkboxes, not JSON; pay and closeout hide disabled", () => {
  const settings = readFileSync("src/components/pos/PaymentMethodsSettings.tsx", "utf8");
  assert.match(settings, /Toggles, not JSON/);
  assert.match(settings, /type="checkbox"/);
  assert.doesNotMatch(settings, /JSON\.stringify/);
  assert.doesNotMatch(settings, /<textarea/);
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /enabledPayMethods/);
  assert.match(pay, /station-touch min-h-12 w-full/);
  assert.match(pay, /This tender is off at this venue/);
  const close = readFileSync("src/components/pos/CloseoutView.tsx", "utf8");
  assert.match(close, /payCfg.card \? \["Card"/);
  assert.match(close, /payCfg.check \? \["Check"/);
  const menu = readFileSync("src/lib/pos/station-menu.ts", "utf8");
  assert.match(menu, /cashEnabled !== false/);
  const onboard = readFileSync("src/lib/saas/onboarding.server.ts", "utf8");
  assert.match(onboard, /DEFAULT_PAYMENT_METHODS/);
  const kiosk = readFileSync("src/components/kiosk/KioskApp.tsx", "utf8");
  assert.match(kiosk, /kioskTenders/);
  const qr = readFileSync("src/components/pos/GuestTablePage.tsx", "utf8");
  assert.match(qr, /venuePay.giftCard/);
  const guide = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(guide, /id: "venue-payment-methods"/);
  assert.match(guide, /Checkboxes, not a JSON blob/);
});
