import test from "node:test";
import assert from "node:assert/strict";
import {
  receiptPrinterServesStation,
  resolveReceiptPrinter,
  stationHasBoundReceiptPrinter,
} from "../src/lib/print/receipt-bind.ts";
import type { ReceiptBindDevice } from "../src/lib/print/receipt-bind.ts";

function printer(
  id: string,
  opts?: { bound?: string[]; station?: "receipt" | "kitchen"; type?: string },
): ReceiptBindDevice {
  return {
    id,
    locationId: "loc",
    label: id,
    type: opts?.type ?? "receipt_printer",
    status: "online",
    lastSeenAt: 1,
    assignment: { operatorId: "host", function: "cashier" },
    print: {
      family: "epson",
      connection: "lan",
      target: "192.168.0.112:9100",
      station: opts?.station ?? "receipt",
      boundStationIds: opts?.bound ?? [],
      reachability: "unreachable",
    },
  };
}

function tablet(id: string, fn: string, receiptPrinterId?: string | null): ReceiptBindDevice {
  return {
    id,
    locationId: "loc",
    label: id,
    type: fn === "host_stand" ? "host_stand" : "tablet_pos",
    status: "online",
    lastSeenAt: 1,
    assignment: { operatorId: "host", function: fn },
    receiptPrinterId: receiptPrinterId ?? null,
  };
}

test("empty bound list = every order and host station", () => {
  const receipt = printer("prn_front", { bound: [] });
  const order = tablet("tab_order", "floor_pos");
  const host = tablet("tab_host", "host_stand");
  const ods = tablet("tab_ods", "kitchen_kds");
  const devices = [receipt, order, host, ods];
  assert.equal(receiptPrinterServesStation(receipt, { stationDeviceId: order.id, devices }), true);
  assert.equal(receiptPrinterServesStation(receipt, { stationDeviceId: host.id, devices }), true);
  assert.equal(receiptPrinterServesStation(receipt, { stationDeviceId: ods.id, devices }), false);
  assert.equal(stationHasBoundReceiptPrinter(devices, order.id), true);
  assert.equal(stationHasBoundReceiptPrinter(devices, ods.id), false);
});

test("bound list includes this order/host role", () => {
  const orderA = tablet("tab_a", "floor_pos");
  const orderB = tablet("tab_b", "floor_pos");
  const host = tablet("tab_host", "host_stand");
  const receipt = printer("prn_front", { bound: [orderA.id] });
  const devices = [receipt, orderA, orderB, host];
  assert.equal(resolveReceiptPrinter(devices, orderA.id)?.id, "prn_front");
  assert.equal(resolveReceiptPrinter(devices, orderB.id)?.id, "prn_front");
  assert.equal(resolveReceiptPrinter(devices, host.id), undefined);
});

test("does not require reachable from the cloud host", () => {
  const receipt = printer("prn_front", { bound: [] });
  assert.equal(receipt.print?.reachability, "unreachable");
  const order = tablet("tab_order", "floor_pos");
  assert.equal(stationHasBoundReceiptPrinter([receipt, order], order.id), true);
});

test("uses the printer mapped on the station row", () => {
  const mapped = printer("prn_bar");
  const fallback = printer("prn_front");
  const station = tablet("tab_1", "floor_pos", "prn_bar");
  const hit = resolveReceiptPrinter([mapped, fallback, station], "tab_1");
  assert.equal(hit?.id, "prn_bar");
});

test("falls back to venue default receipt printer", () => {
  const kitchen = printer("prn_kds", { station: "kitchen", type: "order_printer" });
  const receipt = printer("prn_front");
  const station = tablet("tab_1", "floor_pos", null);
  const hit = resolveReceiptPrinter([kitchen, receipt, station], "tab_1");
  assert.equal(hit?.id, "prn_front");
});

test("ignores a mapped id that is gone and uses default", () => {
  const receipt = printer("prn_front");
  const station = tablet("tab_1", "floor_pos", "prn_missing");
  const hit = resolveReceiptPrinter([receipt, station], "tab_1");
  assert.equal(hit?.id, "prn_front");
});
