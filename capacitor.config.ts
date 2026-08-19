import type { CapacitorConfig } from "@capacitor/cli";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Zest native shell — defaults to App Store (/apps).
 */

type NativeFile = { url?: string; station?: string; cleartext?: boolean };

function loadNativeFile(): NativeFile {
  const p = resolve("native/zest-native.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as NativeFile;
  } catch {
    return {};
  }
}

const file = loadNativeFile();
let baseUrl = (
  process.env.ZEST_NATIVE_URL ||
  file.url ||
  "http://10.0.2.2:8080/apps"
).replace(/\/$/, "");

const station = (process.env.ZEST_STATION || file.station || "").trim();

// If station set, open POS with station query (not the store)
let serverUrl = baseUrl;
if (station) {
  // strip trailing /apps if present
  const origin = baseUrl.replace(/\/apps$/i, "") || baseUrl;
  serverUrl = `${origin}/?station=${encodeURIComponent(station)}`;
} else if (!/\/apps$/i.test(baseUrl) && !/[?&]/.test(baseUrl)) {
  // default shell → store
  if (!baseUrl.endsWith("/apps")) {
    serverUrl = `${baseUrl}/apps`;
  }
}

const cleartext =
  process.env.ZEST_CLEARTEXT === "1" ||
  file.cleartext === true ||
  serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "app.zest.pos",
  appName: "Zest",
  webDir: "native/www",
  backgroundColor: "#0a0c0b",
  server: {
    url: serverUrl,
    cleartext,
    androidScheme: "https",
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
    },
  },
};

export default config;
