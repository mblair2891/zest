import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  alignTableFlashClock,
  DEFAULT_FLOOR_STATUS_CONFIG,
  tableFlash,
  type FloorStatusConfig,
} from "../src/lib/pos/floor-status.ts";

const now = 1_800_000_000_000;
const min = 60_000;
const cfg: FloorStatusConfig = DEFAULT_FLOOR_STATUS_CONFIG;

test("a paid table stops flashing until the new status has its own minutes", () => {
  const seated = now - 5 * 60 * min;
  const justClosed = {
    status: "closed_not_cleaned",
    statusSince: now,
    seatedAt: seated,
  };
  assert.equal(tableFlash(justClosed, cfg, now), false);
  assert.equal(tableFlash({ ...justClosed, statusSince: seated }, cfg, now), false);
  assert.equal(
    tableFlash(
      { status: "closed_not_cleaned", statusSince: now - 6 * min, seatedAt: seated },
      cfg,
      now,
    ),
    true,
  );
  assert.equal(tableFlash({ status: "empty", statusSince: now, seatedAt: seated }, cfg, now), false);
});

test("an idle status flashes only after the minutes configured for that status", () => {
  const sat = { status: "sat_no_order", statusSince: now - 11 * min, seatedAt: now - 11 * min };
  assert.equal(tableFlash(sat, cfg, now), true);
  assert.equal(tableFlash({ ...sat, statusSince: now - 2 * min, seatedAt: now - 2 * min }, cfg, now), false);
  assert.equal(tableFlash({ status: "empty", statusSince: now - 8 * 60 * min }, cfg, now), false);
  const emptyOn = {
    ...cfg,
    flashMinutes: { ...cfg.flashMinutes, empty: 30 },
  };
  assert.equal(
    tableFlash({ status: "empty", statusSince: now - 31 * min }, emptyOn, now),
    true,
  );
  assert.equal(
    tableFlash({ status: "empty", statusSince: now - 5 * min }, emptyOn, now),
    false,
  );
  assert.equal(tableFlash({ status: "reserved", statusSince: now - 8 * 60 * min }, cfg, now), false);
  assert.equal(tableFlash({ status: "sat_no_order" }, cfg, now), false);
});

test("closing the check and cleaning the table restart the flash clock", () => {
  const seated = now - 4 * 60 * min;
  const dining = {
    status: "food_completed",
    statusSince: seated,
    seatedAt: seated,
    orderId: "ord_1",
    flashNotified: true,
  };
  const closed = alignTableFlashClock(dining, {
    now,
    cfg,
    openOrders: [],
    linked: { status: "closed" },
  });
  assert.equal(closed.status, "closed_not_cleaned");
  assert.equal(closed.statusSince, now);
  assert.equal(closed.flashNotified, false);
  assert.equal(tableFlash(closed, cfg, now), false);

  const dirty = {
    status: "closed_not_cleaned",
    statusSince: now - 20 * min,
    seatedAt: seated,
    flashNotified: true,
  };
  assert.equal(tableFlash(dirty, cfg, now), true);
  const cleaned = alignTableFlashClock(
    { ...dirty, status: "empty", statusSince: now, seatedAt: undefined, flashNotified: false },
    { now, cfg, openOrders: [], linked: null },
  );
  assert.equal(cleaned.status, "empty");
  assert.equal(tableFlash(cleaned, cfg, now), false);
});

test("a seated table with no new items flashes from the time it was sat", () => {
  const seated = now - 3 * 60 * min;
  const staleEmpty = {
    status: "empty",
    statusSince: now,
    seatedAt: seated,
    orderId: "ord_2",
  };
  assert.equal(tableFlash(staleEmpty, cfg, now, "sat_no_order"), true);
  const aligned = alignTableFlashClock(staleEmpty, {
    now,
    cfg,
    openOrders: [{ createdAt: seated }],
    linked: { status: "open" },
    derived: "sat_no_order",
  });
  assert.equal(aligned.status, "sat_no_order");
  assert.equal(aligned.statusSince, seated);
  assert.equal(tableFlash(aligned, cfg, now), true);
});

test("the floor keeps the status clock and does not reuse the seat stamp", () => {
  const plugin = readFileSync("src/lib/pos/floor.server.ts", "utf8");
  const upsert = plugin.slice(plugin.indexOf("async function upsertTableRow"), plugin.indexOf("async function loadTicketOrThrow"));
  assert.match(upsert, /status is distinct from excluded.status then/);
  assert.match(upsert, /else pos_table_status.status_since_ms/);
  assert.match(upsert, /status_since_ms <= pos_table_status.seated_at_ms/);
  const pay = plugin.slice(plugin.indexOf("export async function recordPayment"), plugin.indexOf("export async function upsertTableStatus"));
  assert.match(pay, /status === "closed"/);
  assert.match(pay, /closed_not_cleaned/);
  assert.match(pay, /status_since_ms = \$\{now\}/);
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(store, /alignTableFlashClock/);
  assert.doesNotMatch(store, /statusSince: t\.statusSince \|\| t\.seatedAt/);
  const sync = readFileSync("src/lib/pos/floor-sync.ts", "utf8");
  assert.match(sync, /serverClock > localClock \+ 1000/);
  assert.match(sync, /Math\.min\(localClock, serverClock\)/);
  const listed = readFileSync("src/lib/pos/floor.server.ts", "utf8");
  assert.match(listed, /statusSince: n\(t\.status_since_ms\)/);
  assert.doesNotMatch(listed, /statusSince: n\(t\.status_since_ms, now\)/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /A paid table stops flashing when the check closes/);
  assert.match(guide, /Marking the table cleaned, or clearing it, stops the flash/);
});
