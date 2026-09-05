/**
 * Canonical Summex surfaces.
 *
 * Production:
 *   summex.app              marketing + login + merchant dashboard
 *   app.summex.app          shared POS / admin application (no per-tenant hosts)
 *   api.summex.app          HTTP API
 *   sites.summex.app        guest-facing (ordering, location sites) — later
 *   order.restaurant.com  custom domain → sites.summex.app (later)
 *
 * Local / live preview (single origin): path prefixes stand in for hosts.
 *   /                     marketing
 *   /login /dashboard     merchant login + dashboard
 *   /app                  application
 *   /api                  API
 *   /sites                guest platform
 */

export type SummexSurface = "marketing" | "app" | "api" | "sites";

export const SUMMEX_HOSTS = {
  marketing: "summex.app",
  app: "app.summex.app",
  api: "api.summex.app",
  sites: "sites.summex.app",
} as const;

function readEnvHost(name: string): string {
  const vite =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined>)[name]
      : undefined;
  const node =
    typeof process !== "undefined" ? process.env[name] : undefined;
  return (vite || node || "").replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
}

function envHost(name: string, fallback: string): string {
  return readEnvHost(name) || fallback;
}

/** App host only when VITE_APP_HOST is set. Empty means POS stays on this origin. */
export function explicitAppHost(): string {
  return readEnvHost("VITE_APP_HOST");
}

export function configuredHosts() {
  return {
    marketing: envHost("VITE_MARKETING_HOST", SUMMEX_HOSTS.marketing),
    app: explicitAppHost() || SUMMEX_HOSTS.app,
    api: envHost("VITE_API_HOST", SUMMEX_HOSTS.api),
    sites: envHost("VITE_SITES_HOST", SUMMEX_HOSTS.sites),
  };
}

export function stripPort(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? host.toLowerCase();
}

/** Single-origin mode: localhost, loopback, grok preview, or unset split DNS. */
export function isSingleOriginHost(hostname: string): boolean {
  const h = stripPort(hostname);
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "[::1]" ||
    h.endsWith(".grok-sandbox.com") ||
    h.endsWith(".grok.me") ||
    h.endsWith(".vercel.app")
  );
}

/**
 * www / apex marketing hosts. Never POS — even if VITE_APP_HOST is this host
 * or app.summex.app is unset/unserved.
 */
export function isMarketingPublicHost(hostname: string): boolean {
  const h = stripPort(hostname);
  if (!h) return true;
  if (h.startsWith("app.") || h.startsWith("api.") || h.startsWith("sites.")) return false;
  const names = new Set<string>();
  const add = (raw: string) => {
    const x = stripPort(raw);
    if (!x) return;
    names.add(x);
    if (!x.startsWith("www.")) names.add(`www.${x}`);
  };
  add(SUMMEX_HOSTS.marketing);
  add(configuredHosts().marketing);
  return names.has(h);
}

export function surfaceFromHost(hostname: string): SummexSurface | null {
  const h = stripPort(hostname);
  if (isMarketingPublicHost(h)) return "marketing";
  const cfg = configuredHosts();
  const app = explicitAppHost();
  if (h.startsWith("app.") || (app && hostsEqual(h, app))) return "app";
  if (h === cfg.api || h.startsWith("api.")) return "api";
  if (h === cfg.sites || h.startsWith("sites.")) return "sites";
  return null;
}

export function surfaceFromPath(pathname: string): SummexSurface | null {
  if (pathname === "/api" || pathname.startsWith("/api/")) return "api";
  if (pathname === "/app" || pathname.startsWith("/app/")) return "app";
  if (pathname === "/sites" || pathname.startsWith("/sites/")) return "sites";
  if (pathname.startsWith("/venue/") || pathname === "/kiosk" || pathname === "/station" || pathname.startsWith("/station/"))
    return "app";
  return null;
}

export function resolveSurface(hostname: string, pathname: string): SummexSurface {
  const fromPath = surfaceFromPath(pathname);
  // Same-origin POS on www: /venue, /app, /kiosk stay app. Bare `/` never does.
  if (fromPath === "app" || fromPath === "api" || fromPath === "sites") return fromPath;
  if (isMarketingPublicHost(hostname)) return "marketing";
  return surfaceFromHost(hostname) ?? fromPath ?? "marketing";
}

export function currentHostname(): string {
  if (typeof window !== "undefined") return window.location.host;
  return "localhost:8080";
}

export function currentOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return fallbackOrigin();
}

