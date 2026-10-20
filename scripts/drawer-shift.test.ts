import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_DRAWER_SHIFT,
  acceptOwnershipTransfer,
  applyDrawerShiftToSink,
  claimDrawerDecision,
  closeOwnershipDecision,
  forceReassignDecision,
  parseDrawerShiftPolicy,
  inferDrawerShiftDefault,
  resolveDrawerShiftMode,
  ringCashDecision,
  startOwnershipTransfer,
} from "../src/lib/pos/drawer-shift.ts";

const policy = { ...DEFAULT_DRAWER_SHIFT };

test("device mode beats section mode beats the location default", () => {
  const p = parseDrawerShiftPolicy({
    defaultMode: "assigned",
    sectionMode: { dining: "personal" },
    deviceMode: { tab_1: "none" },
    requireCountOnTransfer: true,
    allowTransfer: true,
  });
  assert.equal(resolveDrawerShiftMode(p, { deviceId: "tab_1", sectionId: "dining" }), "none");
  assert.equal(resolveDrawerShiftMode(p, { sectionId: "dining" }), "personal");
  assert.equal(resolveDrawerShiftMode(p, {}), "assigned");
  assert.equal(p.requireCountOnTransfer, true);
  assert.equal(p.allowTransfer, true);
});

test("a saved shared house drawer stays shared until the venue sets a mode", () => {
  assert.equal(inferDrawerShiftDefault({ houseDrawerMode: "shared", cashModel: "shared_drawer" }), "shared");
  assert.equal(inferDrawerShiftDefault({ cashModel: "server_bank" }), "personal");
  assert.equal(inferDrawerShiftDefault({ cashModel: "cash_disabled" }), "none");
  assert.equal(inferDrawerShiftDefault({}), "assigned");
  const handling = readFileSync("src/lib/pos/cash-handling.ts", "utf8");
  assert.match(handling, /inferDrawerShiftDefault/);
  assert.match(handling, /drawerShift: parseDrawerShiftPolicy/);
});

test("a personal bank PIN is not forced onto an assigned drawer", () => {
  const shifted = applyDrawerShiftToSink({
    policy,
    sinkType: "bank",
  });
  assert.equal(shifted.mode, "personal");
  assert.equal(shifted.use, "bank");
  const section = applyDrawerShiftToSink({
    policy: { ...policy, sectionMode: { bar: "assigned" } },
    sectionId: "bar",
    sinkType: "bank",
  });
  assert.equal(section.use, "drawer");
});

