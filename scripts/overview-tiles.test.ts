import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("overview labor and costs tabs exist on venue dashboards", () => {
  const tabs = readFileSync("src/lib/saas/venue-dashboard-tabs.ts", "utf8");
  assert.match(tabs, /\["labor", "Labor"\]/);
  assert.match(tabs, /\["costs", "Costs"\]/);
  const dash = readFileSync("src/lib/saas/password-dash.ts", "utf8");
  const fn = dash.slice(dash.indexOf("export function passwordDashTabs"));
  assert.match(fn, /case "venue_admin":[\s\S]*\["labor", "Labor"\]/);
  assert.match(fn, /case "venue_admin":[\s\S]*\["costs", "Costs"\]/);
  assert.match(fn, /case "host_manager":[\s\S]*\["labor", "Labor"\]/);
});

test("labor and costs tiles open real views, not a blank route", () => {
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /tab === "labor"/);
  assert.match(venue, /<LaborOpsView/);
  assert.match(venue, /tab === "costs"/);
  assert.match(venue, /<CostWorkspace/);
  assert.match(venue, /PackageEmptyState/);
  assert.doesNotMatch(venue, /to: "\/labor"/);
  assert.doesNotMatch(venue, /to: "\/costs"/);
  const overview = readFileSync("src/components/platform/TenantVenueOverview.tsx", "utf8");
  assert.match(overview, /\["labor", "Labor"/);
  assert.match(overview, /\["costs", "Costs"/);
  const empty = readFileSync("src/components/platform/PackageEmptyState.tsx", "utf8");
  assert.match(empty, /Not on this package/);
});
