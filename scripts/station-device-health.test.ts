import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAX_MODEL,
  PAX_MSG,
  connectedReaderForPayment,
  paxLinkStatusText,
  presentPaxHold,
  reuseHeldPaxLink,
  decideStationReaderConnect,
  paxScanPresentation,
  paymentUsesConnectedReader,
  type PaxReader,
  type PaxScanRow,
} from "../src/lib/payments/pax-d135.ts";
import {
  assignedStationSystems,
  stationHealthNotices,
} from "../src/lib/pos/station-device-health.ts";

const reader: PaxReader = {
  id: "pax_1890",
  name: "Reader 1890",
  serial: "1890297422",
  entityId: "opr_summit_copper",
  entityName: "Copper Bar",
  finixDeviceId: "DVsandbox1890",
  finixMerchantId: "MUsandbox",
  model: PAX_MODEL,
  env: "sandbox",
};

const other: PaxReader = {
  ...reader,
  id: "pax_bar",
  name: "Bar 1",
  serial: "SN240QA",
  finixDeviceId: "DVsandbox240",
};

function row(serial: string, registered = true): PaxScanRow {
  return {
    name: `PAX D135_${serial}`,
    address: "00:11",
    serial,
    registered,
    entityId: registered ? reader.entityId : null,
  };
}

test("a registered reader that is not connected shows a notice", () => {
  const systems = assignedStationSystems({
    stationId: "dev_summit_order",
    devices: [
      {
        id: "dev_summit_order",
        label: "Order tablet",
        type: "tablet",
        cardReaderId: "1890297422",
      },
      {
        id: "dev_summit_prn_kitchen",
        label: "Kitchen",
        type: "order_printer",
        print: { ip: "10.0.0.8", port: 9100 },
      },
    ],
    readers: [reader],
  });
  const notices = stationHealthNotices({ systems, connectedSerial: null });
  assert.deepEqual(
    notices.map((n) => n.text),
    ["Reader 1890 is not connected."],
  );
});

test("a connected reader and a pending printer stay quiet", () => {
  const systems = assignedStationSystems({
    stationId: "dev_summit_order",
    devices: [
      {
        id: "dev_summit_order",
        label: "Order tablet",
        type: "tablet",
        cardReaderId: "1890297422",
        receiptPrinterId: "dev_summit_prn_receipt",
      },
      {
        id: "dev_summit_prn_receipt",
        label: "Receipt",
        type: "receipt_printer",
        print: { target: "192.168.1.20:9100", boundStationIds: [] },
      },
      {
        id: "dev_summit_prn_kitchen",
        label: "Kitchen",
        type: "order_printer",
        print: { ip: "10.0.0.8", boundStationIds: ["dev_summit_order"] },
      },
    ],
    readers: [reader],
  });
  const quiet = stationHealthNotices({
    systems,
    connectedSerial: "1890297422",
    probe: { dev_summit_prn_receipt: "pending", dev_summit_prn_kitchen: "up" },
  });
  assert.equal(quiet.length, 0);
  const down = stationHealthNotices({
    systems,
    connectedSerial: "1890297422",
    probe: { dev_summit_prn_receipt: "down", dev_summit_prn_kitchen: "down" },
  });
  assert.deepEqual(
    down.map((n) => n.text),
    ["Receipt is not responding.", "Kitchen is not responding."],
  );
});

test("a printer with no host is not responding before a probe, and an unbound printer is ignored", () => {
  const systems = assignedStationSystems({
    stationId: "dev_summit_order",
    devices: [
      { id: "dev_summit_order", label: "Order tablet", type: "tablet" },
      {
        id: "dev_summit_prn_receipt",
        label: "Receipt",
        type: "receipt_printer",
        print: { boundStationIds: ["dev_summit_order"] },
      },
      {
        id: "dev_summit_prn_kitchen",
        label: "Kitchen",
        type: "order_printer",
        print: { ip: "10.0.0.8" },
      },
    ],
    readers: [reader],
  });
  assert.deepEqual(
    systems.map((s) => s.kind),
    ["receipt_printer"],
  );
  assert.deepEqual(
    stationHealthNotices({ systems, connectedSerial: null }).map((n) => n.text),
    ["Receipt is not responding."],
  );
});

test("scan rows do not say Bluetooth is off, and an empty scan does", () => {
  const listed = paxScanPresentation(
    { ok: true, devices: [{ name: "PAX D135_1890297422", address: "AA" }] },
    [reader],
  );
  assert.equal(listed.rows[0]?.serial, "1890297422");
  assert.notEqual(listed.message, PAX_MSG.bluetooth);
  assert.equal(listed.phase, "idle");

  const missingPlugin = paxScanPresentation(
    { ok: false, message: PAX_MSG.notConnected, devices: [] },
    [reader],
  );
  assert.notEqual(missingPlugin.message, PAX_MSG.bluetooth);
  assert.equal(missingPlugin.message, PAX_MSG.notConnected);

  const denied = paxScanPresentation(
    { ok: false, message: PAX_MSG.permissions, devices: [] },
    [reader],
  );
  assert.equal(denied.message, PAX_MSG.permissions);
  assert.equal(denied.message.toLowerCase().includes("bluetooth"), false);
  assert.equal(PAX_MSG.permissions.toLowerCase().includes("bluetooth"), false);

  const off = paxScanPresentation({ ok: false, message: PAX_MSG.bluetooth, devices: [] }, [reader]);
  assert.equal(off.phase, "bluetooth");
  assert.equal(off.message, "Bluetooth is off, or no reader is in range.");

  const noneNearby = paxScanPresentation({ ok: true, devices: [] }, [reader]);
  assert.equal(noneNearby.message, "Bluetooth is off, or no reader is in range.");
});

