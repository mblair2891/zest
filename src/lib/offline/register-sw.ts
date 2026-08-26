const LAST_POS_PATH = "summex-last-pos-path";

export function rememberLastPosPath(): void {
  if (typeof window === "undefined") return;
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (
      path.startsWith("/app") ||
      path.startsWith("/venue") ||
      path.startsWith("/station")
    ) {
      localStorage.setItem(LAST_POS_PATH, path.startsWith("/station") ? "/station" : path);
    }
    const sw = navigator.serviceWorker?.controller;
    sw?.postMessage({ type: "CACHE_POS", url: window.location.href });
  } catch {
    /* ignore */
  }
}

function useStationManifest(): void {
  try {
    const path = window.location.pathname;
    if (!path.startsWith("/venue") && !path.startsWith("/app") && !path.startsWith("/station")) {
      return;
    }
    const links = document.querySelectorAll('link[rel="manifest"]');
    if (links.length === 0) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/station.webmanifest";
      document.head.appendChild(link);
      return;
    }
    links.forEach((el) => {
      el.setAttribute("href", "/station.webmanifest");
    });
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

/** Installed home-screen icon opens the station — no typing a URL. */
export function redirectStandaloneToStation(): void {
  if (typeof window === "undefined") return;
  if (!isStandalone()) return;
  const path = window.location.pathname;
  if (path !== "/" && path !== "") return;
  try {
    const last = localStorage.getItem(LAST_POS_PATH);
    window.location.replace(last && last !== "/" ? last : "/station");
  } catch {
    window.location.replace("/station");
  }
}

export function registerOfflineServiceWorker(): void {
  if (typeof window === "undefined") return;
  useStationManifest();
  redirectStandaloneToStation();
  if (!("serviceWorker" in navigator)) return;
  const start = () => {
    void navigator.serviceWorker
      .register("/offline-sw.js", { updateViaCache: "none", scope: "/" })
      .then((reg) => {
        const url = `${window.location.origin}/station`;
        reg.active?.postMessage({ type: "CACHE_POS", url });
        navigator.serviceWorker.controller?.postMessage({
          type: "CACHE_POS",
          url: window.location.href,
        });
      })
      .catch(() => undefined);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
