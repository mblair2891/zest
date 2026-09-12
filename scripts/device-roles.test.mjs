import test from "node:test";
import assert from "node:assert/strict";

/** Mirrors src/lib/pos/device-roles.ts parseStationQuery */

const STATION_ALIASES = {
  order: "order",
  cashier: "order",
  bar_pos: "order",
  handheld: "order",
  ods: "ods",
  kitchen: "ods",
  bar: "ods",
  kds: "ods",
  expo: "ods",
  kitchen_kds: "ods",
  bar_kds: "ods",
  host: "host",
  floor: "host",
  waitlist: "host",
  host_stand: "host",
  busser: "host",
  kiosk: "kiosk",
};

function parseStationQuery(raw) {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATION_ALIASES[key] ?? null;
}

test("canonical station roles", () => {
  assert.equal(parseStationQuery("order"), "order");
  assert.equal(parseStationQuery("ods"), "ods");
  assert.equal(parseStationQuery("host"), "host");
  assert.equal(parseStationQuery("kiosk"), "kiosk");
});

test("native aliases map onto the three roles", () => {
  assert.equal(parseStationQuery("kitchen"), "ods");
  assert.equal(parseStationQuery("bar"), "ods");
  assert.equal(parseStationQuery("floor"), "host");
  assert.equal(parseStationQuery("cashier"), "order");
  assert.equal(parseStationQuery("waitlist"), "host");
});

test("unknown and empty are rejected", () => {
  assert.equal(parseStationQuery(""), null);
  assert.equal(parseStationQuery(null), null);
  assert.equal(parseStationQuery("login"), null);
  assert.equal(parseStationQuery("hq"), null);
});

function parseStationPath(pathname) {
  if (!pathname) return null;
  const m = pathname.trim().match(/^\/station\/([^/]+)\/?$/);
  return m ? parseStationQuery(m[1]) : null;
}

test("station path form /station/:role", () => {
  assert.equal(parseStationPath("/station/order"), "order");
  assert.equal(parseStationPath("/station/ods"), "ods");
  assert.equal(parseStationPath("/station/host"), "host");
  assert.equal(parseStationPath("/"), null);
});
