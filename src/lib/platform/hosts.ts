import { venueAwareHref, venueSlugFromHost } from "./venue-host";
import {
  hostSplitActive,
  isAppPlatformHostName,
  isMarketingPublicHostName,
  isPlatformPath,
  isSingleOriginHostName,
  marketingToPlatformHref,
  platformOriginFor,
} from "./host-split";

/**
 * Canonical Summex surfaces.
 *
 * Production:
 *   summex.app / www        public marketing ONLY (Get a price, Guide, Demo, Log in)
 *   app.summex.app          login, dashboard, CRM, pipeline, stations, owner POS
 *   api.summex.app          HTTP API
 *   sites.summex.app        guest-facing (ordering, location sites) — later
 *
 * Local / live preview (single origin): path prefixes stand in for hosts.
 *   /                     marketing
 *   /login /dashboard     merchant login + dashboard
 *   /app                  application
 *   /api                  API
 *   /sites                guest platform
 *
 * Cookies for the console live on app.summex.app. Set
 * APP_URL=https://app.summex.app (and BETTER_AUTH_URL the same).
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

/** Single-origin mode: localhost, loopback, grok preview, or Vercel preview. */
export function isSingleOriginHost(hostname: string): boolean {
  return isSingleOriginHostName(hostname);
}

export function isAppPlatformHost(hostname: string): boolean {
  return isAppPlatformHostName(hostname, configuredHosts().app);
}

/**
 * www / apex marketing hosts. Never POS, dashboard, or PlatformApp.
 */
export function isMarketingPublicHost(hostname: string): boolean {
  const h = stripPort(hostname);
  if (!h) return true;
  return isMarketingPublicHostName(h, configuredHosts().marketing);
}

export function surfaceFromHost(hostname: string): SummexSurface | null {
  const h = stripPort(hostname);
  if (isMarketingPublicHost(h)) return "marketing";
  const cfg = configuredHosts();
  const app = explicitAppHost();
  if (h.startsWith("app.") || (app && hostsEqual(h, app))) return "app";
  if (h === cfg.api || h.startsWith("api.")) return "api";
  if (h === cfg.sites || h.startsWith("sites.")) return "sites";
  if (venueSlugFromHost(h)) return "app";
  return null;
}

export function surfaceFromPath(pathname: string): SummexSurface | null {
  if (pathname === "/api" || pathname.startsWith("/api/")) return "api";
  if (pathname === "/app" || pathname.startsWith("/app/")) return "app";
  if (pathname === "/sites" || pathname.startsWith("/sites/")) return "sites";
  if (pathname.startsWith("/venue/") || pathname === "/kiosk" || pathname === "/station" || pathname.startsWith("/station/"))
    return "app";
  if (pathname === "/v" || pathname.startsWith("/v/")) return "app";
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
 * True when this request is on the marketing apex and the console lives on
 * app.summex.app (production split). Preview/local stay same-origin.
 */
export function appHostIsLiveAndDistinct(currentHostname?: string): boolean {
  const here =
    currentHostname ||
    (typeof window !== "undefined" ? window.location.hostname : "");
  if (!here) return false;
  return hostSplitActive(here) && isMarketingPublicHost(here);
}

/** True when we should keep a single origin (dev, preview). */
export function isSingleOrigin(origin?: string): boolean {
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
  return !hostSplitActive(hostname);
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
    p.startsWith("/station/") ||
    p === "/v" ||
    p.startsWith("/v/")
  )
    return p;
  return `/app${p}`;
}

