import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("devices tab type dropdown includes printers", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /receipt_printer/);
  assert.match(ui, /kitchen_printer/);
  assert.match(ui, /bar_printer/);
  assert.match(ui, /label_printer/);
  assert.match(ui, /Test print/);
  assert.match(ui, /Static IP/);
  assert.match(ui, /Cash drawer kick/);
  assert.match(ui, /Station bindings/);
  assert.match(ui, /All entities at this venue/);
  assert.doesNotMatch(ui, /JSON\.stringify\(print/);
  const types = readFileSync("src/lib/pos/location-devices.ts", "utf8");
  assert.match(types, /receipt_printer/);
  assert.match(types, /pendingPrinterDevice/);
  assert.match(types, /defaultOnboardingPrinters/);
});

test("summit hall seeds receipt, kitchen, and bar printer slots", () => {
  const seed = readFileSync("src/lib/saas/summit-hall.ts", "utf8");
  assert.match(seed, /dev_summit_prn_receipt/);
  assert.match(seed, /dev_summit_prn_kitchen/);
  assert.match(seed, /dev_summit_prn_bar/);
  const merge = readFileSync("src/lib/saas/summit-hall-seed.server.ts", "utf8");
  assert.match(merge, /pendingPrinterDevice/);
  const onboard = readFileSync("src/lib/saas/onboarding.server.ts", "utf8");
  assert.match(onboard, /defaultOnboardingPrinters/);
});

test("guide printers topic is form fields on Devices", () => {
  const guide = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(guide, /id: "printers-kds"/);
  assert.match(guide, /Static IP/);
  assert.match(guide, /ODS does not need a receipt printer/);
});
