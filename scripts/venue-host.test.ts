import test from "node:test";
import assert from "node:assert/strict";
import {
  canUseVenueSubdomain,
  isReservedVenueSlug,
  suggestVenueSlug,
  venuePosHref,
  venuePosPath,
  venueSlugFromHost,
  venueSlugFromPath,
  venueSubdomainHost,
} from "../src/lib/platform/venue-host.ts";

test("reserved slugs are blocked", () => {
  assert.equal(isReservedVenueSlug("www"), true);
  assert.equal(isReservedVenueSlug("app"), true);
  assert.equal(isReservedVenueSlug("api"), true);
  assert.equal(isReservedVenueSlug("login"), true);
  assert.equal(isReservedVenueSlug("the-laundry"), false);
  assert.equal(suggestVenueSlug("App"), "v-app");
  assert.equal(suggestVenueSlug("The Laundry"), "the-laundry");
});

test("host parser reads venue subdomain and ignores reserved", () => {
  assert.equal(venueSlugFromHost("the-laundry.summex.app"), "the-laundry");
  assert.equal(venueSlugFromHost("www.summex.app"), null);
  assert.equal(venueSlugFromHost("app.summex.app"), null);
  assert.equal(venueSlugFromHost("foo.bar.summex.app"), null);
  assert.equal(venueSlugFromPath("/v/the-laundry"), "the-laundry");
  assert.equal(venueSlugFromPath("/v/www"), null);
});

test("production uses subdomain; preview uses /v/{slug}", () => {
  assert.equal(canUseVenueSubdomain("www.summex.app"), true);
  assert.equal(canUseVenueSubdomain("localhost"), false);
  assert.equal(canUseVenueSubdomain("foo.vercel.app"), false);
  assert.equal(venueSubdomainHost("The Laundry"), "the-laundry.summex.app");
  assert.equal(
    venuePosHref("the-laundry", "www.summex.app"),
    "https://the-laundry.summex.app/",
  );
  assert.equal(venuePosHref("the-laundry", "localhost:8080"), venuePosPath("the-laundry"));
});
