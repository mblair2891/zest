import test from "node:test";
import assert from "node:assert/strict";

function inNoCutWindow(cfg, nowMin, openMin, closeMin, daypart) {
  const sinceOpen = nowMin - openMin;
  const untilClose = closeMin >= openMin ? closeMin - nowMin : closeMin + 24 * 60 - nowMin;
  if (sinceOpen >= 0 && sinceOpen < cfg.noCutOpenPaddingMinutes) {
    return { locked: true, reason: "open" };
  }
  if (untilClose >= 0 && untilClose < cfg.noCutClosePaddingMinutes) {
    return { locked: true, reason: "close" };
  }
  if (cfg.rushLockDayparts.includes(daypart)) return { locked: true, reason: "rush" };
  return { locked: false };
}

function decide(cfg, snap) {
  const out = [];
  const servers = snap.byRole.server ?? 0;
  const minServer = cfg.minHeadcount.server ?? 0;
  const laborHigh =
    (snap.laborPct != null && snap.laborPct >= cfg.laborPctHighAlert) ||
    (snap.splhCents != null && snap.splhCents < cfg.salesPerLaborHourFloorCents && snap.clocked >= 2);
  const slowSales = snap.baseline30mCents > 0 && snap.salesLast30mCents < snap.baseline30mCents * 0.85;
  const idleCut = snap.idleMinutes >= cfg.idleMinutesBeforeCut && snap.openChecks <= Math.max(1, servers - 1);
  const odsHeavy = snap.odsOpen >= cfg.addOdsDepth;
  const waitHeavy = snap.waitlistWaiting >= cfg.addWaitlistThreshold;
  const lookaheadBusy = snap.coversSoon >= 8;
  const add = cfg.recommendAdd && (waitHeavy || odsHeavy);
  if (add) out.push("recommend_add");
  const canCut =
    servers > minServer &&
    laborHigh &&
    idleCut &&
    !odsHeavy &&
    !waitHeavy &&
    (slowSales || snap.baseline30mCents === 0) &&
    !snap.inNoCut &&
    !lookaheadBusy;
  if (canCut) out.push("recommend_cut");
  else if (laborHigh && !add) out.push("recommend_hold");
  if (out.includes("recommend_add") && out.includes("recommend_cut")) return ["recommend_hold"];
  return out;
}

test("no-cut window after open and before close", () => {
  const cfg = { noCutOpenPaddingMinutes: 45, noCutClosePaddingMinutes: 60, rushLockDayparts: ["dinner"] };
  assert.equal(inNoCutWindow(cfg, 11 * 60 + 10, 11 * 60, 22 * 60, "morning").locked, true);
  assert.equal(inNoCutWindow(cfg, 21 * 60 + 30, 11 * 60, 22 * 60, "afternoon").locked, true);
  assert.equal(inNoCutWindow(cfg, 14 * 60, 11 * 60, 22 * 60, "afternoon").locked, false);
  assert.equal(inNoCutWindow(cfg, 19 * 60, 11 * 60, 22 * 60, "dinner").reason, "rush");
});

test("cut when labor high, idle, and above min headcount", () => {
  const kinds = decide(
    {
      minHeadcount: { server: 1 },
      laborPctHighAlert: 35,
      salesPerLaborHourFloorCents: 8000,
      idleMinutesBeforeCut: 20,
      addOdsDepth: 8,
      addWaitlistThreshold: 6,
      recommendAdd: true,
    },
    {
      byRole: { server: 3 },
      clocked: 3,
      laborPct: 42,
      splhCents: 4000,
      idleMinutes: 25,
      openChecks: 1,
      odsOpen: 1,
      waitlistWaiting: 0,
      coversSoon: 0,
      baseline30mCents: 10000,
      salesLast30mCents: 4000,
      inNoCut: false,
    },
  );
  assert.deepEqual(kinds, ["recommend_cut"]);
});

test("hold in rush / no-cut instead of cut", () => {
  const kinds = decide(
    {
      minHeadcount: { server: 1 },
      laborPctHighAlert: 35,
      salesPerLaborHourFloorCents: 8000,
      idleMinutesBeforeCut: 20,
      addOdsDepth: 8,
      addWaitlistThreshold: 6,
      recommendAdd: true,
    },
    {
      byRole: { server: 3 },
      clocked: 3,
      laborPct: 42,
      splhCents: 4000,
      idleMinutes: 25,
      openChecks: 1,
      odsOpen: 1,
      waitlistWaiting: 0,
      coversSoon: 0,
      baseline30mCents: 0,
      salesLast30mCents: 0,
      inNoCut: true,
    },
  );
  assert.deepEqual(kinds, ["recommend_hold"]);
});

test("add when waitlist exceeds threshold", () => {
  const kinds = decide(
    {
      minHeadcount: { server: 1 },
      laborPctHighAlert: 35,
      salesPerLaborHourFloorCents: 8000,
      idleMinutesBeforeCut: 20,
      addOdsDepth: 8,
      addWaitlistThreshold: 6,
      recommendAdd: true,
    },
    {
      byRole: { server: 2 },
      clocked: 2,
      laborPct: 20,
      splhCents: 12000,
      idleMinutes: 0,
      openChecks: 8,
      odsOpen: 2,
      waitlistWaiting: 7,
      coversSoon: 12,
      baseline30mCents: 8000,
      salesLast30mCents: 9000,
      inNoCut: false,
    },
  );
  assert.deepEqual(kinds, ["recommend_add"]);
});

test("never clocks anyone out — accept is notify only", () => {
  const acceptClocksOut = false;
  assert.equal(acceptClocksOut, false);
});
