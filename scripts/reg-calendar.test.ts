import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseLaborRules } from "../src/lib/labor/rules.ts";
import { windowsWithinDays, REG_CALENDAR } from "../src/lib/saas/reg-calendar.ts";

test("July 1 window: WA is in lookahead, CA is not", () => {
  const wa = REG_CALENDAR.find((r) => r.state === "WA");
  const ca = REG_CALENDAR.find((r) => r.state === "CA");
  assert.ok(wa?.windows.some((w) => w.mmdd === "07-01"));
  assert.equal(ca?.windows.some((w) => w.mmdd === "07-01"), false);
  const hit = windowsWithinDays("2026-06-01", 45);
  assert.equal(hit.some((w) => w.state === "WA" && w.mmdd === "07-01"), true);
  assert.equal(hit.some((w) => w.state === "CA" && w.mmdd === "07-01"), false);
});

test("wage bulletin does not write labor until Save", () => {
  const before = parseLaborRules(undefined);
  assert.equal(before.minWageCents, null);
  const server = readFileSync("src/lib/saas/reg-bulletins.server.ts", "utf8");
  assert.match(server, /Never writes venue tax rows/);
  assert.doesNotMatch(server, /laborByEntity/);
  const laborUi = readFileSync("src/components/pos/LaborOpsView.tsx", "utf8");
  assert.match(laborUi, /Save wage rules/);
  assert.match(laborUi, /not applied until you Save/);
});

test("guide calendar copy", () => {
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.136/);
  const plat = readFileSync("src/components/platform/BulletinsWorkspace.tsx", "utf8");
  assert.match(plat, /data-reg-calendar/);
  assert.match(plat, /AI draft from URL/);
  const mig = readFileSync("migrations/0043_reg_calendar.sql", "utf8");
  assert.match(mig, /reg_review_tasks/);
});
