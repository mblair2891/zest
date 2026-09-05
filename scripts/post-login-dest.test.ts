import test from "node:test";
import assert from "node:assert/strict";
import {
  isMarketingStayPath,
  postLoginDestination,
} from "../src/lib/auth/post-login-dest.ts";
import { sanitizeNextPath } from "../src/lib/auth/safe-next-path.ts";

test("admin always goes to the platform dashboard", () => {
  const dest = postLoginDestination({
    isPlatformAdmin: true,
    orgs: [{ id: "org_1" }],
    locations: [{ id: "loc_1", venueType: "restaurant" }],
    active: { locationId: "loc_1" },
  });
  assert.deepEqual(dest, { to: "/dashboard" });
});

test("venue owner with a location goes to that house", () => {
  const dest = postLoginDestination({
    isPlatformAdmin: false,
    orgs: [{ id: "org_1" }],
    locations: [{ id: "loc_1", venueType: "food_hall" }],
    active: { locationId: "loc_1" },
  });
  assert.deepEqual(dest, {
    to: "/venue/$type",
    type: "food_hall",
    loc: "loc_1",
  });
});

test("owner with no location and no org goes to get a price", () => {
  const dest = postLoginDestination({
    isPlatformAdmin: false,
    orgs: [],
    locations: [],
    active: null,
  });
  assert.deepEqual(dest, { to: "/get-pricing" });
});

test("sales home is never a post-login stay path", () => {
  assert.equal(isMarketingStayPath("/"), true);
  assert.equal(isMarketingStayPath("/demo"), true);
  assert.equal(isMarketingStayPath("/dashboard"), false);
  assert.equal(isMarketingStayPath("/venue/restaurant"), false);
});

test("sanitizeNextPath drops the sales home and keeps station/venue", () => {
  assert.equal(sanitizeNextPath("/"), null);
  assert.equal(sanitizeNextPath("/login"), null);
  assert.ok(sanitizeNextPath("/venue/restaurant?loc=loc_1")?.includes("loc="));
  assert.equal(sanitizeNextPath("/station/ods"), "/station/ods");
  assert.equal(sanitizeNextPath("/station/host?loc=loc_1"), "/station/host?loc=loc_1");
});
