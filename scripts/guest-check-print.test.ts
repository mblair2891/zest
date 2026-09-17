import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("order pad always shows live check lines; Print check is not the only view", () => {
  const ui = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  assert.match(ui, /data-live-check/);
  assert.match(ui, /data-live-check-strip/);
  assert.match(ui, /Print check/);
  assert.match(ui, /printGuestCheck/);
  assert.match(ui, /Tap the menu — lines land here/);
  assert.match(ui, /hasBoundReceipt/);
  assert.match(ui, /ADD_RECEIPT_PRINTER/);
});

test("pay screen prints guest check before tender", () => {
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /Print check/);
  assert.match(pay, /printGuestCheck/);
  const from = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(from, /kind: "guest_check"/);
  assert.match(from, /Not a receipt — pay server/);
  assert.match(from, /cashTotalCents/);
  assert.match(from, /resolveReceiptPrinter/);
  assert.doesNotMatch(from, /window\.print\(/);
  const esc = readFileSync("src/lib/print/escpos.ts", "utf8");
  assert.match(esc, /buildGuestCheckEscPos/);
  assert.match(esc, /GUEST CHECK/);
  assert.match(esc, /Not a receipt/);
});

test("dashboard test print reports Printed via station", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /Printed via \$\{/);
});

test("guide covers live pad, print check, impact, receipt path", () => {
  const orders = readFileSync("src/lib/guide/content/orders.ts", "utf8");
  assert.match(orders, /beside or under the menu/);
  assert.match(orders, /destination Kitchen/);
  const pay = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(pay, /Print check \(before tender\)/);
  const devices = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(devices, /text-only 9-pin impact/);
  assert.match(devices, /Printed via \{station\}/);
  assert.match(devices, /every order and host station/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.112/);
});
