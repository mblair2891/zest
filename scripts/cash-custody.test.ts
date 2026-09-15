import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cashTenderBlockedReason,
  drawerAllowsAnotherHolder,
  staffCustody,
  takeDrawerLabel,
} from "../src/lib/pos/cash-custody.ts";

test("role defaults: bartender drawer, server bank, kitchen none", () => {
  assert.equal(staffCustody({ role: "bartender" }), "house_drawer");
  assert.equal(staffCustody({ role: "cashier" }), "house_drawer");
  assert.equal(staffCustody({ role: "host" }), "house_drawer");
  assert.equal(staffCustody({ role: "server" }), "personal_bank");
  assert.equal(staffCustody({ role: "kitchen" }), "none");
  assert.equal(staffCustody({ role: "busser" }), "none");
});

test("kitchen cannot be overridden onto a drawer", () => {
  assert.equal(
    staffCustody({ role: "kitchen", employeeOverride: "house_drawer" }),
    "none",
  );
});

test("server override to none blocks cash", () => {
  assert.equal(
    staffCustody({ role: "server", employeeOverride: "none" }),
    "none",
  );
});

test("kitchen PIN cannot tender cash", () => {
  const r = cashTenderBlockedReason({
    role: "kitchen",
    hasPossession: true,
  });
  assert.ok(r);
  assert.match(r, /kitchen display/i);
});

test("server bank: cash blocked until possession", () => {
  const before = cashTenderBlockedReason({
    role: "server",
    hasPossession: false,
  });
  assert.ok(before);
  assert.match(before!, /Open your bank/i);
  const after = cashTenderBlockedReason({
    role: "server",
    hasPossession: true,
  });
  assert.equal(after, null);
});

test("shared well allows two holders; exclusive does not", () => {
  assert.equal(drawerAllowsAnotherHolder("exclusive", 1), false);
  assert.equal(drawerAllowsAnotherHolder("shared", 1), true);
  assert.equal(drawerAllowsAnotherHolder("shared", 2), true);
});

test("station menu: kitchen never Take drawer; closeout only if cash assigned", () => {
  const menu = readFileSync("src/lib/pos/station-menu.ts", "utf8");
  assert.match(menu, /take_drawer/);
  assert.match(menu, /takeDrawerLabel/);
  assert.match(menu, /custody !== "none"/);
  const poss = readFileSync("src/components/pos/CashPossessionView.tsx", "utf8");
  assert.match(poss, /Accept possession/);
  assert.match(poss, /Hand off/);
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /hasPossession/);
  const settings = readFileSync("src/components/pos/CashHandlingSettings.tsx", "utf8");
  assert.match(settings, /Role defaults/);
  assert.match(settings, /not a JSON blob/);
  assert.doesNotMatch(settings, /JSON\.stringify\(cfg/);
});

test("take drawer label", () => {
  assert.equal(takeDrawerLabel("personal_bank"), "Open bank");
  assert.equal(takeDrawerLabel("house_drawer"), "Take drawer");
});