test("claim requires a blind count and rejects a second owner", () => {
  const open = claimDrawerDecision({
    mode: "assigned",
    existingOwnerId: null,
    ownerClosed: false,
    countedCents: 20000,
    personalBankStartCents: null,
  });
  assert.equal(open.ok && open.startCents, 20000);
  assert.equal(open.ok && open.kick, true);
  const missing = claimDrawerDecision({
    mode: "shared",
    existingOwnerId: null,
    ownerClosed: false,
    countedCents: null,
    personalBankStartCents: null,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, "Enter the blind count.");
  const taken = claimDrawerDecision({
    mode: "assigned",
    existingOwnerId: "a",
    ownerClosed: false,
    countedCents: 100,
    personalBankStartCents: null,
  });
  assert.equal(taken.ok, false);
  if (!taken.ok) assert.equal(taken.error, "This drawer already has an owner.");
  const fixed = claimDrawerDecision({
    mode: "personal",
    existingOwnerId: null,
    ownerClosed: false,
    countedCents: null,
    personalBankStartCents: 5000,
  });
  assert.equal(fixed.ok && fixed.startCents, 5000);
  assert.equal(fixed.ok && fixed.kick, false);
});

test("assigned blocks another ringer; shared allows it; personal does not kick; none blocks cash", () => {
  const assigned = ringCashDecision({
    mode: "assigned",
    employeeId: "b",
    ownerId: "a",
    isManager: false,
    ownerClosed: false,
  });
  assert.equal(assigned.ok, false);
  if (!assigned.ok) assert.match(assigned.error, /Only the drawer owner/);
  const manager = ringCashDecision({
    mode: "assigned",
    employeeId: "m",
    ownerId: "a",
    isManager: true,
    ownerClosed: false,
  });
  assert.equal(manager.ok && manager.kick, true);
  const shared = ringCashDecision({
    mode: "shared",
    employeeId: "b",
    ownerId: "a",
    isManager: false,
    ownerClosed: false,
  });
  assert.equal(shared.ok && shared.kick, true);
  const unclaimed = ringCashDecision({
    mode: "shared",
    employeeId: "b",
    ownerId: null,
    isManager: false,
    ownerClosed: false,
  });
  assert.equal(unclaimed.ok, false);
  if (!unclaimed.ok) assert.equal(unclaimed.error, "Claim the drawer before cash.");
  const personal = ringCashDecision({
    mode: "personal",
    employeeId: "s",
    ownerId: null,
    isManager: false,
    ownerClosed: false,
  });
  assert.equal(personal.ok && personal.kick, false);
  const none = ringCashDecision({
    mode: "none",
    employeeId: "k",
    ownerId: null,
    isManager: true,
    ownerClosed: false,
  });
  assert.equal(none.ok, false);
  if (!none.ok) assert.equal(none.error, "This station does not handle cash.");
});

test("transfer variance stays on the outgoing count, and the next count can confirm it", () => {
  const off = startOwnershipTransfer({
    allowTransfer: false,
    actorId: "a",
    ownerId: "a",
    isManager: false,
    requireManagerPin: false,
    managerPinOk: false,
    incomingId: "b",
    requireCount: true,
    outgoingCountCents: 100,
    expectedCents: 100,
  });
  assert.equal(off.ok, false);
  if (!off.ok) assert.equal(off.error, "Drawer transfer is off.");
  const needCount = startOwnershipTransfer({
    allowTransfer: true,
    actorId: "a",
    ownerId: "a",
    isManager: false,
    requireManagerPin: false,
    managerPinOk: false,
    incomingId: "b",
    requireCount: true,
    outgoingCountCents: null,
    expectedCents: 15000,
  });
  assert.equal(needCount.ok, false);
  const pin = startOwnershipTransfer({
    allowTransfer: true,
    actorId: "a",
    ownerId: "a",
    isManager: false,
    requireManagerPin: true,
    managerPinOk: false,
    incomingId: "b",
    requireCount: true,
    outgoingCountCents: 14000,
    expectedCents: 15000,
  });
  assert.equal(pin.ok, false);
  if (!pin.ok) assert.match(pin.error, /manager PIN/);
  const started = startOwnershipTransfer({
    allowTransfer: true,
    actorId: "a",
    ownerId: "a",
    isManager: false,
    requireManagerPin: false,
    managerPinOk: false,
    incomingId: "b",
    requireCount: true,
    outgoingCountCents: 14000,
    expectedCents: 15000,
  });
  assert.equal(started.ok, true);
  if (started.ok) {
    assert.equal(started.status, "offered");
    assert.equal(started.outgoingVarianceCents, -1000);
  }
  const stranger = acceptOwnershipTransfer({
    actorId: "c",
    incomingId: "b",
    confirmPrevious: true,
    outgoingCountCents: 14000,
    expectedCents: 15000,
    incomingCountCents: null,
  });
  assert.equal(stranger.ok, false);
  const confirmed = acceptOwnershipTransfer({
    actorId: "b",
    incomingId: "b",
    confirmPrevious: true,
    outgoingCountCents: 14000,
    expectedCents: 15000,
    incomingCountCents: null,
  });
  assert.equal(confirmed.ok && confirmed.startCents, 14000);
  assert.equal(confirmed.ok && confirmed.staysOpen, true);
  const own = acceptOwnershipTransfer({
    actorId: "b",
    incomingId: "b",
    confirmPrevious: false,
    outgoingCountCents: 14000,
    expectedCents: 15000,
    incomingCountCents: 13900,
  });
  assert.equal(own.ok && own.startCents, 13900);
});

test("a manager can reassign with no count; closeout is the current owner", () => {
  const forced = forceReassignDecision({ isManager: true, incomingId: "b", ownerId: "a" });
  assert.equal(forced.ok && forced.reason, "manager action");
  assert.equal(forced.ok && forced.resetTotals, false);
  const staff = forceReassignDecision({ isManager: false, incomingId: "b", ownerId: "a" });
  assert.equal(staff.ok, false);
  const managerClose = closeOwnershipDecision({
    actorId: "m",
    ownerId: "a",
    countedCents: 100,
    expectedCents: 100,
    varianceApprovalCents: 0,
    managerApproved: false,
    pendingTransfer: false,
  });
  assert.equal(managerClose.ok, false);
  if (!managerClose.ok) assert.match(managerClose.error, /current owner/);
  const pending = closeOwnershipDecision({
    actorId: "a",
    ownerId: "a",
    countedCents: 100,
    expectedCents: 100,
    varianceApprovalCents: 0,
    managerApproved: false,
    pendingTransfer: true,
  });
  assert.equal(pending.ok, false);
  if (!pending.ok) assert.equal(pending.error, "Finish or cancel the transfer first.");
  const over = closeOwnershipDecision({
    actorId: "a",
    ownerId: "a",
    countedCents: 12000,
    expectedCents: 10000,
    varianceApprovalCents: 500,
    managerApproved: false,
    pendingTransfer: false,
  });
  assert.equal(over.ok, false);
  if (!over.ok) assert.equal(over.needsManager, true);
  const approved = closeOwnershipDecision({
    actorId: "a",
    ownerId: "a",
    countedCents: 12000,
    expectedCents: 10000,
    varianceApprovalCents: 500,
    managerApproved: true,
    pendingTransfer: false,
  });
  assert.equal(approved.ok && approved.varianceCents, 2000);
  assert.equal(approved.ok && approved.flagged, true);
  const even = closeOwnershipDecision({
    actorId: "a",
    ownerId: "a",
    countedCents: 10000,
    expectedCents: 10000,
    varianceApprovalCents: 0,
    managerApproved: false,
    pendingTransfer: false,
  });
  assert.equal(even.ok && even.flagged, false);
});

test("an accepted transfer switches the owner and leaves the drawer open", () => {
  const session = readFileSync("src/lib/pos/cash-session.ts", "utf8");
  assert.match(session, /emptyDrawer\(row\.drawerId, decision\.startCents\)/);
  assert.match(session, /reason: "manager action"/);
  assert.match(session, /status: "offered"/);
  assert.match(session, /ringCashDecision/);
  const acceptAt = session.indexOf("acceptOwnershipTransfer: (opts)");
  const forceAt = session.indexOf("forceReassignDrawer: (opts)");
  const closeAt = session.indexOf("closeOwnedDrawer: (opts)");
  const acceptBody = session.slice(acceptAt, forceAt);
  const forceBody = session.slice(forceAt, closeAt);
  assert.match(acceptBody, /emptyDrawer\(row\.drawerId, decision\.startCents\)/);
  assert.doesNotMatch(acceptBody, /closedAt: Date\.now\(\)/);
  assert.doesNotMatch(forceBody, /emptyDrawer\(/);
  assert.match(session, /closeOwnershipDecision/);
});

test("cash screens name the owner, the transfer, and the mode settings", () => {
  const panel = readFileSync("src/components/pos/DrawerShiftPanel.tsx", "utf8");
  const cash = readFileSync("src/components/pos/CashView.tsx", "utf8");
  const settings = readFileSync("src/components/pos/CashHandlingSettings.tsx", "utf8");
  const guide = readFileSync("src/lib/guide/content/cash-gifts.ts", "utf8");
  assert.match(panel, /Owner:/);
  assert.match(panel, /Transfer drawer/);
  assert.match(panel, /Accept transfer/);
  assert.match(panel, /Close drawer/);
  assert.match(panel, /manager action/);
  assert.match(cash, /DrawerShiftPanel/);
  assert.match(settings, /Assigned/);
  assert.match(settings, /Shared/);
  assert.match(settings, /Personal bank/);
  assert.match(settings, /None/);
  assert.match(settings, /Allow drawer transfer/);
  assert.match(settings, /Require count on every transfer/);
  assert.match(settings, /Role defaults/);
  assert.match(settings, /not a JSON blob/);
  assert.doesNotMatch(settings, /JSON\.stringify\(cfg/);
  assert.match(guide, /18%, 20%, 25%, and Custom/);
  assert.match(guide, /ownership transfer is not a till loan/);
  assert.match(guide, /The drawer stays open/);
});
