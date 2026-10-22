import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TEST_MSR_TRACK,
  applyEloMsrSwipe,
  giftLedgerIntent,
  looksLikeBankPan,
  msrConfigForDeviceType,
  msrForSavedDevice,
  parseMsrConfig,
  parseMsrWedge,
  pushWedgeKey,
  selectStationStripeReader,
  takeEloMsrSwipe,
} from "../src/lib/pos/elo-msr.ts";

const NOW = Date.parse("2026-10-19T18:00:00Z");

function tablet() {
  return {
    id: "dev_tablet",
    type: "tablet_pos",
    label: "Bar tablet",
    status: "online" as const,
    lastSeenAt: NOW,
  };
}

function reader() {
  return {
    id: "dev_msr",
    type: "elo_msr",
    label: "Bar stripe",
    status: "pending" as const,
    lastSeenAt: NOW,
    msr: msrForSavedDevice("elo_msr", { mount: "side", role: "gift", stationId: "dev_tablet" }),
  };
}

test("an Elo MSR linked to a tablet delivers a gift-card test swipe", () => {
  const saved = parseMsrConfig(reader().msr);
  assert.equal(saved?.mount, "side");
  assert.equal(saved?.role, "gift");
  assert.equal(saved?.stationId, "dev_tablet");

  const armed = applyEloMsrSwipe([tablet(), reader()], "dev_msr", TEST_MSR_TRACK, {
    now: NOW,
    giftAction: "balance",
    eventId: "msr_test",
  });
  assert.equal(armed.error, undefined);
  assert.ok(armed.event);
  assert.equal(armed.event?.stationId, "dev_tablet");
  assert.equal(armed.event?.kind, "gift_balance");
  assert.equal(armed.event?.code, "SUMMEXMSR11001");
  assert.match(armed.event?.summary ?? "", /••••1001/);
  assert.equal(JSON.stringify(armed).includes(TEST_MSR_TRACK), false);
  assert.equal(JSON.stringify(armed).includes(";"), false);

  const row = armed.devices.find((d) => d.id === "dev_msr");
  assert.equal(row?.status, "online");
  assert.equal(row?.msr?.lastSwipeKind, "gift_balance");
  assert.equal(row?.msr?.pending?.id, "msr_test");

  const taken = takeEloMsrSwipe(armed.devices, "dev_tablet");
  assert.equal(taken.event?.id, "msr_test");
  assert.deepEqual(giftLedgerIntent(taken.event!), { op: "lookup", code: "SUMMEXMSR11001" });
  assert.equal(takeEloMsrSwipe(taken.devices, "dev_tablet").event, null);

  const load = applyEloMsrSwipe(armed.devices, "dev_msr", TEST_MSR_TRACK, {
    now: NOW,
    giftAction: "load",
    eventId: "msr_load",
    handled: true,
  });
  assert.deepEqual(giftLedgerIntent(load.event!), { op: "issue", code: "SUMMEXMSR11001" });
  assert.equal(load.devices.find((d) => d.id === "dev_msr")?.msr?.pending, null);

  const redeem = applyEloMsrSwipe([tablet(), reader()], "dev_msr", TEST_MSR_TRACK, {
    now: NOW,
    giftAction: "redeem",
    eventId: "msr_redeem",
  });
  assert.deepEqual(giftLedgerIntent(redeem.event!), { op: "redeem", code: "SUMMEXMSR11001" });
});

test("a bank card is not stored or sent to the gift ledger", () => {
  assert.equal(looksLikeBankPan("4111111111111111"), true);
  const applied = applyEloMsrSwipe([tablet(), reader()], "dev_msr", ";4111111111111111=2512?", {
    now: NOW,
    giftAction: "balance",
    eventId: "msr_pan",
  });
  assert.equal(applied.event?.code, undefined);
  assert.equal(applied.event?.kind, "unreadable");
  assert.equal(JSON.stringify(applied).includes("4111111111111111"), false);
  assert.equal(giftLedgerIntent(applied.event!).op, "none");
});

test("test swipe waits until a tablet is linked", () => {
  const bare = {
    ...reader(),
    msr: msrForSavedDevice("elo_msr", { role: "gift", stationId: null }, undefined),
  };
  const applied = applyEloMsrSwipe([tablet(), bare], "dev_msr", TEST_MSR_TRACK, { now: NOW });
  assert.match(applied.error ?? "", /Link this reader/);
  assert.equal(applied.event, null);
});

test("saving the reader keeps the last swipe", () => {
  const existing = parseMsrConfig({
    mount: "side",
    role: "gift",
    stationId: "dev_tablet",
    lastSwipeAt: NOW,
    lastSwipeKind: "gift_balance",
    lastSwipeSummary: "Balance · ••••1001",
  });
  const next = msrForSavedDevice("elo_msr", { role: "loyalty", stationId: "dev_host" }, existing);
  assert.equal(next?.role, "loyalty");
  assert.equal(next?.stationId, "dev_host");
  assert.equal(next?.lastSwipeSummary, "Balance · ••••1001");
  assert.equal(msrForSavedDevice("tablet_pos", { role: "gift" }, existing), undefined);
});

