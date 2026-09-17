import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cashAtCopy,
  receiptPrinterKicksForStation,
  receiptPrinterServesStation,
  resolveReceiptPrinter,
  stationHasBoundReceiptPrinter,
  stationMayKickDrawer,
} from "../src/lib/print/receipt-bind.ts";
import type { ReceiptBindDevice } from "../src/lib/print/receipt-bind.ts";

function printer(
  id: string,
  opts?: { bound?: string[]; kick?: string[]; station?: "receipt" | "kitchen"; type?: string },
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
      kickStationIds: opts?.kick,
      reachability: "unreachable",
    },
  };
}

function tablet(
  id: string,
  fn: string,
  receiptPrinterId?: string | null,
  stationClass?: "handheld" | "terminal",
): ReceiptBindDevice {
  return {
    id,
    locationId: "loc",
    label: id,
    type: fn === "host_stand" ? "host_stand" : "tablet_pos",
    status: "online",
    lastSeenAt: 1,
    assignment: { operatorId: "host", function: fn },
    receiptPrinterId: receiptPrinterId ?? null,
    stationClass,
  };
}

test("empty bound list is not a pay station", () => {
  const receipt = printer("prn_front", { bound: [] });
  const order = tablet("tab_order", "floor_pos");
  const host = tablet("tab_host", "host_stand");
  const ods = tablet("tab_ods", "kitchen_kds");
  const devices = [receipt, order, host, ods];
  assert.equal(receiptPrinterServesStation(receipt, { stationDeviceId: order.id, devices }), false);
  assert.equal(receiptPrinterServesStation(receipt, { stationDeviceId: host.id, devices }), false);
  assert.equal(receiptPrinterServesStation(receipt, { stationDeviceId: ods.id, devices }), false);
  assert.equal(stationHasBoundReceiptPrinter(devices, order.id), false);
  assert.equal(stationHasBoundReceiptPrinter(devices, ods.id), false);
  assert.match(cashAtCopy(devices), /Cash at a register or host stand/);
});

test("print bind is not kick bind; handheld prints receipts, terminal kicks", () => {
  const hand = tablet("tab_hh", "floor_pos", null, "handheld");
  const term = tablet("tab_k11", "floor_pos", null, "terminal");
  const host = tablet("tab_host", "host_stand", null, "terminal");
  const receipt = printer("prn_front", {
    bound: [hand.id, term.id, host.id],
    kick: [term.id, host.id],
  });
  const devices = [receipt, hand, term, host];
  assert.equal(receiptPrinterServesStation(receipt, { stationDeviceId: hand.id, devices }), true);
  assert.equal(receiptPrinterKicksForStation(receipt, { stationDeviceId: hand.id, devices }), false);
  assert.equal(stationMayKickDrawer(devices, hand.id), false);
  assert.equal(stationMayKickDrawer(devices, term.id), true);
  assert.equal(resolveReceiptPrinter(devices, hand.id)?.id, "prn_front");
  assert.match(cashAtCopy(devices), /Cash at tab_k11 or tab_host/);
});

test("bound list is this station id, not every order tablet", () => {
  const orderA = tablet("tab_a", "floor_pos", null, "terminal");
  const orderB = tablet("tab_b", "floor_pos", null, "handheld");
  const host = tablet("tab_host", "host_stand");
  const receipt = printer("prn_front", { bound: [orderA.id, host.id] });
  const devices = [receipt, orderA, orderB, host];
  assert.equal(resolveReceiptPrinter(devices, orderA.id)?.id, "prn_front");
  assert.equal(resolveReceiptPrinter(devices, orderB.id), undefined);
  assert.equal(resolveReceiptPrinter(devices, host.id)?.id, "prn_front");
  assert.match(cashAtCopy(devices), /Cash at tab_a or tab_host/);
});

test("does not require reachable from the cloud host", () => {
  const receipt = printer("prn_front", { bound: ["tab_order"] });
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

test("unbound handheld does not inherit a kitchen or unbound receipt printer", () => {
  const kitchen = printer("prn_kds", { station: "kitchen", type: "order_printer" });
  const receipt = printer("prn_front");
  const station = tablet("tab_1", "floor_pos", null);
  const hit = resolveReceiptPrinter([kitchen, receipt, station], "tab_1");
  assert.equal(hit, undefined);
});

test("devices UI and pad: print vs kick lists", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /Stations that may print/);
  assert.match(ui, /Stations that may kick drawer/);
  assert.match(ui, /Leave handhelds unchecked/);
  assert.match(ui, /Handheld \(card, no drawer\)/);
  const pad = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  assert.match(pad, /data-cash-at/);
  assert.match(pad, /cashAtCopy/);
  assert.match(pad, /Flip to guest|mayPrintCheck/);
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /data-guest-pay-face/);
  assert.match(pay, /data-guest-sign/);
  assert.match(pay, /Open on terminal/);
  assert.match(pay, /sendGuestReceiptSmsFn/);
  const from = readFileSync("src/lib/print/from-store.ts", "utf8");
  const start = from.indexOf("export async function printGuestReceipt");
  assert.match(from.slice(start, start + 4500), /enqueueKitchenJob/);
  const menu = readFileSync("src/lib/pos/station-menu.ts", "utf8");
  assert.match(menu, /canPayStation/);
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(store, /cashAtCopy/);
  assert.match(store, /flagReceiptPending/);
});

test("gone mapped id does not fall back to an unbound receipt printer", () => {
  const receipt = printer("prn_front");
  const station = tablet("tab_1", "floor_pos", "prn_missing");
  const hit = resolveReceiptPrinter([receipt, station], "tab_1");
  assert.equal(hit, undefined);
});
