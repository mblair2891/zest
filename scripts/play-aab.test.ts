import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Play AAB is generic station shell — no baked order role", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["android:bundle"], "node scripts/android-bundle.mjs");
  const bundle = readFileSync("scripts/android-bundle.mjs", "utf8");
  assert.match(bundle, /app-release\.aab/);
  assert.match(bundle, /https:\/\/app\.summex\.app\/station/);
  assert.doesNotMatch(bundle, /android-config\.mjs"/);
  assert.doesNotMatch(bundle, /node scripts\/android-config/);
  assert.match(bundle, /station: ""/);
  const cfg = readFileSync("scripts/android-config.mjs", "utf8");
  assert.match(cfg, /SUMMEX_PLAY_BUNDLE/);
  assert.match(cfg, /must NOT run this/);
  const native = JSON.parse(readFileSync("native/summex-native.json", "utf8"));
  assert.equal(native.url, "https://app.summex.app");
  assert.equal(native.station, "");
  assert.equal(native.sideload, false);
  assert.equal(native.cleartext, false);
  const cap = JSON.parse(readFileSync("android/app/src/main/assets/capacitor.config.json", "utf8"));
  assert.equal(cap.appId, "app.summex.pos");
  assert.equal(cap.server.url, "https://app.summex.app/station");
  assert.equal(cap.server.cleartext, false);
  assert.equal(cap.android.allowMixedContent, false);
});

test("Play network is HTTPS only; camera optional; upload keystore documented", () => {
  const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  assert.match(manifest, /usesCleartextTraffic="false"/);
  assert.match(manifest, /android.hardware.camera" android:required="false"/);
  const net = readFileSync("android/app/src/main/res/xml/network_security_config.xml", "utf8");
  assert.match(net, /cleartextTrafficPermitted="false"/);
  const vars = readFileSync("android/variables.gradle", "utf8");
  assert.match(vars, /targetSdkVersion = 36/);
  assert.match(vars, /minSdkVersion = 24/);
  const gradle = readFileSync("android/app/build.gradle", "utf8");
  assert.match(gradle, /applicationId "app.summex.pos"/);
  assert.match(gradle, /keystore.properties/);
  const example = readFileSync("android/keystore.example", "utf8");
  assert.match(example, /upload-keystore\.jks/);
  assert.match(example, /Never commit secrets/);
  const ignore = readFileSync(".gitignore", "utf8");
  assert.match(ignore, /keystore\.properties/);
  assert.match(ignore, /\*\.jks/);
  const strings = readFileSync("android/app/src/main/res/values/strings.xml", "utf8");
  assert.match(strings, /https:\/\/www\.summex\.app\/privacy/);
});