test("a USB gift MSR assigned to one station is used for load and redeem there only", () => {
  const saved = msrForSavedDevice(
    "gift_msr",
    { role: "loyalty", connection: "bluetooth", stationId: "dev_tablet", ip: "10.0.0.8" },
    undefined,
  );
  assert.equal(saved?.connection, "usb");
  assert.equal(saved?.role, "gift");
  assert.equal(saved?.mount, "slot");
  assert.equal(saved?.stationId, "dev_tablet");
  assert.equal(JSON.stringify(saved).includes("10.0.0.8"), false);
  assert.equal(JSON.stringify(saved).includes("bluetooth"), false);
  const readBack = msrConfigForDeviceType("gift_msr", saved);
  assert.equal(readBack?.connection, "usb");
  assert.equal(readBack?.role, "gift");

  const other = {
    id: "dev_other",
    type: "host_stand",
    label: "Host",
    status: "online" as const,
    lastSeenAt: NOW,
  };
  const usb = {
    id: "dev_usb",
    type: "gift_msr",
    label: "Slot reader",
    status: "offline" as const,
    lastSeenAt: NOW,
    msr: saved,
  };
  const devices = [tablet(), other, usb];
  assert.equal(selectStationStripeReader(devices, "dev_tablet", "load")?.id, "dev_usb");
  assert.equal(selectStationStripeReader(devices, "dev_tablet", "redeem")?.id, "dev_usb");
  assert.equal(selectStationStripeReader(devices, "dev_other", "load"), undefined);
  assert.equal(selectStationStripeReader(devices, "dev_other", "redeem"), undefined);

  const loaded = applyEloMsrSwipe(devices, "dev_usb", TEST_MSR_TRACK, {
    now: NOW,
    giftAction: "load",
    eventId: "usb_load",
  });
  assert.equal(loaded.error, undefined);
  assert.equal(loaded.event?.stationId, "dev_tablet");
  assert.equal(loaded.event?.kind, "gift_load");
  assert.equal(loaded.devices.find((d) => d.id === "dev_usb")?.msr?.connection, "usb");
  assert.deepEqual(giftLedgerIntent(loaded.event!), { op: "issue", code: "SUMMEXMSR11001" });
  assert.equal(takeEloMsrSwipe(loaded.devices, "dev_other").event, null);
  assert.equal(takeEloMsrSwipe(loaded.devices, "dev_tablet").event?.id, "usb_load");

  const redeemed = applyEloMsrSwipe(devices, "dev_usb", TEST_MSR_TRACK, {
    now: NOW,
    giftAction: "redeem",
    eventId: "usb_redeem",
  });
  assert.deepEqual(giftLedgerIntent(redeemed.event!), { op: "redeem", code: "SUMMEXMSR11001" });

  const pan = applyEloMsrSwipe(devices, "dev_usb", ";4111111111111111=2512?", {
    now: NOW,
    giftAction: "redeem",
    eventId: "usb_pan",
  });
  assert.equal(pan.event?.code, undefined);
  assert.equal(JSON.stringify(pan).includes("4111111111111111"), false);

  assert.equal(msrForSavedDevice("tablet_pos", { role: "gift", connection: "usb" }, saved), undefined);
  const bare = { ...usb, msr: msrForSavedDevice("gift_msr", { stationId: null }) };
  const waiting = applyEloMsrSwipe([tablet(), bare], "dev_usb", TEST_MSR_TRACK, {
    now: NOW,
    giftAction: "load",
  });
  assert.match(waiting.error ?? "", /Assign this reader/);
});

test("gift load prefers the USB reader when a side reader is also on that station", () => {
  const usb = {
    id: "dev_usb",
    type: "gift_msr",
    label: "Slot",
    status: "offline" as const,
    lastSeenAt: NOW,
    msr: msrForSavedDevice("gift_msr", { stationId: "dev_tablet" }),
  };
  const devices = [tablet(), reader(), usb];
  assert.equal(selectStationStripeReader(devices, "dev_tablet", "load")?.id, "dev_usb");
  assert.equal(selectStationStripeReader(devices, "dev_tablet", "redeem")?.id, "dev_usb");
  assert.equal(selectStationStripeReader(devices, "dev_tablet", "balance")?.type, "elo_msr");
  const parsed = parseMsrConfig(reader().msr);
  assert.equal(parsed?.mount, "side");
  assert.equal(parsed?.connection, undefined);
});

test("Devices offers a USB gift card magstripe reader", () => {
  const form = readFileSync(
    new URL("../src/components/pos/LocationDeviceRegistry.tsx", import.meta.url),
    "utf8",
  );
  assert.match(form, /Magstripe reader · Gift card MSR/);
  assert.match(form, /data-gift-msr-form/);
  assert.match(form, /data-msr-connection/);
  assert.match(form, /<option value="usb">USB<\/option>/);
  assert.match(form, /No network address and no Bluetooth pairing/);
  const guide = readFileSync(new URL("../src/lib/guide/content/devices.ts", import.meta.url), "utf8");
  assert.match(guide, /id: "usb-gift-msr"/);
  assert.match(guide, /Connection is USB/);
});

test("a wedge assembles a track and drops a slow key", () => {
  let state = { buf: "", at: 0 };
  const track = ";GIFT1001?";
  for (const ch of track) {
    const step = pushWedgeKey(state, ch, 1000);
    state = step.state;
  }
  const done = pushWedgeKey(state, "Enter", 1040);
  assert.equal(done.done, track);
  assert.equal(parseMsrWedge(done.done ?? "")?.account, "GIFT1001");
  const slow = pushWedgeKey({ buf: "ab", at: 1000 }, "c", 1200);
  assert.equal(slow.state.buf, "c");
});
