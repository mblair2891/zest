import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOST_SCOPE } from "../src/lib/access/entity-grants.ts";
import { orderPrinterVisibleToStation } from "../src/lib/pos/location-devices.ts";
import { resolveOrderPrinters } from "../src/lib/pos/fire-routing.ts";
import type { LocationDevice } from "../src/lib/pos/location-devices.ts";

const BAR = "ent_bar";
const FOOD = "ent_food";

function station(id: string, operatorId: string, orderPrinterIds?: string[]): LocationDevice {
  return {
    id,
    locationId: "loc",
    label: id,
    type: "tablet_pos",
    status: "online",
    lastSeenAt: 1,
    assignment: { operatorId, function: "floor_pos" },
    orderPrinterIds,
  };
}

function printer(
  id: string,
  dest: string,
  operatorId: string,
): LocationDevice {
  const bar = dest.toLowerCase() === "bar";
  return {
    id,
    locationId: "loc",
    label: id,
    type: "order_printer",
    status: "online",
    lastSeenAt: 1,
    assignment: { operatorId, function: bar ? "bar_kds" : "kitchen_kds" },
    print: {
      family: "star",
      connection: "lan",
      target: "10.0.0.20:9100",
      station: bar ? "bar" : "kitchen",
      destinationName: dest,
      ip: "10.0.0.20",
      port: 9100,
      routes: bar ? ["bar_tickets"] : ["kitchen_tickets"],
    },
  };
}

test("a bar station lists its own order printer and a shared one", () => {
  assert.equal(orderPrinterVisibleToStation(BAR, BAR), true);
  assert.equal(orderPrinterVisibleToStation(HOST_SCOPE, BAR), true);
  assert.equal(orderPrinterVisibleToStation(FOOD, BAR), false);
  assert.equal(orderPrinterVisibleToStation(BAR, HOST_SCOPE), false);
});

test("send uses only the order printers checked on the station", () => {
  const barPrinter = printer("prn_bar", "Bar", BAR);
  const kitchen = printer("prn_kitchen", "Kitchen", FOOD);
  const shared = printer("prn_shared", "Kitchen", HOST_SCOPE);
  const tablet = station("tab_bar", BAR, ["prn_bar"]);
  const devices = [tablet, barPrinter, kitchen, shared];

  const drinks = resolveOrderPrinters({
    devices,
    destinationName: "Bar",
    operatorId: BAR,
    stationDeviceId: tablet.id,
  });
  assert.deepEqual(drinks.map((d) => d.id), ["prn_bar"]);

  const food = resolveOrderPrinters({
    devices,
    destinationName: "Kitchen",
    operatorId: FOOD,
    stationDeviceId: tablet.id,
    printerId: kitchen.id,
  });
  assert.deepEqual(food.map((d) => d.id), []);

  const onlyShared = station("tab_shared", BAR, ["prn_shared"]);
  const sharedFood = resolveOrderPrinters({
    devices: [onlyShared, barPrinter, kitchen, shared],
    destinationName: "Kitchen",
    operatorId: HOST_SCOPE,
    stationDeviceId: onlyShared.id,
  });
  assert.deepEqual(sharedFood.map((d) => d.id), ["prn_shared"]);
});

test("a station that has not saved the list still follows the destination", () => {
  const kitchen = printer("prn_kitchen", "Kitchen", HOST_SCOPE);
  const tablet = station("tab_old", HOST_SCOPE);
  const hit = resolveOrderPrinters({
    devices: [tablet, kitchen],
    destinationName: "Kitchen",
    stationDeviceId: tablet.id,
  });
  assert.deepEqual(hit.map((d) => d.id), ["prn_kitchen"]);
});

test("an empty station list sends no order ticket", () => {
  const kitchen = printer("prn_kitchen", "Kitchen", HOST_SCOPE);
  const tablet = station("tab_none", HOST_SCOPE, []);
  const hit = resolveOrderPrinters({
    devices: [tablet, kitchen],
    destinationName: "Kitchen",
    stationDeviceId: tablet.id,
  });
  assert.deepEqual(hit, []);
});

test("the order printer form does not assign stations", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /Order printers this station sends to/);
  assert.match(ui, /data-station-order-printers/);
  assert.match(ui, /data-station-order-printer=/);
  assert.match(ui, /orderPrinterVisibleToStation/);
  assert.match(ui, /data-order-printer-station-note/);
  assert.doesNotMatch(ui, /Stations that send tickets here/);
  assert.match(ui, /Fallback receipt printer/);
  assert.match(ui, /Fallback stations if the section has none/);
  const guide = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(guide, /Order printers this station sends to/);
  assert.match(guide, /Stations are not assigned on this form/);
});
