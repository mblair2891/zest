import test from "node:test";
import assert from "node:assert/strict";
import { resolveReceiptPrinter } from "../src/lib/print/receipt-printer.ts";
import type { LocationDevice } from "../src/lib/pos/location-devices.ts";

function printer(id: string, station: "receipt" | "kitchen"): LocationDevice {
  return {
    id,
    locationId: "loc",
    label: id,
    type: "printer",
    status: "online",
    lastSeenAt: 1,
    assignment: { operatorId: "host", function: "cashier" },
    print: { family: "epson", connection: "lan", target: "10.0.0.8:9100", station },
  };
}

function tablet(id: string, receiptPrinterId: string | null): LocationDevice {
  return {
    id,
    locationId: "loc",
    label: "Handheld 1",
    type: "tablet_pos",
    status: "online",
    lastSeenAt: 1,
    assignment: { operatorId: "host", function: "floor_pos" },
    receiptPrinterId,
  };
}

test("uses the printer mapped on the station row", () => {
  const mapped = printer("prn_bar", "receipt");
  const fallback = printer("prn_front", "receipt");
  const station = tablet("tab_1", "prn_bar");
  const hit = resolveReceiptPrinter([mapped, fallback, station], "tab_1");
  assert.equal(hit?.id, "prn_bar");
});

test("falls back to venue default receipt printer", () => {
  const kitchen = printer("prn_kds", "kitchen");
  const receipt = printer("prn_front", "receipt");
  const station = tablet("tab_1", null);
  const hit = resolveReceiptPrinter([kitchen, receipt, station], "tab_1");
  assert.equal(hit?.id, "prn_front");
});

test("ignores a mapped id that is gone and uses default", () => {
  const receipt = printer("prn_front", "receipt");
  const station = tablet("tab_1", "prn_missing");
  const hit = resolveReceiptPrinter([receipt, station], "tab_1");
  assert.equal(hit?.id, "prn_front");
});
