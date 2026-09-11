import type { CapacitorConfig } from "@capacitor/cli";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Summex Station native shell.
 * Play / store: generic https://app.summex.app/station (pair first).
 * Never marketing apex, never /login, never a baked station role.
 * android-config is local debug only (LAN + optional /station/{role}).
 */

const STORE_ORIGIN = "https://app.summex.app";

type NativeFile = { url?: string; station?: string; cleartext?: boolean; sideload?: boolean };

function loadNativeFile(): NativeFile {
  const p = resolve("native/summex-native.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as NativeFile;
  } catch {
    return {};
  }
}

function nativeStationRole(raw: string): "order" | "ods" | "host" | "" {
  const s = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "order" || s === "cashier" || s === "bar_pos" || s === "handheld") return "order";
  if (s === "ods" || s === "kitchen" || s === "bar" || s === "kds" || s === "expo") return "ods";
  if (s === "host" || s === "floor" || s === "waitlist" || s === "host_stand" || s === "busser")
    return "host";
  return "";
}

/** Staff WebView origin. Marketing apex is never the station host. */
function staffOrigin(raw: string): string {
  const trimmed = (raw || "").replace(/\/$/, "");
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = u.hostname.toLowerCase();
    if (host === "summex.app" || host === "www.summex.app") return STORE_ORIGIN;
    return `${u.protocol}//${u.host}`;
  } catch {
    return STORE_ORIGIN;
  }
}

const file = loadNativeFile();
const baseUrl = (
  process.env.SUMMEX_NATIVE_URL ||
  file.url ||
  STORE_ORIGIN
).replace(/\/$/, "");

const stationRaw = (process.env.SUMMEX_STATION || file.station || "").trim();
const sideload = process.env.SUMMEX_SIDELOAD === "1" || file.sideload === true;
const station = nativeStationRole(stationRaw);
const origin = staffOrigin(baseUrl.replace(/\/apps$/i, "") || baseUrl);

// Play / store APK: generic /station (pair first). Sideload may bake a station role.
let serverUrl = `${origin}/station`;
if (sideload && station) {
  // Local debug only — never marketing apex, never /login.
  serverUrl = `${origin}/station/${encodeURIComponent(station)}`;
}

const cleartext =
  process.env.SUMMEX_CLEARTEXT === "1" ||
  file.cleartext === true ||
  serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "app.summex.pos",
  appName: "Summex Station",
  webDir: "native/www",
  backgroundColor: "#0a0c0b",
  server: {
    url: serverUrl,
    cleartext,
    androidScheme: "https",
    allowNavigation: ["summex.app", "*.summex.app"],
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#0a0c0b",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0a0c0b",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0c0b",
      overlaysWebView: true,
    },
  },
};

export default config;
