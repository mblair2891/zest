import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertPinAction,
  canChangeDeviceOnStation,
  helpBlocksAction,
  pinRoleCan,
  pinRoleViews,
  viewForDevicePin,
} from "../src/lib/access/pin-role.ts";

test("server cannot bump ODS, edit menus, or open Devices", () => {
  assert.equal(pinRoleCan("server", "ods.bump"), false);
  assert.equal(pinRoleCan("server", "menu.write"), false);
  assert.equal(pinRoleCan("server", "devices.manage"), false);
  assert.equal(pinRoleCan("server", "orders.create"), true);
  assert.equal(pinRoleCan("server", "payments.take"), true);
  assert.equal(pinRoleCan("server", "till.close.own"), true);
  assert.doesNotMatch(JSON.stringify(pinRoleViews("server")), /settings|kitchen|menu/);
});

test("kitchen is ODS only — no pay, no drawer, no prices", () => {
  assert.equal(pinRoleCan("kitchen", "ods.bump"), true);
  assert.equal(pinRoleCan("kitchen", "payments.take"), false);
  assert.equal(pinRoleCan("kitchen", "till.close.own"), false);
  assert.equal(pinRoleCan("kitchen", "menu.write"), false);
  assert.deepEqual(pinRoleViews("kitchen"), ["kitchen", "labor"]);
});

test("busser is dirty→clean only", () => {
  assert.equal(pinRoleCan("busser", "table.bus"), true);
  assert.equal(pinRoleCan("busser", "orders.create"), false);
  assert.equal(pinRoleCan("busser", "payments.take"), false);
  assert.deepEqual(pinRoleViews("busser"), ["floor"]);
});

test("host seats and to-go; no server till close; no 86 other entity", () => {
  assert.equal(pinRoleCan("host", "table.seat"), true);
  assert.equal(pinRoleCan("host", "waitlist.manage"), true);
  assert.equal(pinRoleCan("host", "orders.create"), true);
  assert.equal(pinRoleCan("host", "till.close.own"), false);
  assert.equal(pinRoleCan("host", "item.86.other_entity"), false);
});

test("bartender bumps ODS only on an ODS station; cannot seat unless granted", () => {
  assert.equal(pinRoleCan("bartender", "ods.bump", { deviceRole: "ods" }), true);
  assert.equal(pinRoleCan("bartender", "ods.bump", { deviceRole: "order" }), false);
  assert.equal(pinRoleCan("bartender", "table.seat"), false);
  assert.equal(pinRoleCan("bartender", "table.seat", { seatGranted: true }), true);
});

test("supervisor has floor exceptions, not Publish or platform", () => {
  assert.equal(pinRoleCan("supervisor", "ods.bump"), true);
  assert.equal(pinRoleCan("supervisor", "comps.void"), true);
  assert.equal(pinRoleCan("supervisor", "clock.exceptions"), true);
  assert.equal(pinRoleCan("supervisor", "publish"), false);
  assert.equal(pinRoleCan("supervisor", "platform"), false);
});

test("manager has Devices and Publish; still not platform CRM", () => {
  assert.equal(pinRoleCan("manager", "devices.manage"), true);
  assert.equal(pinRoleCan("manager", "publish"), true);
  assert.equal(pinRoleCan("manager", "till.approve"), true);
  assert.equal(pinRoleCan("manager", "platform"), false);
});

test("change-device is training/demo for managers only", () => {
  assert.equal(canChangeDeviceOnStation({ role: "manager", training: true }), true);
  assert.equal(canChangeDeviceOnStation({ role: "manager", demo: true }), true);
  assert.equal(canChangeDeviceOnStation({ role: "manager" }), false);
  assert.equal(canChangeDeviceOnStation({ role: "server", training: true }), false);
});

test("API assert rejects a kitchen payment", () => {
  assert.throws(() => assertPinAction("kitchen", "payments.take"), /cannot do that/i);
  assert.doesNotThrow(() => assertPinAction("server", "orders.create"));
});

test("help blocks disallowed actions for the PIN role", () => {
  const bump = helpBlocksAction("server", "how do I bump the ODS");
  assert.equal(bump?.blocked, true);
  const devices = helpBlocksAction("server", "open Devices");
  assert.equal(devices?.blocked, true);
  const pay = helpBlocksAction("kitchen", "take a card payment");
  assert.equal(pay?.blocked, true);
  const ok = helpBlocksAction("server", "how do I send a ticket");
  assert.equal(ok, null);
});

test("device × PIN maps bartender on ODS to bar, not kitchen rail as server", () => {
  assert.equal(viewForDevicePin("ods", "bartender"), "bar");
  assert.equal(viewForDevicePin("ods", "kitchen"), "kitchen");
  assert.equal(viewForDevicePin("ods", "server"), "kitchen");
});

test("guide has one page per PIN role", () => {
  const roles = readFileSync("src/lib/guide/content/roles.ts", "utf8");
  for (const id of [
    "role-host-stand",
    "role-server",
    "role-bartender",
    "role-kitchen",
    "role-busser",
    "role-supervisor",
    "role-owner",
  ]) {
    assert.match(roles, new RegExp(`id: "${id}"`));
  }
});
