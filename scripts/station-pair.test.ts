import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAIR_TTL_MS,
  claimExpired,
  encodePairQuery,
  formatClaimExpiry,
  nextClaimExpiry,
  parsePairScan,
} from "../src/lib/pos/station-pair-payload.ts";

test("QR payload carries pair token, venue, and role — not marketing apex", () => {
  const path = encodePairQuery({ token: "ab-cd12", venue: "loc_hall", role: "ods" });
  assert.equal(path.startsWith("/station?"), true);
  assert.match(path, /pair=ABCD12/);
  assert.match(path, /loc=loc_hall/);
  assert.match(path, /station=ods/);
  assert.doesNotMatch(path, /summex\.app\/\?/);
  assert.doesNotMatch(path, /\/login/);
});

test("scan parser accepts URL, JSON, and bare code", () => {
  const url = parsePairScan("https://app.summex.app/station?pair=HOSTKO&loc=loc_1&station=host");
  assert.deepEqual(url, { token: "HOSTKO", venue: "loc_1", role: "host" });
  const json = parsePairScan(JSON.stringify({ v: 1, token: "ORD123", venue: "loc_2", role: "order" }));
  assert.deepEqual(json, { token: "ORD123", venue: "loc_2", role: "order" });
  assert.deepEqual(parsePairScan("kds9ab"), { token: "KDS9AB" });
  assert.equal(parsePairScan("https://www.summex.app/"), null);
  assert.equal(parsePairScan(""), null);
});

test("pair codes expire and can be regenerated", () => {
  const now = 1_700_000_000_000;
  assert.equal(claimExpired(now - 1, now), true);
  assert.equal(claimExpired(now + 60_000, now), false);
  assert.equal(claimExpired(undefined, now), false);
  assert.equal(nextClaimExpiry(now) - now, PAIR_TTL_MS);
  assert.match(formatClaimExpiry(now - 1, now), /Expired/);
  assert.match(formatClaimExpiry(now + 10 * 60_000, now), /min/);
});

test("pair screen and Play APK never require a baked station role", () => {
  const pairUi = readFileSync("src/components/pos/StationPairScreen.tsx", "utf8");
  assert.match(pairUi, /Scan QR/);
  assert.match(pairUi, /Enter code/);
  assert.doesNotMatch(pairUi, /\/login/);
  const cap = readFileSync("capacitor.config.ts", "utf8");
  assert.match(cap, /app\.summex\.pos/);
  assert.match(cap, /\/station/);
  assert.match(cap, /app\.summex\.app/);
  assert.doesNotMatch(cap, /summex\.app\/\?station/);
  const native = readFileSync("native/summex-native.json", "utf8");
  assert.match(native, /"sideload": false/);
  assert.match(native, /"station": ""/);
  assert.match(native, /app\.summex\.app/);
  const baked = readFileSync("android/app/src/main/assets/capacitor.config.json", "utf8");
  assert.match(baked, /app\.summex\.pos/);
  assert.match(baked, /app\.summex\.app\/station/);
  assert.doesNotMatch(baked, /station=floor/);
  assert.doesNotMatch(baked, /summex\.app\/\?/);
  const cfg = readFileSync("scripts/android-config.mjs", "utf8");
  assert.match(cfg, /Local debug only/);
});

test("station PIN pad does not send staff to marketing or /login", () => {
  const pin = readFileSync("src/components/pos/EntityHome.tsx", "utf8");
  assert.match(pin, /stationPad/);
  assert.match(pin, /Floor login · 4-digit PIN/);
});
