import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseStationServiceStyle,
  resolveStationServiceStyle,
  stationHomeSurface,
  viewForStationHome,
} from "../src/lib/pos/station-home.ts";


test("service style parse", () => {
  assert.equal(parseStationServiceStyle("full_service"), "full_service");
  assert.equal(parseStationServiceStyle("counter"), "counter");
  assert.equal(parseStationServiceStyle("hybrid"), "hybrid");
  assert.equal(parseStationServiceStyle("drive-through"), "drive_through");
  assert.equal(parseStationServiceStyle(""), null);
});

test("full-service and hybrid with a floor open the map on an order station", () => {
  assert.equal(
    stationHomeSurface({
      deviceRole: "order",
      serviceStyle: "full_service",
      hasFloor: true,
    }),
    "floor",
  );
  assert.equal(
    stationHomeSurface({
      deviceRole: "order",
      serviceStyle: "hybrid",
      hasFloor: true,
    }),
    "floor",
  );
  assert.equal(
    viewForStationHome("floor", "server"),
    "floor",
  );
});

test("counter order station is ticket/queue — never a dining floor", () => {
  assert.equal(
    stationHomeSurface({
      deviceRole: "order",
      serviceStyle: "counter",
      hasFloor: false,
    }),
    "queue",
  );
  assert.equal(
    stationHomeSurface({
      deviceRole: "order",
      serviceStyle: "counter",
      hasFloor: true,
    }),
    "queue",
  );
});

test("drive-through is lane/window, not a dining floor", () => {
  assert.equal(
    stationHomeSurface({
      deviceRole: "order",
      serviceStyle: "drive_through",
      hasFloor: false,
    }),
    "drive_through",
  );
  assert.equal(
    stationHomeSurface({
      deviceRole: "host",
      serviceStyle: "drive_through",
      hasFloor: false,
    }),
    "drive_through",
  );
});

test("hosted pad order glass is the lot map; ODS stays tickets", () => {
  assert.equal(
    stationHomeSurface({
      deviceRole: "order",
      operatingModel: "host_operators",
      hasFloor: true,
    }),
    "floor",
  );
  assert.equal(
    stationHomeSurface({
      deviceRole: "ods",
      operatingModel: "host_operators",
      employeeRole: "kitchen",
      hasFloor: true,
    }),
    "ods",
  );
  assert.equal(viewForStationHome("ods", "bartender"), "bar");
  assert.equal(viewForStationHome("ods", "kitchen"), "kitchen");
});

test("host is floor + waitlist; kiosk is guest UI", () => {
  assert.equal(
    stationHomeSurface({ deviceRole: "host", serviceStyle: "full_service", hasFloor: true }),
    "host",
  );
  assert.equal(stationHomeSurface({ deviceRole: "kiosk" }), "kiosk");
});

test("cashier on a full-service order tablet is the queue, not the dining floor", () => {
  assert.equal(
    stationHomeSurface({
      deviceRole: "order",
      employeeRole: "cashier",
      serviceStyle: "full_service",
      hasFloor: true,
    }),
    "queue",
  );
  assert.equal(
    stationHomeSurface({
      deviceRole: "order",
      employeeRole: "server",
      serviceStyle: "full_service",
      hasFloor: true,
    }),
    "floor",
  );
});

test("missing style infers floor when tables exist, else counter", () => {
  assert.equal(
    resolveStationServiceStyle({ hasFloor: true }),
    "full_service",
  );
  assert.equal(
    resolveStationServiceStyle({ hasFloor: false }),
    "counter",
  );
});

test("bar tab is only when the house has a rail", () => {
  const bar = readFileSync("src/lib/pos/bar-tab.ts", "utf8");
  assert.match(bar, /export function locationAllowsBarTabs/);
  assert.match(bar, /isBarRailSeat/);
  assert.match(bar, /barstool/);
});

test("paired order glass is not a hard-coded To-go | Bar tab POS", () => {
  const mode = readFileSync("src/components/pos/DeviceModeView.tsx", "utf8");
  assert.match(mode, /stationHomeSurface/);
  assert.match(mode, /pinFitsDevice/);
  assert.match(mode, /StationClockGate/);
  assert.match(mode, /HostStationView/);
  assert.match(mode, /DriveThroughView/);
  assert.doesNotMatch(
    mode.replace(/\s+/g, " "),
    /if \(role === "host"\) \{\s*return <HostStationView \/>;\s*\}\s*return <OrderView \/>/,
  );
  const order = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  assert.match(order, /station-home-queue/);
  assert.match(order, /homeSurface === "floor"/);
  const pair = readFileSync("src/components/pos/StationPairScreen.tsx", "utf8");
  assert.match(pair, /placeholder="K7VY5R"/);
  assert.doesNotMatch(pair, /To-go order/);
  assert.doesNotMatch(pair, /Bar tab/);
});
