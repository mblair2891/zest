import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("platform Home opens the console dashboard from a tenant floor", () => {
  const link = readFileSync("src/components/platform/PlatformHomeLink.tsx", "utf8");
  assert.match(link, /PLATFORM_HOME_TO = "\/dashboard"/);
  assert.match(link, /data-platform-home/);
  assert.match(link, /to: PLATFORM_HOME_TO/);
  assert.doesNotMatch(link, /openLocationPos|summex\.app/);

  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /PlatformHomeLink/);
  const headerAt = venue.indexOf("<header");
  const floorAt = venue.indexOf('tab === "floor"');
  assert.ok(headerAt > 0 && floorAt > headerAt);

  const app = readFileSync("src/components/pos/PlatformApp.tsx", "utf8");
  assert.match(app, /PlatformHomeLink/);
  assert.match(app, /setSurface\("home"\)/);

  const tenants = readFileSync("src/routes/platform.tenants.index.tsx", "utf8");
  assert.match(tenants, /PlatformHomeLink/);
  const pipeline = readFileSync("src/routes/pipeline.tsx", "utf8");
  assert.match(pipeline, /PlatformHomeLink/);
  const setup = readFileSync("src/routes/setup.$token.tsx", "utf8");
  assert.match(setup, /PlatformHomeLink/);
});
