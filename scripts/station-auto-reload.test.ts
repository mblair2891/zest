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
  UPDATE_NOW_LABEL,
  REMIND_LATER_LABEL,
  FINISH_CHECK_TOAST,
  SNOOZE_MS,
  MAX_SNOOZES,
  decideStationPrompt,
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

test("prompt: modal, snooze, bar after 3, pay hides modal", () => {
  assert.equal(SNOOZE_MS, 10 * 60 * 1000);
  assert.equal(MAX_SNOOZES, 3);
  assert.equal(
    decideStationPrompt({
      pending: "shell",
      snoozed: false,
      snoozeCount: 0,
      criticalBusy: false,
      isManager: false,
    }),
    "modal",
  );
  assert.equal(
    decideStationPrompt({
      pending: "shell",
      snoozed: true,
      snoozeCount: 1,
      criticalBusy: false,
      isManager: false,
    }),
    "hidden",
  );
  assert.equal(
    decideStationPrompt({
      pending: "shell",
      snoozed: true,
      snoozeCount: 1,
      criticalBusy: false,
      isManager: true,
    }),
    "manager-chip",
  );
  assert.equal(
    decideStationPrompt({
      pending: "shell",
      snoozed: false,
      snoozeCount: 3,
      criticalBusy: false,
      isManager: false,
    }),
    "bar",
  );
  assert.equal(
    decideStationPrompt({
      pending: "shell",
      snoozed: false,
      snoozeCount: 0,
      criticalBusy: true,
      isManager: false,
    }),
    "hidden",
  );
  assert.equal(
    decideStationPrompt({
      pending: "config",
      snoozed: false,
      snoozeCount: 0,
      criticalBusy: false,
      isManager: false,
    }),
    "modal",
  );
});

test("update prompt copy is wired; never reload without a tap", () => {
  assert.equal(UPDATE_READY_TITLE, "A system update is ready.");
  assert.equal(UPDATE_NOW_LABEL, "Update now");
  assert.equal(REMIND_LATER_LABEL, "Remind me later");
  assert.equal(FINISH_CHECK_TOAST, "Finish this check first");
  const prompt = readFileSync("src/components/pos/StationUpdatePrompt.tsx", "utf8");
  assert.match(prompt, /data-station-update-modal/);
  assert.match(prompt, /data-station-update-now/);
  assert.match(prompt, /data-station-remind-later/);
  assert.match(prompt, /data-station-update-bar/);
  assert.match(prompt, /FINISH_CHECK_TOAST/);
  const refresh = readFileSync("src/lib/pos/station-refresh.ts", "utf8");
  assert.match(refresh, /Never reload without a tap/);
  assert.match(refresh, /applyStationUpdate/);
  assert.match(refresh, /snoozeStationUpdate/);
  assert.doesNotMatch(refresh, /tryApplyStationRefresh/);
  const watch = readFileSync("src/components/pos/StationPublishWatcher.tsx", "utf8");
  assert.match(watch, /ingestHeartbeat/);
  assert.match(watch, /tickStationUpdatePrompt/);
  const print = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(print, /setStationPrintInFlight\(true\)/);
  const persist = readFileSync("src/lib/pos/persist-location-setup.ts", "utf8");
  assert.match(persist, /bumpConfigVersion/);
  const guide = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(guide, /A system update is ready/);
  assert.match(guide, /Remind me later/);
  assert.match(guide, /Finish this check first/);
  assert.match(guide, /Do not force-stop, unpair, or install a new APK/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.128/);
});
