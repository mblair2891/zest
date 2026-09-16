import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("devices tab type dropdown includes printers", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /receipt_printer/);
  assert.match(ui, /PRINTER_UI_TYPES/);
  assert.match(ui, /isOrderPrinterType/);
  assert.match(ui, /isReceiptPrinterType/);
  assert.match(ui, /Test print/);
  assert.match(ui, /Static IP/);
  assert.match(ui, /Cash drawer kick/);
  assert.match(ui, /Destination/);
  assert.match(ui, /Add destination/);
  assert.match(ui, /DEFAULT_ORDER_DESTINATION/);
  assert.doesNotMatch(ui, /datalist/);
  assert.match(ui, /Print pay QR/);
  assert.match(ui, /PRINTER_MODEL_GROUPS/);
  assert.match(ui, /dispatchRawTestPrint/);
  assert.doesNotMatch(ui, /forceBrowser/);
  assert.doesNotMatch(ui, /window\.print/);
  assert.match(ui, /Which order \/ host stations use it/);
  assert.match(ui, /Which stations may send to it/);
  assert.match(ui, /All entities at this venue/);
  assert.doesNotMatch(ui, /Kitchen printer/);
  assert.doesNotMatch(ui, /Bar printer/);
  assert.doesNotMatch(ui, /Label printer/);
  assert.doesNotMatch(ui, /JSON\.stringify\(print/);
  const types = readFileSync("src/lib/pos/location-devices.ts", "utf8");
  assert.match(types, /receipt_printer/);
  assert.match(types, /order_printer/);
  assert.match(types, /PRINTER_UI_TYPES/);
  assert.match(types, /canonicalizePrinterDevice/);
  assert.match(types, /pendingPrinterDevice/);
  assert.match(types, /defaultOnboardingPrinters/);
  assert.match(types, /kitchen_printer: "Order printer"/);
  assert.match(types, /bar_printer: "Order printer"/);
  assert.match(types, /label_printer: "Order printer"/);
  const panel = readFileSync("src/components/pos/DeviceAssignmentPanel.tsx", "utf8");
  assert.match(panel, /PRINTER_UI_TYPES/);
  assert.doesNotMatch(panel, /DEVICE_TYPES\.map/);
});

test("summit hall seeds receipt, kitchen, and bar printer slots", () => {
  const seed = readFileSync("src/lib/saas/summit-hall.ts", "utf8");
  assert.match(seed, /dev_summit_prn_receipt/);
  assert.match(seed, /dev_summit_prn_kitchen/);
  assert.match(seed, /dev_summit_prn_bar/);
  assert.match(seed, /type: "order_printer"/);
  assert.match(seed, /kind: "kitchen"/);
  assert.match(seed, /kind: "bar"/);
  assert.match(seed, /destinationName: "Kitchen"/);
  const merge = readFileSync("src/lib/saas/summit-hall-seed.server.ts", "utf8");
  assert.match(merge, /pendingPrinterDevice/);
  assert.match(merge, /canonicalizePrinterDevice/);
  const onboard = readFileSync("src/lib/saas/onboarding.server.ts", "utf8");
  assert.match(onboard, /defaultOnboardingPrinters/);
});

test("guide printers topic is form fields on Devices", () => {
  const guide = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(guide, /id: "printers-kds"/);
  assert.match(guide, /Static IP/);
  assert.match(guide, /Order printer/);
  assert.match(guide, /ODS does not need a receipt printer/);
  assert.match(guide, /Star SP700 \/ SP742/);
  assert.match(guide, /Generic ESC\/POS/);
  assert.match(guide, /raw bytes/);
  assert.match(guide, /default Kitchen/);
  assert.match(guide, /Receipt printers have no destination/);
});

test("print dispatch test path never uses window.print", () => {
  const dispatch = readFileSync("src/lib/print/dispatch.ts", "utf8");
  assert.match(dispatch, /dispatchRawTestPrint/);
  assert.match(dispatch, /Never window\.print/);
  assert.match(dispatch, /rawLanPrintFn/);
  const agent = readFileSync("scripts/print-agent.mjs", "utf8");
  assert.match(agent, /9100/);
  assert.match(agent, /never uses the OS print dialog/);
});
