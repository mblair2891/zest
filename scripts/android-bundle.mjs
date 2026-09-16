#!/usr/bin/env node
/**
 * Play Store AAB. Generic station shell at https://app.summex.app/station.
 * Pair code first. Does NOT run android-config.mjs (never bake station=order).
 *
 *   npm run android:bundle
 *   → android/app/build/outputs/bundle/release/app-release.aab
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const NATIVE = resolve("native/summex-native.json");
const STORE = {
  url: "https://app.summex.app",
  station: "",
  cleartext: false,
  sideload: false,
  _comment:
    "Play/store default: https://app.summex.app/station (pair code first; QR optional). Never bake station=order. android-config.mjs is local debug only — npm run android:bundle must not run it.",
};

const prev = existsSync(NATIVE) ? readFileSync(NATIVE, "utf8") : "";
writeFileSync(NATIVE, JSON.stringify(STORE, null, 2) + "\n");

try {
  execSync("node scripts/patch-capacitor-java17.mjs", { stdio: "inherit" });
  execSync("npx cap sync android", {
    stdio: "inherit",
    env: { ...process.env, SUMMEX_SIDELOAD: "0", SUMMEX_PLAY_BUNDLE: "1" },
  });
  execSync("./gradlew bundleRelease", { cwd: resolve("android"), stdio: "inherit" });
} finally {
  if (prev) writeFileSync(NATIVE, prev.endsWith("\n") ? prev : `${prev}\n`);
}

const aab = "android/app/build/outputs/bundle/release/app-release.aab";
if (!existsSync(resolve(aab))) {
  console.error(`Missing ${aab}. Install Android SDK / JDK 17 and retry.`);
  process.exit(1);
}
console.log(`Play AAB → ${aab}`);
console.log("WebView: https://app.summex.app/station (pair code first). HTTPS only. No baked station role.");