/** Path inside the application surface. Production marketing → app.summex.app. */
export function appHref(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const local = sameOriginPosPath(p);
  if (typeof window === "undefined") {
    return hostSplitActive(stripPort(fallbackOrigin().replace(/^https?:\/\//, "")))
      ? `${platformOriginFor(protocol(), configuredHosts().app)}${p === "/" ? "" : p}`
      : local;
  }
  const host = window.location.hostname;
  if (isSingleOriginHost(host)) return local;
  if (isAppPlatformHost(host)) {
    if (p === "/") return "/dashboard";
    return p;
  }
  if (isMarketingPublicHost(host)) {
    return `${platformOriginFor(protocol(), configuredHosts().app)}${p === "/" ? "/dashboard" : p}`;
  }
  return local;
}

/** Absolute console URL (login, dashboard, stations). Preview = this origin. */
export function absolutePlatformHref(path = "/", origin?: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const here = origin || (typeof window !== "undefined" ? window.location.origin : fallbackOrigin());
  let hostname = "";
  try {
    hostname = new URL(here).hostname;
  } catch {
    hostname = typeof window !== "undefined" ? window.location.hostname : "";
  }
  if (!hostSplitActive(hostname)) {
    if (p.startsWith("http")) return p;
    return withOrigin(here, p);
  }
  return `${platformOriginFor(protocol(), configuredHosts().app)}${p}`;
}

export function platformLoginHref(): string {
  return absolutePlatformHref("/login");
}

export function leftoverMarketingPlatformHref(): string | null {
  if (typeof window === "undefined") return null;
  const path = `${window.location.pathname}${window.location.search}`;
  return marketingToPlatformHref(
    path,
    window.location.hostname,
    window.location.protocol,
    configuredHosts().app,
  );
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

/** Absolute staff URL (POS, ODS, kiosk, pair). Production → app.summex.app. */
export function absoluteAppHref(path = "/", origin?: string): string {
  return absolutePlatformHref(path, origin);
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
  slug?: string | null;
}): AccessPoint[] {
  const venue = opts?.venueType || "restaurant";
  const locQ = opts?.locationId ? `?loc=${encodeURIComponent(opts.locationId)}` : "";
  const table = opts?.tablePath || "/t/demo";
  const slug = opts?.slug?.trim() || "";
  const posHref = absolutePlatformHref(`/venue/${venue}${locQ}`);
  const odsHref = absolutePlatformHref(
    `/station/ods${opts?.locationId ? `?loc=${encodeURIComponent(opts.locationId)}` : ""}`,
  );
  const kioskHref = absolutePlatformHref(`/kiosk${locQ}`);
  let qrHref = absoluteGuestHref(table);
  let onlineHref = absoluteGuestHref("/online");
  if (slug) {
    qrHref = venueAwareHref(table, slug);
    onlineHref = venueAwareHref("/online", slug);
  }
  return [
    {
      id: "marketing",
      label: "www · marketing",
      hint: "Public site: Get a price, Guide, Demo, Contact — no login",
      href: absoluteMarketingHref("/"),
      surface: "marketing",
    },
    {
      id: "login",
      label: "Log in",
      hint: "Username/password on app.summex.app — not the sales home",
      href: absolutePlatformHref("/login"),
      surface: "app",
    },
    {
      id: "pos",
      label: "POS",
      hint: "Owner venue on app.summex.app",
      href: posHref,
      surface: "app",
    },
    {
      id: "kds",
      label: "ODS",
      hint: "Kitchen / bar order display on app.summex.app",
      href: odsHref,
      surface: "app",
    },
    {
      id: "kiosk",
      label: "Kiosk",
      hint: "Guest kiosk on app.summex.app",
      href: kioskHref,
      surface: "app",
    },
    {
      id: "qr",
      label: "Table QR",
      hint: slug
        ? "Guest order / pay on the venue host"
        : "Guest order / pay from the table sticker",
      href: qrHref,
      surface: "sites",
    },
    {
      id: "online",
      label: "Online menu",
      hint: "Order-ahead and location pages",
      href: onlineHref,
      surface: "sites",
    },
  ];
}

export const MARKETING_PATHS = [
  "/",
  "/pricing",
  "/features",
  "/blog",
  "/get-pricing",
  "/guide",
  "/demo",
  "/whitepaper",
  "/privacy",
  "/contact",
] as const;

export { isPlatformPath, marketingToPlatformHref, hostSplitActive };
