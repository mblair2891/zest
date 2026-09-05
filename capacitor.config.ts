import type { CapacitorConfig } from "@capacitor/cli";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Summex native shell — defaults to App Store (/apps).
 */

type NativeFile = { url?: string; station?: string; cleartext?: boolean };

function loadNativeFile(): NativeFile {
  const p = resolve("native/summex-native.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as NativeFile;
  } catch {
    return {};
  }
}

const file = loadNativeFile();
let baseUrl = (
  process.env.SUMMEX_NATIVE_URL ||
  file.url ||
  "http://10.0.2.2:8080/apps"
).replace(/\/$/, "");

const stationRaw = (process.env.SUMMEX_STATION || file.station || "").trim();

function nativeStationRole(raw: string): "order" | "ods" | "host" | "" {
  const s = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "order" || s === "cashier" || s === "bar_pos" || s === "handheld") return "order";
  if (s === "ods" || s === "kitchen" || s === "bar" || s === "kds" || s === "expo") return "ods";
  if (s === "host" || s === "floor" || s === "waitlist" || s === "host_stand" || s === "busser")
    return "host";
  return "";
}

// Station APK: PIN pad for host | order | ods. Guest QR stays in the browser.
let serverUrl = baseUrl;
const station = nativeStationRole(stationRaw) || (stationRaw ? "order" : "");
if (station) {
  const origin = (baseUrl.replace(/\/apps$/i, "") || baseUrl).replace(/\/$/, "");
  serverUrl = `${origin}/?station=${encodeURIComponent(station)}`;
} else if (!/\/apps$/i.test(baseUrl) && !/[?&]/.test(baseUrl)) {
  if (!baseUrl.endsWith("/apps")) {
    serverUrl = `${baseUrl}/apps`;
  }
}

const cleartext =
  process.env.SUMMEX_CLEARTEXT === "1" ||
  file.cleartext === true ||
  serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "app.summex.pos",
  appName: "Summex",
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
