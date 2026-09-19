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

test("cash ON is a pay tender even without a receipt printer", () => {
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /enabledPayMethods\(payCfg\)/);
  assert.doesNotMatch(pay, /m === "cash" \? cashAllowed/);
  assert.match(pay, /ADD_RECEIPT_PRINTER/);
  assert.match(pay, /mayPrintReceipt/);
  assert.match(pay, /TRAINING — Quantum Payments sandbox/);
  assert.match(pay, /Cash and gift still work/);
  const pad = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  assert.match(pad, /mayPrintCheck = hasBoundReceipt/);
  assert.doesNotMatch(pad, /mayKick && mayPrintReceipt/);
  const copy = readFileSync("src/lib/print/receipt-printer.ts", "utf8");
  assert.match(copy, /Add a receipt printer in Devices/);
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.doesNotMatch(store, /stationMayKickDrawer\(get\(\)\.locationDevices/);
});

test("table sheet Print check is on each row and never kitchen queue", () => {
  const floor = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(floor, /data-print-check/);
  assert.match(floor, /Print check/);
  assert.match(floor, /data-print-all-open/);
  assert.match(floor, /Sending to \$\{/);
  assert.match(floor, /NO_SECTION_RECEIPT/);
  const from = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(from, /NO_SECTION_RECEIPT/);
  assert.match(from, /sentTo/);
  const guestFn = from.slice(from.indexOf("export async function printGuestCheck"));
  assert.match(guestFn, /"receipt"/);
  assert.doesNotMatch(guestFn.slice(0, 2200), /kind: "ticket"/);
  assert.match(guestFn, /station: "receipt"/);
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /Sending to \$\{r\.sentTo/);
});

test("pay screen prints guest check before tender", () => {
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /Print check/);
  assert.match(pay, /printGuestCheck/);
  const from = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(from, /kind: "guest_check"/);
  assert.match(from, /Not a receipt - pay server/);
  assert.match(from, /cashTotalCents/);
  assert.match(from, /resolveReceiptPrinter/);
  assert.doesNotMatch(from, /window\.print\(/);
  const esc = readFileSync("src/lib/print/escpos.ts", "utf8");
  assert.match(esc, /buildGuestCheckEscPos/);
  assert.match(esc, /GUEST CHECK/);
  assert.match(esc, /Not a receipt/);
  assert.match(esc, /qrPayload/);
  assert.match(esc, /payQrBlock/);
  assert.match(from, /shouldPrintPayQr/);
  assert.match(from, /taxLines/);
});

test("dashboard test print reports Printed via station", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /Printed via \$\{/);
});

test("guide covers pay QR, venue timezone, named taxes", () => {
  const pay = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(pay, /native thermal QR/);
  assert.match(pay, /CASH TOTAL is the sum of line cash prices/);
  const floor = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(floor, /Print pay QR/);
  assert.match(floor, /Star kitchen tickets never get a pay QR/);
  const roles = readFileSync("src/lib/guide/content/roles.ts", "utf8");
  assert.match(roles, /named tax rates/);
  assert.match(roles, /IANA timezone/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.124/);
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
  assert.match(devices, /floor sections/i);
  assert.match(devices, /table.s section/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /GUIDE_VERSION/);
  assert.match(types, /2026\.10\.124/);
});
