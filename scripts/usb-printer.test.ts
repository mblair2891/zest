import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parsePrinterConfig } from "../src/lib/pos/location-devices.ts";
import {
  USB_NOT_CONNECTED_LABEL,
  USB_STATUS_LABEL,
  byteTargetForPrinter,
  normalizePrinterLink,
  printerEthernetOnly,
  printerIsUsb,
  printerLinkChoices,
  usbStatusLabel,
} from "../src/lib/print/printer-transport.ts";
import {
  jobClaimableBy,
  jobIsClaimable,
  parseStationPrintQueue,
} from "../src/lib/print/station-print-queue.ts";

test("Ethernet keeps an IP on port 9100 and USB does not", () => {
  const lan = byteTargetForPrinter({
    link: "ethernet",
    modelPreset: "epson_tm_t20",
    ip: "192.168.0.112",
    port: 9100,
  });
  assert.equal(lan?.transport, "lan");
  assert.equal(lan?.host, "192.168.0.112");
  assert.equal(lan?.port, 9100);

  const usb = byteTargetForPrinter({
    link: "usb",
    modelPreset: "epson_tm_t20",
    ip: "192.168.0.112",
    boundStationIds: ["elo-1"],
  });
  assert.equal(usb?.transport, "usb");
  assert.equal(usb?.host, "usb");
  assert.deepEqual(usb?.stationIds, ["elo-1"]);
  assert.equal(printerIsUsb("usb", "epson_tm_t20"), true);
});

test("Star kitchen printer stays Ethernet", () => {
  assert.equal(printerEthernetOnly("star_sp700"), true);
  assert.equal(normalizePrinterLink("usb", "star_sp700"), "ethernet");
  assert.deepEqual(printerLinkChoices("usb", "star_sp700"), ["ethernet"]);
  assert.deepEqual(printerLinkChoices("ethernet", "epson_tm_t20"), ["ethernet", "usb"]);
  assert.deepEqual(printerLinkChoices("wifi", "epson_tm_t20"), ["ethernet", "wifi", "usb"]);
  const parsed = parsePrinterConfig({
    modelPreset: "star_sp700",
    link: "usb",
    ip: "192.168.0.105",
    port: 9100,
    station: "kitchen",
  });
  assert.equal(parsed?.link, "ethernet");
  assert.equal(parsed?.ip, "192.168.0.105");
  const epson = parsePrinterConfig({
    modelPreset: "epson_tm_t20",
    link: "usb",
    station: "receipt",
    usbAttached: false,
  });
  assert.equal(epson?.link, "usb");
  assert.equal(epson?.usbAttached, false);
  assert.equal(epson?.ip, undefined);
});

test("USB with no printer stays queued for the owning station", () => {
  assert.equal(usbStatusLabel(undefined), USB_STATUS_LABEL);
  assert.equal(usbStatusLabel(true), "USB");
  assert.equal(usbStatusLabel(false), USB_NOT_CONNECTED_LABEL);
  const now = Date.now();
  const parsed = parseStationPrintQueue([
    {
      id: "job-usb",
      printerId: "prn-receipt",
      host: "usb",
      port: 0,
      transport: "usb",
      stationIds: ["elo-1"],
      escposBase64: "QQ==",
      kind: "receipt",
      queuedAt: now,
    },
    {
      id: "job-lan",
      printerId: "prn-kitchen",
      host: "192.168.0.105",
      port: 9100,
      escposBase64: "QQ==",
      kind: "ticket",
      queuedAt: now,
    },
  ]);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.transport, "usb");
  assert.equal(parsed[1]?.host, "192.168.0.105");
  assert.equal(parsed[1]?.port, 9100);
  const waiting = { ...parsed[0]!, ok: false as const };
  assert.equal(jobIsClaimable(waiting), true);
  assert.equal(jobClaimableBy(waiting, "elo-1", "order"), true);
  assert.equal(jobClaimableBy(waiting, "elo-2", "order"), false);
  assert.equal(jobClaimableBy(waiting, "print-agent", "print-agent"), false);
  assert.equal(jobClaimableBy(parsed[1]!, "print-agent", "print-agent"), true);
});

test("printer setup, dispatch, and the station offer USB and keep Ethernet", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /data-printer-connection/);
  assert.match(ui, /printerLinkChoices/);
  assert.match(ui, /Static IP/);
  assert.match(ui, /USB printer not connected/);
  assert.match(ui, /Star kitchen printers stay on Ethernet/);
  const dispatch = readFileSync("src/lib/print/dispatch.ts", "utf8");
  assert.match(dispatch, /dispatchRawTestPrint/);
  assert.match(dispatch, /sendNativeUsbBytes/);
  assert.match(dispatch, /deliverRawPrint/);
  assert.doesNotMatch(dispatch, /window\.print\(/);
  const fromStore = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(fromStore, /byteTargetForPrinter/);
  const watcher = readFileSync("src/components/pos/StationPublishWatcher.tsx", "utf8");
  assert.match(watcher, /sendNativeUsbBytes/);
  assert.match(watcher, /deliverRawPrint/);
  const plugin = readFileSync("android/app/src/main/java/app/summex/pos/RawPrintPlugin.java", "utf8");
  assert.match(plugin, /void sendUsb\(/);
  assert.match(plugin, /void sendBytes\(/);
  assert.match(plugin, /bulkTransfer/);
  const guide = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(guide, /USB printer not connected/);
  assert.match(guide, /Star kitchen printer stays on Ethernet/);
  assert.match(guide, /Static IP/);
  assert.match(guide, /Star SP700 \/ SP742/);
  const queue = readFileSync("src/lib/print/queue.server.ts", "utf8");
  assert.match(queue, /preferOnly && !isUsbPrintJob/);
});
