import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  paxAutoConnectPlan,
  paxLinkStatusText,
  rememberPaxBluetooth,
  rememberedPaxBluetooth,
  stationDeviceFaceStatus,
  type PaxReader,
} from "../src/lib/payments/pax-d135.ts";

const reader: PaxReader = {
  id: "pax_1",
  name: "Bar reader 1",
  serial: "ABC123",
  entityId: "ent_bar",
  entityName: "Bar",
  finixDeviceId: "DVreader",
  finixMerchantId: "MUreader",
  model: "PAX_D135",
  env: "sandbox",
  link: "bluetooth",
};

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

test("Devices face is Connected or Not connected", () => {
  assert.deepEqual(
    stationDeviceFaceStatus({ phase: "connected", connectedSerial: "ABC123", assignedSerial: "ABC123" }),
    { label: "Connected", connected: true },
  );
  assert.deepEqual(
    stationDeviceFaceStatus({ phase: "idle", connectedSerial: "", assignedSerial: "ABC123" }),
    { label: "Not connected", connected: false },
  );
  assert.deepEqual(
    stationDeviceFaceStatus({
      phase: "connected",
      connectedSerial: "OTHER",
      assignedSerial: "ABC123",
    }),
    { label: "Not connected", connected: false },
  );
  assert.equal(
    stationDeviceFaceStatus({
      phase: "connected",
      connectedSerial: "ABC123",
      assignedSerial: "ABC123",
      usb: true,
      usbAttached: false,
    }).label,
    "Not connected",
  );
  assert.equal(
    stationDeviceFaceStatus({
      phase: "connected",
      connectedSerial: "ABC123",
      assignedSerial: "ABC123",
      usb: true,
      usbAttached: true,
    }).label,
    "Connected",
  );
  assert.equal(paxLinkStatusText({ phase: "connected", message: "Reader ready" }), "Reader ready");
});

test("assigned Bluetooth reader connects from a saved address, otherwise it scans", () => {
  assert.equal(
    paxAutoConnectPlan({
      phase: "idle",
      assigned: reader,
      rememberedAddress: "AA:BB:CC:DD:EE:FF",
    }),
    "direct",
  );
  assert.equal(paxAutoConnectPlan({ phase: "idle", assigned: reader }), "scan");
  assert.equal(
    paxAutoConnectPlan({
      phase: "connected",
      connectedSerial: "ABC123",
      assigned: reader,
      rememberedAddress: "AA:BB:CC:DD:EE:FF",
    }),
    "skip",
  );
  assert.equal(
    paxAutoConnectPlan({ phase: "connecting", assigned: reader, rememberedAddress: "AA:BB:CC:DD:EE:FF" }),
    "skip",
  );
  assert.equal(paxAutoConnectPlan({ phase: "idle", assigned: { ...reader, link: "usb" }, usbAttached: false }), "skip");
  assert.equal(paxAutoConnectPlan({ phase: "idle", assigned: { ...reader, link: "usb" }, usbAttached: true }), "usb");
  assert.equal(paxAutoConnectPlan({ phase: "idle", assigned: { ...reader, link: "network" } }), "skip");
  assert.equal(paxAutoConnectPlan({ phase: "idle", assigned: null }), "skip");
});

test("a successful Bluetooth connect keeps the address for the next launch", () => {
  const prior = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  try {
    assert.equal(rememberedPaxBluetooth("ABC123"), null);
    rememberPaxBluetooth({ serial: "ABC123", address: "usb", name: "Bar reader 1" });
    assert.equal(rememberedPaxBluetooth("ABC123"), null);
    rememberPaxBluetooth({ serial: "ABC123", address: "AA:BB:CC:DD:EE:FF", name: "Bar reader 1" });
    assert.deepEqual(rememberedPaxBluetooth("ABC123"), {
      serial: "ABC123",
      address: "AA:BB:CC:DD:EE:FF",
      name: "Bar reader 1",
    });
  } finally {
    globalThis.localStorage = prior;
  }
});

test("the station Devices screen shows the short status and still scans", () => {
  const source = readFileSync(new URL("../src/components/pos/StationDevices.tsx", import.meta.url), "utf8");
  const screen = source.slice(source.indexOf("data-station-device-screen"));
  assert.match(source, /requestAssignedReaderConnect\("launch"\)/);
  assert.match(source, /requestAssignedReaderConnect\("devices"\)/);
  assert.match(source, /rememberPaxBluetooth/);
  assert.match(source, /paxAutoConnectPlan/);
  assert.match(source, /stationDeviceFaceStatus/);
  assert.match(screen, /Scan for reader/);
  assert.match(screen, /data-pax-status/);
  assert.match(screen, /data-pax-face=\{face\.connected \? "connected" : "down"\}/);
  assert.match(screen, /text-emerald-700/);
  assert.match(screen, /text-amber-700/);
  assert.match(screen, /paxScanRowLabel/);
  assert.doesNotMatch(source, /Scan for a paired PAX D135/);
  assert.doesNotMatch(source, /Battery /);
  assert.doesNotMatch(source, /paxLinkStatusText/);
  assert.doesNotMatch(source, /payReaderStatusText/);
  assert.doesNotMatch(screen, /Environment /);
  assert.doesNotMatch(screen, /Username present/);
  assert.doesNotMatch(screen, /Password present/);
  assert.doesNotMatch(screen, /Reader ready/);
  const guide = readFileSync(new URL("../src/lib/guide/content/devices.ts", import.meta.url), "utf8");
  assert.match(guide, /shows Connected or Not connected/);
  assert.match(guide, /connects on its own when it is on and was connected here before/);
  assert.match(guide, /Scan for reader is still there/);
  assert.match(guide, /A successful connect shows Reader ready/);
  assert.match(guide, /which credential or environment was used/);
});
