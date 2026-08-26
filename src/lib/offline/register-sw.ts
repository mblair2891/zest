const LAST_POS_PATH = "summex-last-pos-path";

export function rememberLastPosPath(): void {
  if (typeof window === "undefined") return;
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (path.startsWith("/app") || path.startsWith("/venue")) {
      localStorage.setItem(LAST_POS_PATH, path);
    }
  } catch {
    /* ignore */
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    );
  } catch {
    return false;
  }
}

/** If an installed PWA opens at / while offline, bounce to the last primed POS. */
export function redirectStandaloneOfflineHome(): void {
  if (typeof window === "undefined") return;
  if (navigator.onLine) return;
  if (!isStandalone()) return;
  const path = window.location.pathname;
  if (path !== "/" && path !== "") return;
  try {
    const last = localStorage.getItem(LAST_POS_PATH);
    if (last && last !== "/") window.location.replace(last);
  } catch {
    /* ignore */
  }
}

export function registerOfflineServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  redirectStandaloneOfflineHome();
  const start = () => {
    void navigator.serviceWorker
      .register("/offline-sw.js", { updateViaCache: "none", scope: "/" })
      .catch(() => undefined);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
