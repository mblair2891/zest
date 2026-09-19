import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  stationCriticalBusy,
  setStationPayOpen,
  setStationPrintInFlight,
  setStationSending,
} from "../src/lib/pos/station-busy.ts";
import {
  UPDATE_READY_BANNER,
  IDLE_MS,
  decideStationRefresh,
} from "../src/lib/pos/station-refresh.ts";

test("heartbeat returns appBuild and configVersion", () => {
  const api = readFileSync("src/lib/access/api.ts", "utf8");
  assert.match(api, /appBuild/);
  assert.match(api, /configVersion/);
  assert.match(api, /VERCEL_DEPLOYMENT_ID/);
  assert.match(api, /sinceConfig/);
  assert.match(api, /publishSetupSlice/);
});

test("busy flags block reload during pay, print, send", () => {
  setStationPayOpen(false);
  setStationPrintInFlight(false);
  setStationSending(false);
  assert.equal(stationCriticalBusy(), false);
  setStationPayOpen(true);
  assert.equal(stationCriticalBusy(), true);
  setStationPayOpen(false);
  setStationPrintInFlight(true);
  assert.equal(stationCriticalBusy(), true);
  setStationPrintInFlight(false);
  setStationSending(true);
  assert.equal(stationCriticalBusy(), true);
  setStationSending(false);
  assert.equal(stationCriticalBusy(), false);
});

test("idle PIN reloads immediately after 3s; Pay open waits", () => {
  assert.equal(
    decideStationRefresh({
      pending: "shell",
      criticalBusy: false,
      busy: false,
      idleSurface: true,
      idleMs: IDLE_MS,
    }),
    "reload",
  );
  assert.equal(
    decideStationRefresh({
      pending: "config",
      criticalBusy: false,
      busy: false,
      idleSurface: true,
      idleMs: IDLE_MS,
    }),
    "apply-config",
  );
  assert.equal(
    decideStationRefresh({
      pending: "shell",
      criticalBusy: true,
      busy: true,
      idleSurface: false,
      idleMs: 0,
    }),
    "banner",
  );
  assert.equal(
    decideStationRefresh({
      pending: "shell",
      criticalBusy: false,
      busy: true,
      idleSurface: false,
      idleMs: 0,
      forceWhenSafe: true,
    }),
    "reload",
  );
  assert.equal(
    decideStationRefresh({
      pending: "shell",
      criticalBusy: false,
      busy: false,
      idleSurface: true,
      idleMs: 500,
    }),
    "wait-idle",
  );
});

test("update-ready banner copy and idle apply are wired", () => {
  assert.equal(UPDATE_READY_BANNER, "Update ready — will apply when you close this check");
  const banner = readFileSync("src/components/pos/TrainingBanner.tsx", "utf8");
  assert.match(banner, /data-station-update-ready/);
  assert.match(banner, /UPDATE_READY_BANNER/);
  const watch = readFileSync("src/components/pos/StationPublishWatcher.tsx", "utf8");
  assert.match(watch, /ingestHeartbeat/);
  assert.match(watch, /tryApplyStationRefresh/);
  assert.match(watch, /IDLE_TICK_MS/);
  const print = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(print, /setStationPrintInFlight\(true\)/);
  const persist = readFileSync("src/lib/pos/persist-location-setup.ts", "utf8");
  assert.match(persist, /bumpConfigVersion/);
  const guide = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(guide, /appBuild/);
  assert.match(guide, /configVersion/);
  assert.match(guide, /Do not force-stop, unpair, or install a new APK/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.127/);
});
