import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STATION_PIN_DEACTIVATED,
  STATION_PIN_INVALID,
  STATION_PIN_UNPAIRED,
  STATION_PIN_WRONG_VENUE,
  stationPinAuthLocationId,
} from "../src/lib/pos/station-pin-auth.ts";

test("PIN hash is the paired location id, never a venue-type slug", () => {
  assert.equal(
    stationPinAuthLocationId({
      pairLocationId: "loc_summit_hall",
      tenantLocationId: "food_hall",
      activeEntityId: "food_hall",
    }),
    "loc_summit_hall",
  );
  assert.equal(
    stationPinAuthLocationId({ tenantLocationId: "loc_summit_hall", activeEntityId: "food_hall" }),
    "loc_summit_hall",
  );
  assert.equal(
    stationPinAuthLocationId({ tenantLocationId: "food_hall", activeEntityId: "food_hall" }),
    "food_hall",
  );
});

test("errors for unpaired, wrong venue, and invalid PIN are distinct", () => {
  assert.notEqual(STATION_PIN_UNPAIRED, STATION_PIN_INVALID);
  assert.notEqual(STATION_PIN_WRONG_VENUE, STATION_PIN_INVALID);
  assert.notEqual(STATION_PIN_DEACTIVATED, STATION_PIN_INVALID);
  assert.match(STATION_PIN_UNPAIRED, /not paired/i);
  assert.match(STATION_PIN_WRONG_VENUE, /different venue/i);
  assert.match(STATION_PIN_DEACTIVATED, /deactivated/i);
  assert.match(STATION_PIN_DEACTIVATED, /enter a new code/i);
  assert.doesNotMatch(STATION_PIN_DEACTIVATED, /invalid pin/i);
});

test("paired station verifies PIN live against full venue staff", () => {
  const home = readFileSync("src/components/pos/EntityHome.tsx", "utf8");
  assert.match(home, /verifyStationPinFn/);
  assert.match(home, /readStationPair/);
  assert.match(home, /STATION_PIN_UNPAIRED/);
  assert.doesNotMatch(home, /demoOperatingEntityId/);
  const app = readFileSync("src/components/pos/PosApp.tsx", "utf8");
  const boot = app.slice(app.indexOf("const fetchBoot"));
  const pairIdx = boot.indexOf("getPairedStationFn");
  const userIdx = boot.indexOf("if (user)");
  assert.ok(pairIdx >= 0 && (userIdx < 0 || pairIdx < userIdx));
  const api = readFileSync("src/lib/access/api.ts", "utf8");
  assert.match(api, /verifyStationPinFn/);
  assert.match(api, /role: "station"/);
  const server = readFileSync("src/lib/pos/station-pin-auth.server.ts", "utf8");
  assert.match(server, /pin_display = \$\{pin\}/);
  assert.match(server, /STATION_PIN_DEACTIVATED/);
  assert.match(server, /status !== "online"/);
  assert.doesNotMatch(server, /operator_id =/);
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(store, /stationPinAuthLocationId/);
  assert.match(store, /findStaffByPin\(get\(\)\.employees, pin, loc, null\)/);
  const login = store.slice(store.indexOf("login: (pin)"));
  const loginBody = login.slice(0, login.indexOf("applyVerifiedStationPin"));
  assert.doesNotMatch(loginBody, /activeEntityId/);
  assert.doesNotMatch(loginBody, /demoOperatingEntityId/);
});
