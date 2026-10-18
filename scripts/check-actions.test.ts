import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyOpenCheckAction,
  applySentLineAction,
  actingEntityOperator,
  canDeleteCheck,
  canVoidOrCompCheck,
  lineActionReason,
  lineInEntityScope,
  removeUnsentLine,
} from "../src/lib/pos/check-actions.ts";

const reasons = ["Wrong item", "Kitchen error", "Manager approved"];

test("a vendor void stays on that entity and a manager can void any line", () => {
  assert.equal(actingEntityOperator({ role: "manager", operatorId: "bar" }), null);
  assert.equal(actingEntityOperator({ role: "host", operatorId: "host" }), null);
  assert.equal(actingEntityOperator({ role: "server" }), null);
  assert.equal(actingEntityOperator({ role: "vendor_operator", operatorId: "bar" }), "bar");
  assert.equal(lineInEntityScope({ vendorId: "bar" }, "bar"), true);
  assert.equal(lineInEntityScope({ vendorId: "food" }, "bar"), false);
  assert.equal(lineInEntityScope({ vendorId: "food" }, null), true);
});

test("unsent item is removed and disappears", () => {
  const lines = [
    { id: "a", sent: false, note: "no onion" },
    { id: "b", sent: false },
  ];
  const res = removeUnsentLine(lines, "a");
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(
    res.lines.map((line) => line.id),
    ["b"],
  );
});

test("sent item cannot be removed", () => {
  const res = removeUnsentLine([{ id: "a", sent: true }], "a");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.match(res.error, /voided or comped/);
});

test("sent item void and comp require a listed reason", () => {
  const line = [{ id: "a", sent: true, note: "allergy" }];
  assert.equal(applySentLineAction(line, "a", "void", "", reasons).ok, false);
  assert.equal(applySentLineAction(line, "a", "void", "typed reason", reasons).ok, false);
  assert.equal(applySentLineAction(line, "a", "comp", "not on the list", reasons).ok, false);
  const voided = applySentLineAction(line, "a", "void", "Kitchen error", reasons);
  assert.equal(voided.ok, true);
  if (!voided.ok) return;
  assert.equal(voided.lines[0]?.voided, true);
  assert.equal(voided.lines[0]?.actionReason, "Kitchen error");
  assert.equal(voided.lines[0]?.note, "allergy");
  const comped = applySentLineAction(line, "a", "comp", "Manager approved", reasons);
  assert.equal(comped.ok, true);
  if (!comped.ok) return;
  assert.equal(comped.lines[0]?.comped, true);
  assert.equal(comped.lines[0]?.note, "allergy");
});

test("unsent item cannot be voided or comped", () => {
  const res = applySentLineAction([{ id: "a", sent: false }], "a", "void", "Kitchen error", reasons);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.match(res.error, /removed/);
  const comp = applySentLineAction([{ id: "a", sent: false }], "a", "comp", "Manager approved", reasons);
  assert.equal(comp.ok, false);
});

test("unsent check can be deleted and a sent check cannot", () => {
  const open = { status: "open" as const, lines: [{ id: "a", sent: false }], payments: [] };
  assert.equal(canDeleteCheck(open), true);
  assert.equal(canVoidOrCompCheck(open), false);
  const sent = {
    status: "open" as const,
    lines: [{ id: "a", sent: true }, { id: "b", sent: false, note: "seat 2" }],
    payments: [],
  };
  assert.equal(canDeleteCheck(sent), false);
  assert.equal(canVoidOrCompCheck(sent), true);
  const dropped = removeUnsentLine(sent.lines, "b");
  assert.equal(dropped.ok, true);
  if (!dropped.ok) return;
  assert.deepEqual(dropped.lines.map((line) => line.id), ["a"]);
  assert.equal(canDeleteCheck({ ...open, payments: [{ id: "p" }] }), false);
  assert.equal(canDeleteCheck({ ...open, cardAuth: { amountCents: 1 } }), false);
  assert.equal(applyOpenCheckAction(open.lines, "void", "Kitchen error", reasons).ok, false);
  assert.equal(applyOpenCheckAction(sent.lines, "void", "typed reason", reasons).ok, false);
  const whole = applyOpenCheckAction(sent.lines, "void", "Kitchen error", reasons);
  assert.equal(whole.ok, true);
  if (!whole.ok) return;
  assert.equal(
    whole.lines.every((line) => line.voided && line.actionReason === "Kitchen error"),
    true,
  );
  assert.equal(whole.lines[1]?.note, "seat 2");
  const comp = applyOpenCheckAction(sent.lines, "comp", "Manager approved", reasons);
  assert.equal(comp.ok, true);
  if (!comp.ok) return;
  assert.equal(
    comp.lines.every((line) => line.comped && line.actionReason === "Manager approved"),
    true,
  );
});

test("older voids keep the reason that was stored on the note", () => {
  assert.equal(lineActionReason({ voided: true, note: "Walkout" }), "Walkout");
  assert.equal(
    lineActionReason({ voided: true, note: "allergy", actionReason: "Kitchen error" }),
    "Kitchen error",
  );
});

test("order view gates remove, void, comp, and delete", () => {
  const view = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  for (const attr of [
    "data-remove-line",
    "data-void-line",
    "data-comp-line",
    "data-delete-check",
    "data-void-check",
    "data-comp-check",
  ]) {
    assert.match(view, new RegExp(attr));
  }
  assert.match(view, /canRemoveLine/);
  assert.match(view, /canVoidOrCompLine/);
  assert.match(view, /canDeleteCheck/);
  assert.match(view, /canVoidOrCompCheck/);
  const busy = view.slice(view.indexOf("if (busyNight) {"), view.indexOf("const checkPane"));
  assert.match(busy, /checkActionDialogs/);
  assert.match(busy, /checkLevelActions/);
});

test("removing an unsent line or check does not write an audit row", () => {
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  const start = store.indexOf("\tremoveUnsentLine:");
  const mid = store.indexOf("\tdeleteUnsentCheck:");
  const end = store.indexOf("\tvoidLine:");
  assert.ok(start > 0 && mid > start && end > mid);
  assert.equal(store.slice(start, mid).includes("audit("), false);
  assert.equal(store.slice(mid, end).includes("audit("), false);
});

test("guide states the remove and void rule", () => {
  const orders = readFileSync("src/lib/guide/content/orders.ts", "utf8");
  const loss = readFileSync("src/lib/guide/content/loss-prevention.ts", "utf8");
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(orders, /has not been sent can be removed/);
  assert.match(loss, /reason from the location list/);
  assert.doesNotMatch(loss, /void\/comp skip the gate/);
  assert.match(types, /2026\.10\.289/);
  assert.match(types, /Staff pay rate and employee number/);
  assert.match(orders, /cancel ticket to the kitchen or bar/);
  const payments = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(payments, /A card reader connects by Bluetooth, Network, or USB/);
});
