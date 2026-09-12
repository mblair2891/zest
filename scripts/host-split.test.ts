import test from "node:test";
import assert from "node:assert/strict";
import {
  hostSplitActive,
  isAppPlatformHostName,
  isMarketingPublicHostName,
  isPlatformPath,
  isSingleOriginHostName,
  marketingToPlatformHref,
} from "../src/lib/platform/host-split.ts";

test("apex and www are marketing; app. is the console", () => {
  assert.equal(isMarketingPublicHostName("summex.app"), true);
  assert.equal(isMarketingPublicHostName("www.summex.app"), true);
  assert.equal(isMarketingPublicHostName("app.summex.app"), false);
  assert.equal(isAppPlatformHostName("app.summex.app"), true);
  assert.equal(isAppPlatformHostName("summex.app"), false);
});

test("preview and local stay one origin", () => {
  assert.equal(isSingleOriginHostName("localhost"), true);
  assert.equal(isSingleOriginHostName("127.0.0.1"), true);
  assert.equal(hostSplitActive("localhost"), false);
  assert.equal(hostSplitActive("foo.grok-sandbox.com"), false);
  assert.equal(hostSplitActive("summex.app"), true);
  assert.equal(hostSplitActive("app.summex.app"), true);
});

test("platform paths include login, dashboard, stations", () => {
  assert.equal(isPlatformPath("/login"), true);
  assert.equal(isPlatformPath("/dashboard"), true);
  assert.equal(isPlatformPath("/station/order"), true);
  assert.equal(isPlatformPath("/pipeline"), true);
  assert.equal(isPlatformPath("/"), false);
  assert.equal(isPlatformPath("/guide"), false);
  assert.equal(isPlatformPath("/get-pricing"), false);
  assert.equal(isPlatformPath("/terms"), false);
  assert.equal(isPlatformPath("/privacy"), false);
  assert.equal(isPlatformPath("/gift"), false);
});

test("leftover /login on apex goes to app.summex.app", () => {
  assert.equal(
    marketingToPlatformHref("/login", "summex.app", "https:"),
    "https://app.summex.app/login",
  );
  assert.equal(
    marketingToPlatformHref("/login", "www.summex.app", "https:"),
    "https://app.summex.app/login",
  );
  assert.equal(marketingToPlatformHref("/login", "localhost", "http:"), null);
  assert.equal(marketingToPlatformHref("/", "summex.app", "https:"), null);
  assert.equal(marketingToPlatformHref("/terms", "summex.app", "https:"), null);
  assert.equal(marketingToPlatformHref("/privacy", "summex.app", "https:"), null);
  assert.equal(marketingToPlatformHref("/gift", "summex.app", "https:"), null);
  assert.equal(
    marketingToPlatformHref("/dashboard", "summex.app", "https:"),
    "https://app.summex.app/dashboard",
  );
  assert.equal(
    marketingToPlatformHref("/?station=order", "summex.app", "https:"),
    "https://app.summex.app/?station=order",
  );
  assert.equal(
    marketingToPlatformHref("/station", "summex.app", "https:"),
    "https://app.summex.app/station",
  );
  assert.equal(
    marketingToPlatformHref("/station?pair=ABCD12", "summex.app", "https:"),
    "https://app.summex.app/station?pair=ABCD12",
  );
});
