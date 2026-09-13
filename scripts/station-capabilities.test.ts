import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  pinFitsDevice,
  stationCan,
  stationWorkActions,
} from "../src/lib/pos/station-pin-gate.ts";
import { stationHomeSurface, viewForStationHome } from "../src/lib/pos/station-home.ts";
import type { DeviceRole } from "../src/lib/pos/device-roles.ts";
import type { EmployeeRole } from "../src/lib/pos/types.ts";

/** Isolated demo seed PIN map (Summit Hall). Not a production feature. */
const SUMMIT_HALL_STAFF: { pin: string; role: EmployeeRole }[] = [
  { pin: "1111", role: "host" },
  { pin: "2222", role: "server" },
  { pin: "3333", role: "bartender" },
  { pin: "4444", role: "kitchen" },
  { pin: "5555", role: "busser" },
  { pin: "7777", role: "manager" },
  { pin: "9999", role: "owner" },
];

const DEVICES: DeviceRole[] = ["order", "host", "ods", "kiosk"];

const SETTINGS = {
  hostMayOpenBarTabs: false,
  serversAtHostStand: false,
  orderMayOpenBarTabs: true,
};

function cap(device: DeviceRole, role: EmployeeRole, settings = SETTINGS) {
  return { deviceRole: device, employeeRole: role, settings };
}

test("Summit Hall PIN × device matrix", () => {
  const seed = readFileSync("src/lib/saas/summit-hall.ts", "utf8");
  assert.match(seed, /pin: "1111"/);
  assert.match(seed, /role: "host"/);
  assert.match(seed, /pin: "2222"/);
  assert.match(seed, /role: "server"/);
  assert.match(seed, /pin: "4444"/);
  assert.match(seed, /role: "kitchen"/);
  const byPin = Object.fromEntries(SUMMIT_HALL_STAFF.map((s) => [s.pin, s]));
  const cases: Array<{
    pin: string;
    device: DeviceRole;
    fit: boolean;
    has: string[];
    not: string[];
    home?: string;
  }> = [
    { pin: "4444", device: "order", fit: false, has: [], not: ["togo", "bar_tab", "order_entry", "floor"] },
    { pin: "4444", device: "host", fit: false, has: [], not: ["togo", "bar_tab", "order_entry"] },
    { pin: "4444", device: "ods", fit: true, has: ["ods"], not: ["togo", "bar_tab", "order_entry", "pay"] },
    { pin: "1111", device: "host", fit: true, has: ["floor", "waitlist", "togo", "seat"], not: ["bar_tab", "ods"] },
    { pin: "1111", device: "order", fit: true, has: ["floor", "togo"], not: ["waitlist", "ods"] },
    { pin: "2222", device: "order", fit: true, has: ["floor", "togo", "order_entry"], not: ["waitlist", "ods"] },
    { pin: "2222", device: "host", fit: false, has: [], not: ["togo", "seat"] },
    { pin: "2222", device: "ods", fit: false, has: [], not: ["ods", "togo"] },
    { pin: "3333", device: "order", fit: true, has: ["floor", "bar_tab", "togo"], not: ["waitlist"] },
    { pin: "3333", device: "ods", fit: true, has: ["ods"], not: ["togo", "order_entry", "pay"] },
    { pin: "5555", device: "order", fit: true, has: ["floor", "bus_clean"], not: ["togo", "bar_tab", "order_entry"] },
    { pin: "5555", device: "ods", fit: false, has: [], not: ["ods"] },
    { pin: "7777", device: "ods", fit: true, has: ["ods"], not: ["order_entry", "togo", "pay"] },
    { pin: "9999", device: "ods", fit: true, has: ["ods"], not: ["order_entry", "togo"] },
    { pin: "7777", device: "order", fit: true, has: ["floor", "togo"], not: ["waitlist"] },
    { pin: "9999", device: "host", fit: true, has: ["floor", "waitlist", "togo"], not: ["ods"] },
  ];

  for (const row of cases) {
    const staff = byPin[row.pin];
    assert.ok(staff, `seeded PIN ${row.pin}`);
    const opts = cap(row.device, staff.role);
    const fit = pinFitsDevice(opts);
    assert.equal(fit.ok, row.fit, `${row.pin} on ${row.device} fit`);
    for (const a of row.has) {
      assert.equal(stationCan(opts, a as never), true, `${row.pin} on ${row.device} can ${a}`);
    }
    for (const a of row.not) {
      assert.equal(stationCan(opts, a as never), false, `${row.pin} on ${row.device} cannot ${a}`);
    }
  }

  assert.equal(
    viewForStationHome(
      stationHomeSurface({
        deviceRole: "order",
        employeeRole: "server",
        serviceStyle: "full_service",
        hasFloor: true,
      }),
      "server",
    ),
    "floor",
  );
  assert.equal(
    viewForStationHome(
      stationHomeSurface({ deviceRole: "host", employeeRole: "host", serviceStyle: "full_service", hasFloor: true }),
      "host",
    ),
    "floor",
  );
  assert.equal(
    viewForStationHome(stationHomeSurface({ deviceRole: "ods", employeeRole: "kitchen" }), "kitchen"),
    "kitchen",
  );
});

test("server on host stand only when venue setting is on", () => {
  const off = cap("host", "server", SETTINGS);
  assert.equal(pinFitsDevice(off).ok, false);
  const on = cap("host", "server", { ...SETTINGS, serversAtHostStand: true });
  assert.equal(pinFitsDevice(on).ok, true);
  assert.equal(stationCan(on, "seat"), true);
  assert.equal(stationCan(on, "togo"), true);
  assert.equal(stationCan(on, "bar_tab"), false);
});

test("bar tabs: host setting off, order setting can turn off", () => {
  assert.equal(stationCan(cap("host", "host", SETTINGS), "bar_tab"), false);
  assert.equal(
    stationCan(cap("host", "host", { ...SETTINGS, hostMayOpenBarTabs: true }), "bar_tab"),
    true,
  );
  assert.equal(stationCan(cap("order", "bartender", SETTINGS), "bar_tab"), true);
  assert.equal(
    stationCan(cap("order", "bartender", { ...SETTINGS, orderMayOpenBarTabs: false }), "bar_tab"),
    false,
  );
});

test("manager on ODS is the rail, not order entry", () => {
  const opts = cap("ods", "owner");
  assert.deepEqual(stationWorkActions(opts).sort(), ["ods"]);
  assert.equal(stationCan(opts, "order_entry"), false);
});

test("every seeded PIN is classified on every device role", () => {
  for (const staff of SUMMIT_HALL_STAFF) {
    for (const device of DEVICES) {
      const fit = pinFitsDevice(cap(device, staff.role));
      assert.equal(typeof fit.ok, "boolean", `${staff.pin} ${device}`);
      if (!fit.ok && staff.role === "kitchen" && device !== "ods") {
        assert.match(fit.hint, /kitchen display|to-go/i);
      }
    }
  }
});

test("guide Stations and PINs describes the intersection", () => {
  const devices = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(devices, /Stations and PINs/);
  assert.match(devices, /intersection/i);
  assert.match(devices, /Bar tabs on order devices/);
  assert.match(devices, /Servers may use the host stand/);
});
