/**
 * Optional lock-task / pin-windows after the tablet is paired.
 * Unpaired pair screen stays unlocked so camera / QR scan can run.
 * Exit uses the Capacitor StationKiosk plugin, then the WebView bridge.
 */
import { registerPlugin } from "@capacitor/core";

type StationKioskPlugin = {
  exit: () => Promise<{ unpinned?: boolean }>;
  reload: () => Promise<void>;
};

export const KIOSK_UNPIN_HINT =
  "Pinning is on in Android settings — unpin from the recents/pin screen";

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
 * Stop lock-task and leave the station shell.
 * Returns unpinned=false when Android keeps the task pinned (not device-owner).
 * The activity still sends Home and drops immersive bars in that case.
 * Manager / service PIN is checked before this runs. Staff PINs never get here.
 */
export async function exitStationKiosk(): Promise<{ unpinned: boolean }> {
  let unpinned = false;
  try {
    const res = await StationKiosk.exit();
    unpinned = Boolean(res?.unpinned);
  } catch {
    try {
      bridge()?.exitKiosk?.();
    } catch {
      /* web / no native bridge */
    }
  }
  if (unpinned) {
    try {
      const { App } = await import("@capacitor/app");
      await App.exitApp();
    } catch {
      /* activity already finished */
    }
  }
  return { unpinned };
}
