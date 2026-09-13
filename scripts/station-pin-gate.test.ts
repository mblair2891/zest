import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pinFitsDevice } from "../src/lib/pos/station-pin-gate.ts";
import { viewForDevicePin, parsePinRole } from "../src/lib/access/pin-role.ts";

test("device role owns home: kitchen PIN on order/host is clock, not POS", () => {
  assert.equal(pinFitsDevice({ deviceRole: "ods", employeeRole: "kitchen" }).ok, true);
  const order = pinFitsDevice({ deviceRole: "order", employeeRole: "kitchen" });
  assert.equal(order.ok, false);
  if (!order.ok) {
    assert.match(order.hint, /kitchen display/i);
    assert.match(order.hint, /to-go/i);
  }
  const host = pinFitsDevice({ deviceRole: "host", employeeRole: "kitchen" });
  assert.equal(host.ok, false);
  assert.equal(viewForDevicePin("order", "kitchen"), "labor");
  assert.equal(viewForDevicePin("host", "kitchen"), "labor");
  assert.equal(viewForDevicePin("ods", "kitchen"), "kitchen");
});

test("Summit Hall PIN map: 2222 server on order is floor; 4444 kitchen is not", () => {
  assert.equal(pinFitsDevice({ deviceRole: "order", employeeRole: "server" }).ok, true);
  assert.equal(pinFitsDevice({ deviceRole: "order", employeeRole: "kitchen" }).ok, false);
  assert.equal(viewForDevicePin("order", "server"), "order");
  assert.equal(viewForDevicePin("order", "kitchen"), "labor");
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(store, /pinFitsDevice/);
  assert.match(store, /view = "labor"/);
});

test("server / bartender / cashier use order or host; bartender also ODS", () => {
  assert.equal(pinFitsDevice({ deviceRole: "order", employeeRole: "server" }).ok, true);
  assert.equal(pinFitsDevice({ deviceRole: "host", employeeRole: "server" }).ok, false);
  assert.equal(
    pinFitsDevice({ deviceRole: "host", employeeRole: "server", serversAtHostStand: true }).ok,
    true,
  );
  const denied = pinFitsDevice({ deviceRole: "host", employeeRole: "server" });
  if (!denied.ok) assert.match(denied.hint, /order tablet/i);
  assert.equal(pinFitsDevice({ deviceRole: "ods", employeeRole: "server" }).ok, false);
  assert.equal(pinFitsDevice({ deviceRole: "order", employeeRole: "cashier" }).ok, true);
  assert.equal(pinFitsDevice({ deviceRole: "ods", employeeRole: "cashier" }).ok, false);
  assert.equal(pinFitsDevice({ deviceRole: "order", employeeRole: "bartender" }).ok, true);
  assert.equal(pinFitsDevice({ deviceRole: "ods", employeeRole: "bartender" }).ok, true);
  assert.equal(viewForDevicePin("ods", "bartender"), "bar");
});

test("host / supervisor / manager may use host or order; manager does not switch device from a kitchen PIN", () => {
  assert.equal(pinFitsDevice({ deviceRole: "host", employeeRole: "host" }).ok, true);
  assert.equal(pinFitsDevice({ deviceRole: "order", employeeRole: "host" }).ok, true);
  assert.equal(pinFitsDevice({ deviceRole: "ods", employeeRole: "host" }).ok, false);
  assert.equal(pinFitsDevice({ deviceRole: "order", employeeRole: "supervisor" }).ok, true);
  assert.equal(pinFitsDevice({ deviceRole: "host", employeeRole: "manager" }).ok, true);
  assert.equal(pinFitsDevice({ deviceRole: "ods", employeeRole: "manager" }).ok, true);
  const change = readFileSync("src/lib/pos/station-access.ts", "utf8");
  assert.match(change, /canChangeDevice/);
  assert.match(change, /training/);
});

test("cook / expo aliases are kitchen PIN", () => {
  assert.equal(parsePinRole("cook"), "kitchen");
  assert.equal(parsePinRole("expo"), "kitchen");
});

test("clock punch never opens order entry", () => {
  const control = readFileSync("src/components/pos/StationClockControl.tsx", "utf8");
  assert.match(control, /punchStationClock/);
  assert.doesNotMatch(control, /setView/);
  const punch = readFileSync("src/lib/pos/station-clock.ts", "utf8");
  assert.match(punch, /punchStationClock/);
  assert.doesNotMatch(punch, /setView/);
  const gate = readFileSync("src/components/pos/StationClockGate.tsx", "utf8");
  assert.match(gate, /data-station-clock-gate/);
  assert.doesNotMatch(gate, /To-go/);
  assert.doesNotMatch(gate, /Bar tab/);
  assert.doesNotMatch(gate, /OrderView/);
  const modal = readFileSync("src/components/pos/ClockInAfterPinDialog.tsx", "utf8");
  assert.doesNotMatch(modal, /setView/);
  assert.match(modal, /does not open order entry/);
  const shell = readFileSync("src/components/pos/AppShell.tsx", "utf8");
  assert.match(shell, /StationClockControl/);
});

test("DeviceModeView gates before order glass", () => {
  const mode = readFileSync("src/components/pos/DeviceModeView.tsx", "utf8");
  assert.match(mode, /pinFitsDevice/);
  assert.match(mode, /StationClockGate/);
  const gateIdx = mode.indexOf("StationClockGate");
  const orderIdx = mode.indexOf("<OrderView");
  assert.ok(gateIdx > 0 && orderIdx > gateIdx);
});

test("operators guide: device role owns home, kitchen PIN is not server UI", () => {
  const devices = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(devices, /Stations and PINs/);
  assert.match(devices, /intersection/);
  assert.match(devices, /clock sheet/);
  const kitchen = readFileSync("src/lib/guide/content/roles.ts", "utf8");
  assert.match(kitchen, /clock sheet only/);
  assert.match(kitchen, /not the server UI/);
});

test("host stand: floor + waitlist home, persistent New to-go, bar tab not default", () => {
  const host = readFileSync("src/components/pos/HostStationView.tsx", "utf8");
  assert.match(host, /New to-go order/);
  assert.match(host, /data-host-new-togo/);
  assert.match(host, /stationCan/);
  assert.match(host, /openTakeout\("To-go"\)/);
  assert.doesNotMatch(
    host.replace(/\s+/g, " "),
    /hostStand && \(\s*<Button[^>]*To-go/,
  );
  const kitchenHost = pinFitsDevice({ deviceRole: "host", employeeRole: "kitchen" });
  assert.equal(kitchenHost.ok, false);
  if (!kitchenHost.ok) assert.match(kitchenHost.hint, /to-go/i);
  assert.equal(pinFitsDevice({ deviceRole: "host", employeeRole: "host" }).ok, true);
  assert.equal(pinFitsDevice({ deviceRole: "host", employeeRole: "supervisor" }).ok, true);
  assert.equal(pinFitsDevice({ deviceRole: "host", employeeRole: "manager" }).ok, true);
  const hostGuide = readFileSync("src/lib/guide/content/roles.ts", "utf8");
  assert.match(hostGuide, /New to-go order/);
  assert.match(hostGuide, /Host may open bar tabs/);
  assert.match(hostGuide, /Servers may use the host stand/);
  const floorGuide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(floorGuide, /not the only home/);
});
