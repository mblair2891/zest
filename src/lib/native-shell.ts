/**
 * Capacitor / Android shell helpers (no-ops on web).
 */
import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function nativePlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
}

/** Call once after mount in POS — status bar + splash polish on Android. */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#0a0c0b" });
  } catch {
    /* plugin optional at runtime */
  }
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* ignore */
  }
}