test("the station connects the assigned serial and Pay uses that reader", () => {
  const match = decideStationReaderConnect({
    row: row("1890297422"),
    readers: [reader, other],
    locationLive: false,
    assignedSerial: "1890297422",
  });
  assert.equal(match.ok, true);
  if (match.ok) {
    assert.equal(match.reader.serial, "1890297422");
    assert.equal(match.claimSlot, false);
  }

  const emptySlot = decideStationReaderConnect({
    row: row("1890297422"),
    readers: [reader],
    locationLive: false,
    assignedSerial: null,
  });
  assert.equal(emptySlot.ok, true);
  if (emptySlot.ok) assert.equal(emptySlot.claimSlot, true);

  const wrong = decideStationReaderConnect({
    row: row("SN240QA"),
    readers: [reader, other],
    locationLive: false,
    assignedSerial: "1890297422",
  });
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.equal(wrong.message, "This station is assigned to Reader 1890.");

  const unknown = decideStationReaderConnect({
    row: row("NOPE", false),
    readers: [reader],
    locationLive: false,
    assignedSerial: null,
  });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.message, PAX_MSG.notRegistered);

  const link = { phase: "connected" as const, reader };
  assert.equal(paymentUsesConnectedReader(link), true);
  assert.equal(connectedReaderForPayment(link)?.serial, "1890297422");
  assert.equal(paymentUsesConnectedReader({ phase: "idle", reader: null }), false);
  assert.equal(paymentUsesConnectedReader({ phase: "connected", reader: null }), false);
});

test("the printer probe connects without a payload and the reader timeout stays", () => {
  const raw = readFileSync(
    new URL("../android/app/src/main/java/app/summex/pos/RawPrintPlugin.java", import.meta.url),
    "utf8",
  );
  assert.match(raw, /void probe\(/);
  assert.equal(raw.includes("out.write"), true);
  const probe = raw.slice(raw.indexOf("void probe"));
  assert.equal(probe.includes("out.write"), false);
  assert.equal(probe.includes("OutputStream"), false);

  const pax = readFileSync(
    new URL("../android/app/src/main/java/app/summex/pos/PaxD135Plugin.java", import.meta.url),
    "utf8",
  );
  assert.match(pax, /CONNECT_TIMEOUT_MS = 4L \* 60L \* 1000L/);
  assert.match(pax, /Allow Nearby devices and Location, then scan again\./);
  assert.match(pax, /Bluetooth is off, or no reader is in range\./);
  assert.match(pax, /static final String MSG_CONNECTING = "Connecting"/);
  assert.match(pax, /static final String MSG_READY = "Reader ready"/);
  assert.equal(pax.includes(".disconnect("), false);
  assert.match(pax, /stopScanBeforeConnect/);
});

test("selecting a D135 holds the link and Reader ready stays", () => {
  assert.equal(presentPaxHold({ event: "select", wasReady: false }).message, "Connecting");
  assert.equal(presentPaxHold({ event: "processing", wasReady: false }).message, "Setting up reader");
  const ready = presentPaxHold({ event: "accepted", wasReady: false });
  assert.equal(ready.message, "Reader ready");
  assert.equal(ready.hold, true);
  assert.equal(paxLinkStatusText({ phase: "connected", message: "Reader ready" }), "Reader ready");
  assert.equal(paxLinkStatusText({ phase: "connecting", message: "Connecting" }), "Connecting");

  const early = presentPaxHold({
    event: "failed",
    wasReady: false,
    message: "The reader disconnected. The check is not paid. Try again.",
  });
  assert.equal(early.message, PAX_MSG.notConnected);
  assert.equal(early.hold, false);

  const dropped = presentPaxHold({ event: "dropped", wasReady: true });
  assert.equal(dropped.message, "The reader disconnected. The check is not paid. Try again.");
  assert.equal(dropped.hold, false);

  assert.equal(
    reuseHeldPaxLink({
      heldReady: true,
      heldConnected: true,
      heldSerial: "1890297422",
      serial: "1890297422",
    }),
    true,
  );
  assert.equal(
    reuseHeldPaxLink({
      heldReady: false,
      heldConnected: true,
      heldSerial: "1890297422",
      serial: "1890297422",
    }),
    false,
  );
});
