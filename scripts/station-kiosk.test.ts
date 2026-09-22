import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hashPin } from "../src/lib/pos/pin.ts";
import {
  employeeCanStationService,
  pinUnlocksStationService,
  STATION_RELOAD_HOLD_MS,
} from "../src/lib/pos/station-kiosk.ts";
import type { Employee } from "../src/lib/pos/types.ts";

function emp(role: Employee["role"], pin: string, loc = "loc_1"): Employee {
  return {
    id: `emp_${role}`,
    name: role,
    pin,
    pinHash: hashPin(pin, loc),
    role,
    color: "#000",
    clockedIn: false,
    tipsEarned: 0,
    salesTotal: 0,
    active: true,
    homeSectionIds: [],
  };
}

test("reload hold is two seconds", () => {
  assert.equal(STATION_RELOAD_HOLD_MS, 2000);
});

test("only owner, manager, and supervisor PINs are station-service by role", () => {
  assert.equal(employeeCanStationService("owner"), true);
  assert.equal(employeeCanStationService("manager"), true);
  assert.equal(employeeCanStationService("supervisor"), true);
  assert.equal(employeeCanStationService("server"), false);
  assert.equal(employeeCanStationService("kitchen"), false);
  assert.equal(employeeCanStationService("host"), false);
});

test("Devices service PIN and manager PIN unlock station service; staff PIN does not", () => {
  const loc = "loc_hall";
  const staff = [emp("server", "2222", loc), emp("manager", "9999", loc)];
  const serviceHash = hashPin("1212", loc);
  assert.equal(
    pinUnlocksStationService({
      pin: "1212",
      locationId: loc,
      employees: staff,
      stationServicePinHash: serviceHash,
    }),
    true,
  );
  assert.equal(
    pinUnlocksStationService({
      pin: "9999",
      locationId: loc,
      employees: staff,
    }),
    true,
  );
  assert.equal(
    pinUnlocksStationService({
      pin: "0000",
      locationId: loc,
      employees: staff,
      managerPin: "0000",
    }),
    true,
  );
  assert.equal(
    pinUnlocksStationService({
      pin: "2222",
      locationId: loc,
      employees: staff,
      stationServicePinHash: serviceHash,
    }),
    false,
  );
});

test("native shell reloads station URL and can exit lock-task", () => {
  const main = readFileSync("android/app/src/main/java/app/summex/pos/MainActivity.java", "utf8");
  assert.match(main, /reloadStation/);
  assert.match(main, /exitKiosk/);
  assert.match(main, /StationKioskPlugin/);
  const plugin = readFileSync("android/app/src/main/java/app/summex/pos/StationKioskPlugin.java", "utf8");
  assert.match(plugin, /StationKiosk/);
  assert.match(plugin, /exitKioskLock/);
  assert.match(main, /stopLockTask/);
  assert.match(main, /CATEGORY_HOME/);
  assert.match(main, /loadUrl\(url\)/);
  assert.match(main, /contains\("\/login"\)/);
  const client = readFileSync(
    "android/app/src/main/java/app/summex/pos/KioskWebViewClient.java",
    "utf8",
  );
  assert.match(client, /isLoginEscape/);
  assert.match(client, /\/login/);
  assert.match(client, /reloadStation/);
  const ui = readFileSync("src/components/pos/StationKioskControls.tsx", "utf8");
  assert.match(ui, /STATION_RELOAD_HOLD_MS/);
  assert.match(ui, /Exit kiosk/);
  assert.match(ui, /data-exit-kiosk/);
  assert.match(ui, /needPin\("exit"\)/);
  assert.match(ui, /Staff PINs cannot/);
  assert.match(readFileSync("src/lib/native-kiosk.ts", "utf8"), /StationKiosk/);
  const devices = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(devices, /station-service-pin/);
  const guide = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(guide, /Website updates/);
  assert.match(guide, /APK updates/);
  assert.match(guide, /unpin/);
});