function envAppUrl(): string {
  const vite =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined>).VITE_APP_URL
      : undefined;
  const node =
    typeof process !== "undefined"
      ? process.env.APP_URL || process.env.BETTER_AUTH_URL
      : undefined;
  return (vite || node || "").replace(/\/$/, "");
}

function fallbackOrigin(): string {
  return envAppUrl() || "http://127.0.0.1:8080";
}

function protocol(): string {
  if (typeof window !== "undefined") return window.location.protocol;
  return fallbackOrigin().startsWith("https") ? "https:" : "http:";
}

function hostsEqual(a: string, b: string): boolean {
  const x = stripPort(a);
  const y = stripPort(b);
  return x === y || x === `www.${y}` || y === `www.${x}`;
}

/**
 * Distinct live app host: VITE_APP_HOST is set, is not this deploy, and is not
 * the unserved default app.summex.app (DEPLOYMENT_NOT_FOUND).
 * Unset, preview, or www/marketing → POS stays here.
 */
export function appHostIsLiveAndDistinct(currentHostname?: string): boolean {
  const app = explicitAppHost();
  if (!app) return false;
  if (hostsEqual(app, SUMMEX_HOSTS.app)) return false;
  const here =
    currentHostname ||
    (typeof window !== "undefined" ? window.location.hostname : "");
  if (!here) return false;
  if (isSingleOriginHost(here)) return false;
  if (isMarketingPublicHost(here)) return false;
  if (hostsEqual(app, here)) return false;
  const marketing = configuredHosts().marketing;
  if (hostsEqual(here, marketing)) return false;
  return true;
}

/** True when we should keep a single origin (dev, preview, or unset/unserved app host). */
export function isSingleOrigin(origin?: string): boolean {
  if (!explicitAppHost()) return true;
  let hostname = "";
  if (origin) {
    try {
      hostname = new URL(origin).hostname;
    } catch {
      hostname = "";
    }
  } else if (typeof window === "undefined") {
    try {
      hostname = new URL(fallbackOrigin()).hostname;
    } catch {
      return true;
    }
  } else {
    hostname = window.location.hostname;
  }
  if (!hostname) return true;
  return isSingleOriginHost(hostname) || !appHostIsLiveAndDistinct(hostname);
}

/** Component hook — wraps isSingleOrigin(). Do not call from plain helpers. */
export function useSingleOrigin(): boolean {
  return isSingleOrigin(typeof window !== "undefined" ? window.location.origin : fallbackOrigin());
}

export function originForSurface(surface: SummexSurface, origin?: string): string {
  const here = origin || (typeof window !== "undefined" ? window.location.origin : fallbackOrigin());
  if (isSingleOrigin(here)) {
    return here;
  }
  const cfg = configuredHosts();
  const host =
    surface === "app"
      ? cfg.app
      : surface === "api"
        ? cfg.api
        : surface === "sites"
          ? cfg.sites
          : cfg.marketing;
  return `${protocol()}//${host}`;
}

function withOrigin(origin: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!origin) return p;
  return `${origin}${p === "/" ? "" : p}`;
}

function sameOriginPosPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === "/") return "/app";
  if (
    p.startsWith("/app") ||
    p.startsWith("/venue/") ||
    p.startsWith("/kiosk") ||
    p === "/station" ||
    p.startsWith("/station/")
  )
    return p;
  return `/app${p}`;
}

/** Path inside the application surface. Same origin unless a live distinct app host exists. */
export function appHref(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const local = sameOriginPosPath(p);
  if (typeof window === "undefined") return local;
  const host = window.location.hostname;
  if (isMarketingPublicHost(host) || isSingleOriginHost(host)) return local;
  if (surfaceFromHost(host) === "app") {
    if (p === "/") return "/";
    if (p.startsWith("/venue/") || p.startsWith("/kiosk") || p.startsWith("/app")) return p;
    return p;
  }
  if (!appHostIsLiveAndDistinct(host)) return local;
  const app = explicitAppHost();
  if (!app || hostsEqual(app, SUMMEX_HOSTS.app)) return local;
  return `${protocol()}//${app}${p === "/" ? "" : p}`;
}

export function marketingHref(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return p;
  const host = window.location.hostname;
  if (surfaceFromHost(host) === "marketing" || isSingleOriginHost(host)) return p;
  const proto = window.location.protocol;
  return `${proto}//${configuredHosts().marketing}${p}`;
}

