#!/usr/bin/env node
/**
 * Local sideload only. Play builds leave station empty (pair screen).
 * Usage: node scripts/android-config.mjs order|ods|host
 *        node scripts/android-config.mjs ods http://192.168.1.10:8080
 *        node scripts/android-config.mjs clear
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function normalizeStation(raw) {
  const s = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return "";
  if (s === "order" || s === "cashier" || s === "bar_pos" || s === "handheld")
    return "order";
  if (s === "ods" || s === "kitchen" || s === "bar" || s === "kds" || s === "expo") return "ods";
  if (s === "host" || s === "floor" || s === "waitlist" || s === "host_stand" || s === "busser")
    return "host";
  return s === "clear" || s === "none" || s === "-" ? "" : s;
}

const stationArg = (process.argv[2] || "").trim();
const urlArg = (process.argv[3] || "").trim();
const path = resolve("native/summex-native.json");
const cur = JSON.parse(readFileSync(path, "utf8"));
if (stationArg === "clear" || stationArg === "none" || stationArg === "-") {
  cur.station = "";
  cur.sideload = false;
} else if (stationArg) {
  cur.station = normalizeStation(stationArg);
  cur.sideload = true;
}
if (urlArg) {
  cur.url = urlArg.replace(/\/$/, "");
  cur.cleartext = cur.url.startsWith("http://");
}
writeFileSync(path, JSON.stringify(cur, null, 2) + "\n");
console.log("native/summex-native.json →", cur);
