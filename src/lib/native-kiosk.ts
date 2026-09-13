/**
 * Optional lock-task / pin-windows after the tablet is paired.
 * Unpaired pair screen stays unlocked so camera / QR scan can run.
 */
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
  try {
    bridge()?.reloadStation?.();
  } catch {
    /* web / no native bridge */
  }
}

/** Stop lock-task and send the tablet to Android home. Manager/service only. */
export function exitStationKiosk(): void {
  try {
    bridge()?.exitKiosk?.();
  } catch {
    /* web / no native bridge */
  }
}
