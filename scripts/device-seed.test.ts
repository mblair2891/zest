import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  catalogSlotWasDeleted,
  mergeDemoDeviceCatalog,
  rememberDeletedDevice,
  RESTORE_DEMO_DEVICES_COPY,
} from "../src/lib/pos/device-seed.ts";
import type { LocationDevice } from "../src/lib/pos/location-devices.ts";

function slot(id: string, label: string): LocationDevice {
  return {
    id,
    locationId: "loc_summit_hall",
    label,
    type: "order_printer",
    status: "pending",
    lastSeenAt: 1,
    assignment: { operatorId: "host", function: "kitchen_kds" },
  };
}

const catalog = [
  slot("dev_summit_host", "Host stand"),
  slot("dev_summit_prn_kitchen", "Kitchen printer"),
];

test("first seed applies catalog; later boots keep operator list", () => {
  const first = mergeDemoDeviceCatalog({ catalog, locationExists: false });
  assert.equal(first.devices.length, 2);
  assert.equal(first.devicesSeeded, true);

  const afterDelete = mergeDemoDeviceCatalog({
    catalog,
    existing: [catalog[0]!],
    deleted: rememberDeletedDevice([], catalog[1]!),
    locationExists: true,
  });
  assert.equal(afterDelete.devices.length, 1);
  assert.equal(afterDelete.devices[0]?.id, "dev_summit_host");
  assert.equal(
    catalogSlotWasDeleted(afterDelete.deleted, catalog[1]!),
    true,
  );
});

test("existing empty location with tombstones does not reseed catalog", () => {
  const deleted = rememberDeletedDevice([], catalog[1]!);
  const next = mergeDemoDeviceCatalog({
    catalog,
    existing: [],
    deleted,
    locationExists: true,
  });
  assert.equal(next.devices.length, 0);
});

test("force reseed restores catalog and clears tombstones", () => {
  const next = mergeDemoDeviceCatalog({
    catalog,
    existing: [],
    deleted: rememberDeletedDevice([], catalog[1]!),
    locationExists: true,
    forceReseed: true,
  });
  assert.equal(next.devices.length, 2);
  assert.equal(next.deleted.length, 0);
});

test("seed, publish, and delete paths remember deleted ids", () => {
  const summit = readFileSync("src/lib/saas/summit-hall-seed.server.ts", "utf8");
  assert.match(summit, /mergeDemoDeviceCatalog/);
  assert.match(summit, /forceReseed/);
  assert.doesNotMatch(summit, /function mergeSummitDevices\(existing\?: LocationSetup\["locationDevices"\]\)/);
  const isolated = readFileSync("src/lib/demo/isolated-seed.server.ts", "utf8");
  assert.match(isolated, /mergeDemoDeviceCatalog/);
  assert.match(isolated, /forceReseedIsolatedDemoDevices/);
  const api = readFileSync("src/lib/access/api.ts", "utf8");
  assert.match(api, /rememberDeletedDevice/);
  const ui = readFileSync("src/components/platform/SettingsWorkspace.tsx", "utf8");
  assert.match(ui, /RESTORE_DEMO_DEVICES_COPY/);
  assert.match(ui, /reseedDemoDevicesFn/);
  assert.equal(RESTORE_DEMO_DEVICES_COPY, "This restores demo stations and printers.");
  const onboard = readFileSync("src/lib/saas/onboarding.server.ts", "utf8");
  assert.doesNotMatch(onboard, /defaultOnboardingPrinters/);
});
