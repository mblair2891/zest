import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canDeleteVenueDevice } from "../src/lib/saas/tenant-users.ts";

test("location owner / manager / Admin can delete; floor and entity cannot", () => {
  assert.equal(canDeleteVenueDevice({ membershipRole: "owner" }), true);
  assert.equal(canDeleteVenueDevice({ membershipRole: "manager" }), true);
  assert.equal(canDeleteVenueDevice({ membershipRole: "owner", operatorId: "host" }), true);
  assert.equal(canDeleteVenueDevice({ isPlatformAdmin: true }), true);
  assert.equal(canDeleteVenueDevice({ membershipRole: "owner", operatorId: "op_bar" }), false);
  assert.equal(canDeleteVenueDevice({ membershipRole: "vendor" }), false);
  assert.equal(canDeleteVenueDevice({ membershipRole: "server" }), false);
  assert.equal(canDeleteVenueDevice({ membershipRole: "kitchen" }), false);
  assert.equal(canDeleteVenueDevice({ membershipRole: "bartender" }), false);
});

test("Delete removes the row; Deactivate / Unpair / Replace keep the slot", () => {
  const api = readFileSync("src/lib/access/api.ts", "utf8");
  const del = api.slice(api.indexOf("export const deleteLocationDeviceFn"));
  const delBody = del.slice(0, del.indexOf("export const rotateDevicePairFn"));
  assert.match(delBody, /delete from location_devices/);
  assert.match(delBody, /assertVenueDeviceAdmin/);
  assert.match(delBody, /prev\.filter\(\(d\) => d\.id !== data\.deviceId\)/);
  assert.doesNotMatch(delBody, /status = \$\{"inactive"\}/);

  const deact = api.slice(api.indexOf("export const deactivateLocationDeviceFn"));
  const deactBody = deact.slice(0, deact.indexOf("export const claimLocationDeviceFn"));
  assert.match(deactBody, /update location_devices/);
  assert.doesNotMatch(deactBody, /delete from location_devices/);

  const unpair = api.slice(api.indexOf("export const unpairLocationDeviceFn"));
  const unpairBody = unpair.slice(0, unpair.indexOf("export const deleteLocationDeviceFn"));
  assert.match(unpairBody, /update location_devices/);
  assert.match(unpairBody, /claim_code = \$\{null\}/);
  assert.doesNotMatch(unpairBody, /delete from location_devices/);

  const rotate = api.slice(api.indexOf("export const rotateDevicePairFn"));
  const rotateBody = rotate.slice(0, rotate.indexOf("export const heartbeatLocationDeviceFn"));
  assert.match(rotateBody, /status = \$\{"pending"\}/);
  assert.doesNotMatch(rotateBody, /delete from location_devices/);
});

test("deactivate, unpair, replace, and delete revoke and kick", () => {
  const api = readFileSync("src/lib/access/api.ts", "utf8");
  const deact = api.slice(api.indexOf("export const deactivateLocationDeviceFn"));
  const deactBody = deact.slice(0, deact.indexOf("export const claimLocationDeviceFn"));
  assert.match(deactBody, /claim_code = \$\{null\}/);
  assert.match(deactBody, /mintClaim/);
  assert.match(deactBody, /status = \$\{"pending"\}/);

  const pub = api.slice(api.indexOf("export const getStationPublishFn"));
  const pubBody = pub.slice(0, pub.indexOf("export const publishLocationFn"));
  assert.match(pubBody, /readStationPairState/);
  assert.match(pubBody, /revoked: true/);

  const pair = api.slice(api.indexOf("export const getPairedStationFn"));
  const pairBody = pair.slice(0, pair.indexOf("export const getStationStateFn"));
  assert.match(pairBody, /This tablet is not paired/);
  assert.match(pairBody, /status !== "online"/);

  const watch = readFileSync("src/components/pos/StationPublishWatcher.tsx", "utf8");
  assert.match(watch, /getStationStateFn/);
  assert.match(watch, /5_000/);
  assert.match(watch, /kickStationToPair/);

  const state = readFileSync("src/lib/pos/station-state.server.ts", "utf8");
  assert.match(state, /readStationPairState/);
  assert.match(state, /reason: "deactivated"/);
});

test("Devices UI: Deactivate stays; Delete confirms then removes", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /Deactivate/);
  assert.match(ui, /deleteLocationDeviceFn/);
  assert.match(ui, /canDeleteDevice/);
  assert.match(ui, /Delete this device\. The tablet must scan a new code\./);
  assert.match(ui, /kickStationToPair/);
  assert.doesNotMatch(ui, /window\.confirm\([^)]*Delete this device/);
});

test("online tablet ejects to pair-code after revoke", () => {
  const pair = readFileSync("src/lib/pos/station-pair.ts", "utf8");
  assert.match(pair, /export function ejectDeletedStationPair/);
  assert.match(pair, /idbClearLocation/);
  const kick = readFileSync("src/lib/pos/station-kick.ts", "utf8");
  assert.match(kick, /kickStationToPair/);
  assert.match(kick, /window\.location\.replace\("\/station"\)/);
  const app = readFileSync("src/components/pos/PosApp.tsx", "utf8");
  const boot = app.slice(app.indexOf(".catch(async (e)"));
  assert.match(boot, /kickStationToPair/);
  assert.match(boot, /not paired/i);
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /kickIfThisStation/);
});

test("guide Devices covers Delete vs Deactivate vs Unpair", () => {
  const devices = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(devices, /Delete this device\. The tablet must scan a new code\./);
  assert.match(devices, /Deactivate keeps the named slot/);
  assert.match(devices, /Floor PINs cannot delete/);
  assert.match(devices, /Add device can reuse the same name and role/);
});
