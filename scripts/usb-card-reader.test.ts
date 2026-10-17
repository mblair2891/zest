/**
 * USB card reader: connection choice, pay status, and authorize / capture / void.
 * Run with npx tsx --test scripts/usb-card-reader.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CARD_READER_USB_NOT_CONNECTED,
  PAX_MODEL,
  PAX_MSG,
  normalizePaxLink,
  parsePaxReaders,
  payReaderStatusText,
  placePaxReader,
  readerLink,
  runAndroidPaxCapture,
  runAndroidPaxSale,
  runAndroidPaxVoid,
  setPaxReaderLink,
  usbCardStep,
  type PaxReader,
} from "../src/lib/payments/pax-d135.ts";

const reader: PaxReader = {
  id: "pax_usb",
  name: "Bar 1",
  serial: "1890297422",
  entityId: "ent_bar",
  entityName: "Bar",
  finixDeviceId: "DVsandbox1",
  finixMerchantId: "MUabc",
  model: PAX_MODEL,
  env: "sandbox",
};

function saleBridge(calls: { n: number }) {
  return {
    sale: async () => {
      calls.n += 1;
      return { ok: true, transferId: "TR_usb", last4: "0010" };
    },
    capture: async () => {
      calls.n += 1;
      return { ok: true };
    },
    voidSale: async () => {
      calls.n += 1;
      return { ok: true };
    },
  };
}

test("a saved reader with no connection stays on Bluetooth", () => {
  const parsed = parsePaxReaders([
    {
      id: "pax_old",
      name: "Bar 1",
      serial: "1890297422",
      entityId: "ent_bar",
      finixDeviceId: "DVsandbox1",
      finixMerchantId: "MUabc",
    },
  ]);
  assert.equal(parsed[0]?.link, "bluetooth");
  assert.equal(normalizePaxLink("wifi"), "bluetooth");
  assert.equal(normalizePaxLink("USB"), "usb");
  const placed = placePaxReader({
    readers: [],
    name: "Patio",
    serial: "SN9",
    entityId: "ent_bar",
    entityName: "Bar",
    locationLive: false,
    deviceId: "DV9",
    merchantId: "MUabc",
    id: "pax_patio",
    link: "usb",
  });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.equal(placed.reader.link, "usb");
  const changed = setPaxReaderLink({ readers: placed.readers, id: "pax_patio", link: "network" });
  assert.equal(changed.ok, true);
  if (!changed.ok) return;
  assert.equal(readerLink(changed.reader), "network");
});

test("USB unplugged blocks authorize, capture, and void", async () => {
  const calls = { n: 0 };
  const bridge = saleBridge(calls);
  for (const step of ["authorize", "capture", "void"] as const) {
    const blocked = usbCardStep({ link: "usb", usbAttached: false, step });
    assert.equal(blocked.ok, false);
    if (blocked.ok) continue;
    assert.equal(blocked.message, "Card reader not connected");
    assert.equal(blocked.message, CARD_READER_USB_NOT_CONNECTED);
  }
  const sale = await runAndroidPaxSale({
    checkId: "chk_usb_off",
    amountCents: 102,
    locationLive: false,
    reader: { ...reader, link: "usb" },
    sellingEntityId: "ent_bar",
    alreadyCaptured: false,
    settingUp: false,
    connected: true,
    bluetoothOff: true,
    link: "usb",
    usbAttached: false,
    bridge,
  });
  assert.equal(sale.ok, false);
  if (sale.ok) return;
  assert.equal(sale.message, CARD_READER_USB_NOT_CONNECTED);
  assert.equal(sale.charged, false);
  const captured = await runAndroidPaxCapture({
    link: "usb",
    usbAttached: false,
    transferId: "TR_usb",
    amountCents: 102,
    bridge,
  });
  assert.equal(captured.ok, false);
  if (captured.ok) return;
  assert.equal(captured.message, CARD_READER_USB_NOT_CONNECTED);
  const voided = await runAndroidPaxVoid({
    link: "usb",
    usbAttached: false,
    transferId: "TR_usb",
    amountCents: 102,
    bridge,
  });
  assert.equal(voided.ok, false);
  if (voided.ok) return;
  assert.equal(voided.message, CARD_READER_USB_NOT_CONNECTED);
  assert.equal(calls.n, 0);
});

test("USB attached authorizes, captures, and voids on the Finix bridge", async () => {
  const calls = { n: 0 };
  const bridge = saleBridge(calls);
  const sale = await runAndroidPaxSale({
    checkId: "chk_usb_on",
    amountCents: 102,
    locationLive: false,
    reader: { ...reader, link: "usb" },
    sellingEntityId: "ent_bar",
    alreadyCaptured: false,
    settingUp: false,
    connected: true,
    bluetoothOff: true,
    link: "usb",
    usbAttached: true,
    bridge,
  });
  assert.equal(sale.ok, true);
  if (!sale.ok) return;
  assert.equal(sale.transferId, "TR_usb");
  const captured = await runAndroidPaxCapture({
    link: "usb",
    usbAttached: true,
    transferId: sale.transferId,
    amountCents: 120,
    bridge,
  });
  assert.equal(captured.ok, true);
  const voided = await runAndroidPaxVoid({
    link: "usb",
    usbAttached: true,
    transferId: sale.transferId,
    amountCents: 102,
    bridge,
  });
  assert.equal(voided.ok, true);
  assert.equal(calls.n, 3);
  assert.equal(
    payReaderStatusText({ link: "usb", usbAttached: true, phase: "connected", message: "" }),
    PAX_MSG.ready,
  );
  assert.equal(
    payReaderStatusText({ link: "usb", usbAttached: false, phase: "connected", message: PAX_MSG.ready }),
    CARD_READER_USB_NOT_CONNECTED,
  );
});

test("Bluetooth and Network ignore a missing USB cable", async () => {
  const calls = { n: 0 };
  const bridge = saleBridge(calls);
  const bluetooth = await runAndroidPaxSale({
    checkId: "chk_bt_ok",
    amountCents: 500,
    locationLive: false,
    reader,
    sellingEntityId: "ent_bar",
    alreadyCaptured: false,
    settingUp: false,
    connected: true,
    bluetoothOff: false,
    link: "bluetooth",
    usbAttached: false,
    bridge,
  });
  assert.equal(bluetooth.ok, true);
  const network = usbCardStep({ link: "network", usbAttached: false, step: "authorize" });
  assert.equal(network.ok, true);
  if (!network.ok) return;
  assert.equal(network.transport, "existing");
  const capture = await runAndroidPaxCapture({
    link: "network",
    usbAttached: false,
    transferId: "TR_net",
    amountCents: 500,
    bridge,
  });
  assert.equal(capture.ok, true);
  if (!capture.ok) return;
  assert.equal(capture.skipped, true);
  const voided = await runAndroidPaxVoid({
    link: "bluetooth",
    usbAttached: false,
    transferId: "TR_bt",
    amountCents: 500,
    bridge,
  });
  assert.equal(voided.ok, true);
  if (!voided.ok) return;
  assert.equal(voided.skipped, true);
  assert.equal(calls.n, 1);
  assert.equal(
    payReaderStatusText({ link: "bluetooth", usbAttached: false, phase: "idle", message: PAX_MSG.notConnected }),
    PAX_MSG.notConnected,
  );
});

test("the station USB path, pay screen, and guide name the cable", () => {
  const plugin = readFileSync("android/app/src/main/java/app/summex/pos/PaxD135Plugin.java", "utf8");
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  const devicesUi = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  const guide = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  const filter = readFileSync("android/app/src/main/res/xml/usb_printer_filter.xml", "utf8");
  const raw = readFileSync("android/app/src/main/java/app/summex/pos/RawPrintPlugin.java", "utf8");
  assert.match(plugin, /Card reader not connected/);
  assert.match(plugin, /if \(!usb && !bluetoothOn\(\)\)/);
  assert.match(plugin, /getUsbDevice/);
  assert.match(plugin, /DeviceInfo\.CommType\.USB/);
  assert.match(plugin, /access\$setConnectionState\$p/);
  assert.match(plugin, /startRefund/);
  assert.match(plugin, /finishTransaction/);
  assert.doesNotMatch(plugin, /RawPrint/);
  assert.doesNotMatch(plugin, /bulkTransfer/);
  assert.match(pay, /CARD_READER_USB_NOT_CONNECTED/);
  assert.match(pay, /data-pax-status/);
  assert.match(pay, /data-void-card/);
  assert.match(pay, /runAndroidPaxCapture/);
  assert.match(pay, /runAndroidPaxVoid/);
  assert.match(devicesUi, /data-pax-connection/);
  assert.match(guide, /Card reader not connected/);
  assert.match(guide, /Bluetooth, Network, or USB/);
  assert.match(filter, /vendor-id="12216"/);
  assert.match(filter, /vendor-id="1208"/);
  assert.match(filter, /vendor-id="1305"/);
  assert.match(filter, /vendor-id="5380"/);
  assert.match(raw, /void probe/);
  const probe = raw.slice(raw.indexOf("void probe"));
  assert.doesNotMatch(probe, /out\.write/);
  assert.doesNotMatch(probe, /OutputStream/);
});
