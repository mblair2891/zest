#!/usr/bin/env node
/**
 * Update native/zest-native.json station (and optional url).
 * Usage: node scripts/android-config.mjs kitchen
 *        node scripts/android-config.mjs floor http://192.168.1.10:8080
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const station = (process.argv[2] || "").trim();
const urlArg = (process.argv[3] || "").trim();
const path = resolve("native/zest-native.json");
const cur = JSON.parse(readFileSync(path, "utf8"));
if (station === "clear" || station === "none" || station === "-") {
  cur.station = "";
} else if (station) {
  cur.station = station;
}
if (urlArg) {
  cur.url = urlArg.replace(/\/$/, "");
  cur.cleartext = cur.url.startsWith("http://");
}
writeFileSync(path, JSON.stringify(cur, null, 2) + "\n");
console.log("native/zest-native.json →", cur);
