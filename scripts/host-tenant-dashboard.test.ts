import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canEditSchedule, isHostPrivileged } from "../src/lib/access/entity-grants.ts";
import {
  isHostOperatorsModel,
  venueDashboardTabs,
} from "../src/lib/saas/venue-dashboard-tabs.ts";

test("host+tenant password dashboard has full tenant ops tabs", () => {
  const tabs = venueDashboardTabs({ audience: "owner", operatingModel: "host_operators" });
  const ids = tabs.map(([id]) => id);
  for (const need of [
    "devices",
    "floor",
    "menu",
    "reports",
    "costs",
    "labor",
    "payments",
    "grants",
  ]) {
    assert.ok(ids.includes(need as (typeof ids)[number]), `missing ${need}`);
  }
  assert.ok(!ids.includes("people"));
});

test("tenant entity login is own slice only", () => {
  const tabs = venueDashboardTabs({ audience: "entity", operatingModel: "host_operators" });
  const ids = tabs.map(([id]) => id);
  assert.deepEqual(ids, ["overview", "menu", "costs", "schedule", "reports", "staff"]);
  assert.ok(!ids.includes("devices"));
  assert.ok(!ids.includes("grants"));
  assert.ok(!ids.includes("payments"));
});

test("peer venue admin is not a host/landlord dashboard", () => {
  assert.equal(isHostOperatorsModel("peer_venue", true), false);
  assert.equal(isHostOperatorsModel("host_operators", false), true);
  const tabs = venueDashboardTabs({ audience: "owner", operatingModel: "peer_venue" });
  const ids = tabs.map(([id]) => id);
  assert.ok(ids.includes("devices"));
  assert.ok(ids.includes("menu"));
  assert.ok(ids.includes("payments"));
  assert.ok(!ids.includes("floor"));
  assert.ok(!ids.includes("grants"));
  assert.ok(!ids.includes("labor"));
  assert.ok(!ids.includes("costs"));
});

test("host owner/manager can edit every tenant schedule without a flag", () => {
  const host = { role: "owner" as const, operatorId: undefined };
  assert.equal(isHostPrivileged(host), true);
  assert.equal(canEditSchedule(host, [], "op_tenant", false, false), true);
  const tenant = { role: "vendor_operator" as const, operatorId: "op_a" };
  assert.equal(canEditSchedule(tenant, [], "op_a", false, false), true);
  assert.equal(canEditSchedule(tenant, [], "op_b", false, false), false);
});

test("password venue shell never gates a PIN pad", () => {
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /pinGate: false/);
  assert.match(venue, /loginAsOwner/);
  assert.match(venue, /loginAsEntityAdmin/);
  assert.match(venue, /venueDashboardTabs/);
  assert.doesNotMatch(venue, /pinGate: true/);
});
