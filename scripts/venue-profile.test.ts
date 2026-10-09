import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { locationShowsOlccStores } from "../src/lib/costs/olcc-stores.ts";
import { parseJurisdiction } from "../src/lib/pos/jurisdiction.ts";
import { venueDashboardTabs } from "../src/lib/saas/venue-dashboard-tabs.ts";
import { canEditVenueProfile, sameContactEmail } from "../src/lib/saas/venue-profile.ts";

test("peer location contact edits; another entity admin and a hosted entity admin only view", () => {
  assert.equal(
    canEditVenueProfile({
      peerVenue: true,
      entityAdmin: true,
      houseAdmin: false,
      locationContact: true,
    }),
    true,
  );
  assert.equal(
    canEditVenueProfile({
      peerVenue: true,
      entityAdmin: true,
      houseAdmin: false,
      locationContact: false,
    }),
    false,
  );
  assert.equal(
    canEditVenueProfile({
      peerVenue: false,
      entityAdmin: true,
      houseAdmin: false,
      locationContact: true,
    }),
    false,
  );
  assert.equal(
    canEditVenueProfile({
      peerVenue: true,
      entityAdmin: false,
      houseAdmin: true,
      locationContact: false,
    }),
    true,
  );
  assert.equal(
    canEditVenueProfile({
      peerVenue: false,
      entityAdmin: false,
      houseAdmin: true,
      locationContact: false,
    }),
    true,
  );
});

test("contact email match is case-insensitive and empty emails do not match", () => {
  assert.equal(sameContactEmail("Ada@Venue.com", " ada@venue.com "), true);
  assert.equal(sameContactEmail("", "ada@venue.com"), false);
  assert.equal(sameContactEmail("a@b.co", ""), false);
  assert.equal(sameContactEmail("  ", "  "), false);
});

test("Oregon state opens liquor stores; an empty state does not", () => {
  assert.equal(locationShowsOlccStores(parseJurisdiction({ state: "OR" }).state), true);
  assert.equal(locationShowsOlccStores(parseJurisdiction({ state: "Oregon" }).state), true);
  assert.equal(locationShowsOlccStores(parseJurisdiction({}).state), false);
  assert.equal(locationShowsOlccStores(parseJurisdiction({ state: "WA" }).state), false);
});

test("entity admin tabs include Settings", () => {
  const dash = readFileSync("src/lib/saas/password-dash.ts", "utf8");
  const tabs = dash.slice(dash.indexOf("export function passwordDashTabs"));
  const owner = tabs.slice(tabs.indexOf('case "entity_owner"'), tabs.indexOf('case "entity_manager"'));
  const mgr = tabs.slice(tabs.indexOf('case "entity_manager"'), tabs.indexOf('case "host_manager"'));
  assert.match(owner, /\["settings", "Settings"\]/);
  assert.match(mgr, /\["settings", "Settings"\]/);
  const peer = venueDashboardTabs({ audience: "entity", operatingModel: "peer_venue" }).map(
    ([id]) => id,
  );
  assert.equal(peer[0], "overview");
  assert.equal(peer[1], "settings");
  assert.equal(peer.includes("devices"), false);
  const hosted = venueDashboardTabs({ audience: "entity", operatingModel: "host_operators" }).map(
    ([id]) => id,
  );
  assert.equal(hosted[1], "settings");
});

test("entity settings panel writes the venue state and does not use updateSettings", () => {
  const panel = readFileSync("src/components/platform/VenueProfileSettings.tsx", "utf8");
  assert.match(panel, /data-venue-settings/);
  assert.match(panel, /data-venue-state/);
  assert.match(panel, /data-venue-entities/);
  assert.match(panel, /disabled=\{!canEdit\}/);
  assert.match(panel, /data-venue-settings-mode=\{canEdit \? "edit" : "view"\}/);
  assert.match(panel, /usePosStore\.setState\(/);
  assert.match(panel, /jurisdiction/);
  assert.match(panel, /saveVenueProfileFn/);
  assert.doesNotMatch(panel, /updateSettings/);
  assert.match(panel, /State Oregon lists liquor stores on Suppliers/);
  assert.match(panel, /You can view the venue\. The location contact can change it/);
  assert.match(panel, /A hosted venue keeps these settings on the host/);

  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(
    venue,
    /tab === "settings"[\s\S]{0,220}isEntityPasswordKind\(kind\)[\s\S]{0,200}VenueProfileSettings/,
  );
  assert.match(venue, /parseJurisdiction\(setup\.jurisdiction\)/);

  const api = readFileSync("src/lib/access/api.ts", "utf8");
  const fn = api.slice(api.indexOf("export const saveVenueProfileFn"), api.indexOf("export const saveOperatorPayoutFn"));
  assert.match(fn, /saveVenueProfileForUser/);
  assert.doesNotMatch(fn, /assertHostOrgWrite/);

  const tenancy = readFileSync("src/lib/saas/tenancy.server.ts", "utf8");
  const save = tenancy.slice(
    tenancy.indexOf("export async function saveVenueProfileForUser"),
    tenancy.indexOf("export async function listLocationsForOrg"),
  );
  assert.match(save, /canEditVenueProfile/);
  assert.match(save, /The location contact edits the venue/);
  assert.match(save, /contact_email/);
  assert.match(save, /set name =/);
  assert.match(save, /address =/);
  assert.match(save, /jurisdiction/);
});
