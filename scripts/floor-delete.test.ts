import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyTicketVoids,
  floorRejectMessage,
  mergeOpenOrders,
  mergeOpenTickets,
  reconcilePendingFloor,
  releasedTableIds,
  rememberCheckDeleted,
  rememberCheckVoided,
  rememberLineRemoved,
  rememberLineVoid,
  resetPendingFloorEdits,
} from "../src/lib/pos/floor-merge.ts";

const now = 1_000_000;
const grace = 20_000;

test("a removed unsent line stays gone when the server snapshot is stale", () => {
  resetPendingFloorEdits();
  rememberLineRemoved("c1", "a");
  const local = [
    {
      id: "c1",
      createdAt: now - 5_000,
      status: "open",
      lines: [{ id: "b", sent: false, createdAt: now - 4_000 }],
    },
  ];
  const server = [
    {
      id: "c1",
      createdAt: now - 5_000,
      status: "open",
      lines: [
        { id: "a", sent: false, createdAt: now - 4_000 },
        { id: "b", sent: false, createdAt: now - 4_000 },
      ],
    },
  ];
  const merged = mergeOpenOrders(local, server, now, grace);
  assert.deepEqual(
    merged[0]?.lines.map((line) => line.id),
    ["b"],
  );
  resetPendingFloorEdits();
});

test("a newly added unsent line still survives the poll", () => {
  resetPendingFloorEdits();
  const local = [
    {
      id: "c1",
      createdAt: now - 60_000,
      status: "open",
      lines: [
        { id: "a", sent: true, createdAt: now - 50_000 },
        { id: "b", sent: false, createdAt: now - 1_000 },
      ],
    },
  ];
  const server = [
    {
      id: "c1",
      createdAt: now - 60_000,
      status: "open",
      lines: [{ id: "a", sent: true, createdAt: now - 50_000 }],
    },
  ];
  const merged = mergeOpenOrders(local, server, now, grace);
  assert.deepEqual(
    merged[0]?.lines.map((line) => line.id),
    ["a", "b"],
  );
});

test("a deleted check does not come back from the server snapshot", () => {
  resetPendingFloorEdits();
  rememberCheckDeleted("c1", ["t1"]);
  const merged = mergeOpenOrders(
    [],
    [{ id: "c1", createdAt: now - 5_000, status: "open", lines: [{ id: "a", sent: false }] }],
    now,
    grace,
  );
  assert.equal(merged.length, 0);
  assert.equal(releasedTableIds().has("t1"), true);
  reconcilePendingFloor({
    checks: [],
    tables: [{ tableId: "t1", status: "sat_no_order", checkId: "c1" }],
  });
  assert.equal(releasedTableIds().has("t1"), true);
  reconcilePendingFloor({
    checks: [],
    tables: [{ tableId: "t1", status: "empty", checkId: null }],
  });
  assert.equal(releasedTableIds().has("t1"), false);
  resetPendingFloorEdits();
});

test("a voided line stays voided until the server agrees", () => {
  resetPendingFloorEdits();
  rememberLineVoid("c1", "a", { voided: true, actionReason: "Wrong item" });
  const merged = mergeOpenOrders(
    [
      {
        id: "c1",
        status: "open",
        createdAt: now - 5_000,
        lines: [{ id: "a", sent: true, voided: true, actionReason: "Wrong item" }],
      },
    ],
    [
      {
        id: "c1",
        status: "open",
        createdAt: now - 5_000,
        lines: [{ id: "a", sent: true, voided: false, actionReason: null }],
      },
    ],
    now,
    grace,
  );
  assert.equal(merged[0]?.lines[0]?.voided, true);
  assert.equal(merged[0]?.lines[0]?.actionReason, "Wrong item");
  reconcilePendingFloor({
    checks: [
      {
        id: "c1",
        status: "open",
        lines: [{ id: "a", voided: true, comped: false }],
      },
    ],
    tables: [],
  });
  const after = mergeOpenOrders(
    [],
    [
      {
        id: "c1",
        status: "open",
        createdAt: now - 5_000,
        lines: [{ id: "a", sent: true, voided: true, actionReason: "Wrong item" }],
      },
    ],
    now,
    grace,
  );
  assert.equal(after[0]?.lines[0]?.voided, true);
  resetPendingFloorEdits();
});

test("voiding a fired line marks the ticket void and keeps a cancel chit", () => {
  const tickets = [
    {
      id: "tk",
      orderId: "c1",
      status: "new",
      items: [
        { lineId: "a" },
        { lineId: "b" },
      ],
    },
  ];
  const partial = applyTicketVoids(tickets, "c1", ["a"]);
  assert.equal(partial.tickets[0]?.status, "new");
  assert.deepEqual(
    partial.tickets[0]?.items.map((item) => item.lineId),
    ["b"],
  );
  assert.deepEqual(
    partial.chits[0]?.items.map((item) => item.lineId),
    ["a"],
  );
  const whole = applyTicketVoids(tickets, "c1", ["a", "b"]);
  assert.equal(whole.tickets[0]?.status, "voided");
  assert.equal(whole.chits.length, 1);
});

test("a voided check hides its tickets until the server drops them", () => {
  resetPendingFloorEdits();
  rememberCheckVoided("c1", ["t1"]);
  const merged = mergeOpenTickets(
    [{ id: "tk", orderId: "c1", status: "voided", createdAt: now - 1_000 }],
    [{ id: "tk", orderId: "c1", status: "new", createdAt: now - 1_000 }],
    now,
    grace,
  );
  assert.equal(merged.length, 0);
  resetPendingFloorEdits();
});

test("a rejected void is not treated as an offline queue", () => {
  assert.equal(
    floorRejectMessage(new Error("Sent items stay on the check. Void or comp the check.")),
    "Sent items stay on the check. Void or comp the check.",
  );
  assert.equal(floorRejectMessage(new Error("Failed to fetch")), null);
});

test("line flags and check delete use the persisted path", () => {
  const server = readFileSync("src/lib/pos/floor.server.ts", "utf8");
  const map = server.slice(server.indexOf("function mapLine"), server.indexOf("function mapPayment"));
  assert.match(map, /sent: dbTrue\(row\.sent\)/);
  assert.match(map, /voided: dbTrue\(row\.voided\)/);
  assert.match(map, /comped: dbTrue\(row\.comped\)/);
  assert.doesNotMatch(map, /sent: Boolean\(/);
  const outbox = server.slice(
    server.indexOf('if (kind === "order_upsert")'),
    server.indexOf('if (kind === "ticket_upsert")'),
  );
  assert.match(outbox, /deleteUnsentCheck/);
  const sync = readFileSync("src/lib/pos/floor-sync.ts", "utf8");
  assert.match(sync, /mergeOpenOrders/);
  assert.match(sync, /floorRejectMessage/);
  const print = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(print, /voidTickets/);
  assert.match(print, /"VOID"/);
});
