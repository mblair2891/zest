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
  UPDATE_READY_TITLE,
  UPDATE_REQUIRED_TITLE,
  UPDATE_NOW_LABEL,
  REMIND_LATER_LABEL,
  FINISH_CHECK_TOAST,
  SNOOZE_MS,
  MAX_SNOOZES,
  FORCE_IDLE_MS,
  decideStationPrompt,
} from "../src/lib/pos/station-refresh.ts";
import {
  DEFAULT_FORCE_WINDOW,
  FORCE_WINDOW_DURATION_MIN,
  inForceUpdateWindow,
  parseStationUpdates,
  stationFacingChangeBullets,
} from "../src/lib/pos/station-updates.ts";

test("heartbeat returns appBuild and configVersion", () => {
  const api = readFileSync("src/lib/access/api.ts", "utf8");
  assert.match(api, /appBuild/);
  assert.match(api, /configVersion/);
  assert.match(api, /stationUpdates/);
  assert.match(api, /VERCEL_DEPLOYMENT_ID/);
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

test("04:00 venue window: afternoon may snooze; 04:15 is forced", () => {
  assert.equal(DEFAULT_FORCE_WINDOW, "04:00");
  assert.equal(FORCE_WINDOW_DURATION_MIN, 60);
  const tz = "America/Los_Angeles";
  const at0415 = Date.parse("2026-09-20T11:15:00.000Z");
  const at1400 = Date.parse("2026-09-20T21:00:00.000Z");
  const at0500 = Date.parse("2026-09-20T12:00:00.000Z");
  assert.equal(
    inForceUpdateWindow({ atMs: at0415, timeZone: tz, windows: ["04:00"] }),
    true,
  );
  assert.equal(
    inForceUpdateWindow({ atMs: at1400, timeZone: tz, windows: ["04:00"] }),
    false,
  );
  assert.equal(
    inForceUpdateWindow({ atMs: at0500, timeZone: tz, windows: ["04:00"] }),
    false,
  );
  assert.equal(
    inForceUpdateWindow({ atMs: at1400, timeZone: tz, windows: ["04:00", "14:00"] }),
    true,
  );
  const parsed = parseStationUpdates(undefined);
  assert.equal(parsed.forceWindow1, "04:00");
  assert.equal(parsed.showChangeList, true);
});

test("forced prompt has no snooze; optional afternoon still snoozes", () => {
  assert.equal(
    decideStationPrompt({
      pending: "shell",
      snoozed: true,
      snoozeCount: 2,
      criticalBusy: false,
      isManager: false,
      forced: true,
    }),
    "forced",
  );
  assert.equal(
    decideStationPrompt({
      pending: "shell",
      snoozed: true,
      snoozeCount: 1,
      criticalBusy: false,
      isManager: false,
      forced: false,
    }),
    "hidden",
  );
  assert.equal(FORCE_IDLE_MS, 60_000);
});

test("change list is station-facing only; empty when off", () => {
  assert.deepEqual(stationFacingChangeBullets({ show: false }), []);
  const bullets = stationFacingChangeBullets({ show: true, limit: 3 });
  assert.ok(bullets.length > 0);
  const blob = bullets.join(" ").toLowerCase();
  assert.equal(/saas|pipeline|crm/.test(blob), false);
});

test("update prompt copy is wired; never reload without a tap outside force window", () => {
  assert.equal(UPDATE_READY_TITLE, "A system update is ready.");
  assert.equal(UPDATE_REQUIRED_TITLE, "Update required");
  assert.equal(UPDATE_NOW_LABEL, "Update now");
  assert.equal(REMIND_LATER_LABEL, "Remind me later");
  assert.equal(FINISH_CHECK_TOAST, "Finish this check first");
  assert.equal(SNOOZE_MS, 10 * 60 * 1000);
  assert.equal(MAX_SNOOZES, 3);
  const prompt = readFileSync("src/components/pos/StationUpdatePrompt.tsx", "utf8");
  assert.match(prompt, /data-station-update-modal/);
  assert.match(prompt, /data-station-update-now/);
  assert.match(prompt, /data-station-remind-later/);
  assert.match(prompt, /data-station-change-list/);
  assert.match(prompt, /UPDATE_REQUIRED_TITLE/);
  const settings = readFileSync("src/components/pos/SettingsView.tsx", "utf8");
  assert.match(settings, /data-station-updates-settings/);
  assert.match(settings, /Show change list on update prompt/);
  const refresh = readFileSync("src/lib/pos/station-refresh.ts", "utf8");
  assert.match(refresh, /never reload without a tap/);
  assert.match(refresh, /FORCE_IDLE_MS/);
  const guide = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(guide, /Update required/);
  assert.match(guide, /force-update window/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.129/);
});
