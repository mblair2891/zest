/**
 * Optional lock-task / pin-windows after the tablet is paired.
 * Unpaired pair screen stays unlocked so camera / QR scan can run.
 * Exit uses the Capacitor StationKiosk plugin, then the WebView bridge.
 */
import { registerPlugin } from "@capacitor/core";

type StationKioskPlugin = {
  exit: () => Promise<void>;
  reload: () => Promise<void>;
};

const StationKiosk = registerPlugin<StationKioskPlugin>("StationKiosk");

type SummexKioskBridge = {
  startLock?: () => void;
  reloadStation?: () => void;
  exitKiosk?: () => void;
};

function bridge(): SummexKioskBridge | null {
  if (typeof window === "undefined") return null;
  try {
    return (window as unknown as { SummexKiosk?: SummexKioskBridge }).SummexKiosk ?? null;
  } catch {
    return null;
  }
}

export function hasNativeKioskBridge(): boolean {
  return Boolean(bridge()?.reloadStation || bridge()?.startLock);
}

export function requestKioskLock(): void {
  try {
    bridge()?.startLock?.();
  } catch {
    /* web / no native bridge */
  }
}

/** Load the station URL in the WebView. Pairing in localStorage is kept. Never /login. */
export function reloadStationWebView(): void {
  void StationKiosk.reload().catch(() => {
    try {
      bridge()?.reloadStation?.();
    } catch {
      /* web / no native bridge */
    }
  });
}

/**
 * Stop lock-task. The shell returns to Android home.
 * Caller logs the station back to the PIN pad if the WebView stays up.
 * Manager / service PIN is checked before this runs. Staff PINs never get here.
 */
export function exitStationKiosk(): void {
  void StationKiosk.exit().catch(() => {
    try {
      bridge()?.exitKiosk?.();
    } catch {
      /* web / no native bridge */
    }
  });
  try {
    bridge()?.exitKiosk?.();
  } catch {
    /* already attempted via the plugin */
  }
}
