import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCashHandling } from "../src/lib/pos/cash-handling.ts";
import {
  DRAWER_PIN_DENIED,
  DRAWER_STAYS_CLOSED,
  classifyDrawerAssignment,
  decideDrawerOpen,
} from "../src/lib/pos/drawer-open.ts";

test("drawer approval defaults on and can be turned off", () => {
  assert.equal(parseCashHandling({}).drawerOpenRequiresManager, true);
  assert.equal(parseCashHandling({ drawerOpenRequiresManager: false }).drawerOpenRequiresManager, false);
  assert.equal(parseCashHandling({ drawerOpenRequiresManager: true }).drawerOpenRequiresManager, true);
  assert.equal(parseCashHandling({ kickOnPrintCheck: true }).drawerOpenRequiresManager, true);
});

test("off opens without a manager PIN when the drawer is assigned", () => {
  const assignment = classifyDrawerAssignment({
    stationHasDrawer: true,
    custody: "house_drawer",
    sink: "drawer",
    assignedEmployeeIds: ["emp_a"],
    employeeId: "emp_a",
  });
  assert.equal(assignment, "ok");
  const open = decideDrawerOpen({ assignment, requiresManager: false, approved: false });
  assert.equal(open.phase, "open");
  assert.equal(open.approverRequired, false);
});

test("on prompts until a manager approves", () => {
  const assignment = classifyDrawerAssignment({
    stationHasDrawer: true,
    custody: "house_drawer",
    sink: "drawer",
    assignedEmployeeIds: [],
    employeeId: "emp_server",
  });
  const wait = decideDrawerOpen({ assignment, requiresManager: true, approved: false });
  assert.equal(wait.phase, "prompt");
  const opened = decideDrawerOpen({ assignment, requiresManager: true, approved: true });
  assert.equal(opened.phase, "open");
  assert.equal(opened.approverRequired, true);
  const cancelled = decideDrawerOpen({
    assignment,
    requiresManager: true,
    approved: false,
    cancelled: true,
  });
  assert.equal(cancelled.phase, "blocked");
  assert.equal(cancelled.message, DRAWER_STAYS_CLOSED);
  const denied = decideDrawerOpen({
    assignment,
    requiresManager: true,
    approved: false,
    invalidPin: true,
  });
  assert.equal(denied.message, DRAWER_PIN_DENIED);
});

test("assignment blocks the open in both modes", () => {
  const none = classifyDrawerAssignment({
    stationHasDrawer: true,
    custody: "none",
    sink: "blocked",
    employeeId: "emp_k",
  });
  const bank = classifyDrawerAssignment({
    stationHasDrawer: true,
    custody: "personal_bank",
    sink: "bank",
    employeeId: "emp_s",
  });
  const other = classifyDrawerAssignment({
    stationHasDrawer: true,
    custody: "house_drawer",
    sink: "drawer",
    assignedEmployeeIds: ["emp_a"],
    employeeId: "emp_b",
  });
  const missing = classifyDrawerAssignment({
    stationHasDrawer: false,
    custody: "house_drawer",
    sink: "drawer",
    employeeId: "emp_a",
  });
  for (const requiresManager of [true, false]) {
    assert.equal(decideDrawerOpen({ assignment: none, requiresManager, approved: true }).phase, "blocked");
    assert.equal(decideDrawerOpen({ assignment: bank, requiresManager, approved: true }).phase, "blocked");
    assert.equal(decideDrawerOpen({ assignment: other, requiresManager, approved: true }).phase, "blocked");
    assert.equal(decideDrawerOpen({ assignment: missing, requiresManager, approved: true }).phase, "blocked");
  }
  assert.match(decideDrawerOpen({ assignment: bank, requiresManager: false, approved: false }).message ?? "", /personal bank/);
  assert.match(decideDrawerOpen({ assignment: missing, requiresManager: true, approved: true }).message ?? "", /No drawer on this station/);
});

test("order, pay, and the cash drawer button share the gate", () => {
  const order = readFileSync("src/components/pos/NoSaleControl.tsx", "utf8");
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  const cash = readFileSync("src/components/pos/CashView.tsx", "utf8");
  const settings = readFileSync("src/components/pos/DrawerOpenApprovalSetting.tsx", "utf8");
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(order, /data-no-sale/);
  assert.match(order, /openCashDrawer\(\{ preview: true, source: "order" \}/);
  assert.match(pay, /data-open-drawer/);
  assert.match(pay, /source: "payment"/);
  assert.match(cash, /Kick drawer/);
  assert.match(cash, /source: "drawer"/);
  assert.match(settings, /Cash drawer open requires manager approval/);
  assert.match(settings, /data-drawer-approval/);
  assert.match(settings, /A location admin or manager changes this/);
  assert.match(store, /audit\("drawer_open"/);
  assert.match(store, /requesterId: gate\.emp\.id/);
  const guide = readFileSync("src/lib/guide/content/cash-gifts.ts", "utf8");
  assert.match(guide, /Cash drawer open requires manager approval/);
  assert.match(guide, /who approved when a PIN was required/);
});
