import assert from "node:assert/strict";
import test from "node:test";
import {
  TEST_MSR_TRACK,
  applyEloMsrSwipe,
  giftLedgerIntent,
  looksLikeBankPan,
  msrForSavedDevice,
  parseMsrConfig,
  parseMsrWedge,
  pushWedgeKey,
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
