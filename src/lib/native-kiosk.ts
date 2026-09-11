/**
 * Optional lock-task / pin-windows after the tablet is paired.
 * Unpaired pair screen stays unlocked so camera / QR scan can run.
 */
export function requestKioskLock(): void {
  if (typeof window === "undefined") return;
  try {
    const k = (window as unknown as { SummexKiosk?: { startLock?: () => void } }).SummexKiosk;
    k?.startLock?.();
  } catch {
    /* web / no native bridge */
  }
}
