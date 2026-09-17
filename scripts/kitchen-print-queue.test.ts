import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  countWaitingKitchenPrints,
  isPreferredPrintWorkerDevice,
  isPreferredPrintWorkerRole,
  waitingKitchenPrintBanner,
  type StationPrintQueued,
} from "../src/lib/print/station-print-queue.ts";

test("waiting banner copy is exact", () => {
  assert.equal(waitingKitchenPrintBanner(3), "3 kitchen tickets waiting to print.");
  assert.equal(waitingKitchenPrintBanner(1), "1 kitchen tickets waiting to print.");
});

test("preferred print workers are docked host/ODS and print-agent, not order handhelds", () => {
  assert.equal(isPreferredPrintWorkerRole("ods"), true);
  assert.equal(isPreferredPrintWorkerRole("host"), true);
  assert.equal(isPreferredPrintWorkerRole("print-agent"), true);
  assert.equal(isPreferredPrintWorkerRole("order"), false);
  assert.equal(isPreferredPrintWorkerRole("kiosk"), false);
  assert.equal(isPreferredPrintWorkerDevice("kds", "kitchen_kds"), true);
  assert.equal(isPreferredPrintWorkerDevice("host_stand", "host_stand"), true);
  assert.equal(isPreferredPrintWorkerDevice("tablet_pos", "floor_pos"), false);
  assert.equal(isPreferredPrintWorkerDevice("kiosk", "kiosk"), false);
});

test("open kitchen tickets count until a successful print", () => {
  const now = Date.now();
  const jobs: StationPrintQueued[] = [
    {
      id: "a",
      printerId: "p",
      host: "192.168.0.105",
      port: 9100,
      escposBase64: "QQ==",
      kind: "ticket",
      queuedAt: now,
      ticketId: "kt1",
    },
    {
      id: "b",
      printerId: "p",
      host: "192.168.0.105",
      port: 9100,
      escposBase64: "QQ==",
      kind: "ticket",
      queuedAt: now,
      ticketId: "kt1",
    },
    {
      id: "c",
      printerId: "p",
      host: "192.168.0.105",
      port: 9100,
      escposBase64: "QQ==",
      kind: "test",
      queuedAt: now,
    },
    {
      id: "d",
      printerId: "p",
      host: "192.168.0.105",
      port: 9100,
      escposBase64: "QQ==",
      kind: "ticket",
      queuedAt: now,
      ticketId: "kt2",
      doneAt: now,
      ok: true,
    },
  ];
  assert.equal(countWaitingKitchenPrints(jobs), 1);
});

test("QR/kiosk/online fire queues; stations and print agent subscribe; never window.print", () => {
  const fromStore = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(fromStore, /enqueueVenuePrintFn|enqueueStationPrintFn/);
  assert.match(fromStore, /queueOnly/);
  assert.match(fromStore, /source === "qr"/);
  const platform = readFileSync("src/lib/pos/platform-store.ts", "utf8");
  assert.match(platform, /printFromPos\("send"/);
  assert.match(platform, /source/);
  const watcher = readFileSync("src/components/pos/StationPublishWatcher.tsx", "utf8");
  assert.match(watcher, /claimStationPrintFn/);
  assert.match(watcher, /deliverRawPrint/);
  assert.doesNotMatch(watcher, /if \(!isNativeApp\(\)\) return/);
  const agent = readFileSync("scripts/print-agent.mjs", "utf8");
  assert.match(agent, /SUMMEX_PRINT_ORIGIN/);
  assert.match(agent, /\/api\/print\/jobs/);
  assert.match(agent, /drainVenueQueue/);
  const banner = readFileSync("src/components/pos/PrintWaitingBanner.tsx", "utf8");
  assert.match(banner, /waitingKitchenPrintBanner/);
  const bannerLib = readFileSync("src/lib/print/station-print-queue.ts", "utf8");
  assert.match(bannerLib, /kitchen tickets waiting to print/);
  const shell = readFileSync("src/components/pos/AppShell.tsx", "utf8");
  assert.match(shell, /PrintWaitingBanner/);
  const dispatch = readFileSync("src/lib/print/dispatch.ts", "utf8");
  assert.doesNotMatch(dispatch, /window\.print\(/);
  const api = readFileSync("src/lib/print/api.ts", "utf8");
  assert.doesNotMatch(api, /window\.print\(/);
  const jobsApi = readFileSync("src/routes/api/print/jobs.ts", "utf8");
  assert.match(jobsApi, /claimPrintJob/);
  assert.match(jobsApi, /PRINT_AGENT_WORKER/);
});

test("guide covers queued QR/kiosk/online fire", () => {
  const guide = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(guide, /venue print job/);
  assert.match(guide, /docked host or ODS/);
  assert.match(guide, /kitchen tickets waiting to print/);
  const online = readFileSync("src/lib/guide/content/orders.ts", "utf8");
  assert.match(online, /venue print job/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.109/);
});