export function apiHref(path = "/health"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const apiPath = p.startsWith("/api") ? p : `/api${p}`;
  if (typeof window === "undefined") return apiPath;
  const host = window.location.hostname;
  if (surfaceFromHost(host) === "api") return p.startsWith("/api") ? p : p;
  if (isSingleOriginHost(host)) return apiPath;
  const proto = window.location.protocol;
  return `${proto}//${configuredHosts().api}${p.startsWith("/api") ? p.slice(4) || "/" : p}`;
}

export function sitesHref(path = "/", origin?: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (isSingleOrigin(origin)) {
    if (typeof window === "undefined") {
      return p.startsWith("/sites") || p.startsWith("/t/") || p.startsWith("/table/")
        ? p
        : `/sites${p === "/" ? "" : p}`;
    }
    const host = window.location.hostname;
    if (surfaceFromHost(host) === "sites") return p;
    if (p.startsWith("/sites") || p.startsWith("/t/") || p === "/t" || p.startsWith("/table/")) {
      return p;
    }
    return p.startsWith("/sites") ? p : `/sites${p === "/" ? "" : p}`;
  }
  const sitesOrigin = originForSurface("sites", origin);
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (surfaceFromHost(host) === "sites") return p;
  return withOrigin(sitesOrigin, p);
}

/** Absolute staff URL (POS, ODS, kiosk). Prefers app host when split DNS is on. */
export function absoluteAppHref(path = "/", origin?: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const here = origin || (typeof window !== "undefined" ? window.location.origin : fallbackOrigin());
  if (isSingleOrigin(here)) {
    const local = appHref(p);
    if (local.startsWith("http")) return local;
    return withOrigin(here, local);
  }
  const href = appHref(p);
  if (href.startsWith("http")) return href;
  return withOrigin(originForSurface("app"), href);
}

/** Absolute guest URL (table QR, online, location sites). Prefers sites host when split DNS is on. */
export function absoluteGuestHref(path = "/", origin?: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const here = origin || (typeof window !== "undefined" ? window.location.origin : fallbackOrigin());
  if (isSingleOrigin(here)) {
    return withOrigin(here, p);
  }
  const href = sitesHref(p);
  if (href.startsWith("http")) return href;
  return withOrigin(originForSurface("sites"), href);
}

/** Absolute marketing / login / dashboard URL. */
export function absoluteMarketingHref(path = "/", origin?: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const here = origin || (typeof window !== "undefined" ? window.location.origin : fallbackOrigin());
  if (isSingleOrigin(here)) {
    return withOrigin(here, p);
  }
  const href = marketingHref(p);
  if (href.startsWith("http")) return href;
  return withOrigin(originForSurface("marketing"), href);
}

export type AccessPoint = {
  id: string;
  label: string;
  hint: string;
  href: string;
  surface: SummexSurface;
};

export function staffGuestAccessPoints(opts?: {
  venueType?: string;
  locationId?: string;
  tablePath?: string;
}): AccessPoint[] {
  const venue = opts?.venueType || "restaurant";
  const locQ = opts?.locationId ? `?loc=${encodeURIComponent(opts.locationId)}` : "";
  const table = opts?.tablePath || "/t/demo";
  return [
    {
      id: "marketing",
      label: "www · marketing & login",
      hint: "Public site, Sign in, dashboard, onboarding",
      href: absoluteMarketingHref("/login"),
      surface: "marketing",
    },
    {
      id: "pos",
      label: "POS",
      hint: "Floor, order, host stand — this origin",
      href: `/venue/${venue}${locQ}`,
      surface: "app",
    },
    {
      id: "kds",
      label: "ODS",
      hint: "Kitchen / bar order display on this origin",
      href: `/venue/${venue}${locQ ? `${locQ}&` : "?"}station=ods`,
      surface: "app",
    },
    {
      id: "kiosk",
      label: "Kiosk",
      hint: "Guest kiosk device on this origin",
      href: `/kiosk${locQ}`,
      surface: "app",
    },
    {
      id: "qr",
      label: "sites · table QR",
      hint: "Guest order / pay from the table sticker",
      href: absoluteGuestHref(table),
      surface: "sites",
    },
    {
      id: "online",
      label: "sites · online menu",
      hint: "Order-ahead and location pages",
      href: absoluteGuestHref("/online"),
      surface: "sites",
    },
  ];
}

export const MARKETING_PATHS = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/features",
  "/blog",
  "/dashboard",
  "/onboarding",
] as const;
