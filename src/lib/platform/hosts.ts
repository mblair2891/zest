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

function envHost(name: string, fallback: string): string {
  const vite =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined>)[name]
      : undefined;
  const node =
    typeof process !== "undefined" ? process.env[name] : undefined;
  return (vite || node || fallback).replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function configuredHosts() {
  return {
    marketing: envHost("VITE_MARKETING_HOST", SUMMEX_HOSTS.marketing),
    app: envHost("VITE_APP_HOST", SUMMEX_HOSTS.app),
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

export function surfaceFromHost(hostname: string): SummexSurface | null {
  const h = stripPort(hostname);
  const cfg = configuredHosts();
  if (h === cfg.app || h.startsWith("app.")) return "app";
  if (h === cfg.api || h.startsWith("api.")) return "api";
  if (h === cfg.sites || h.startsWith("sites.")) return "sites";
  if (h === cfg.marketing || h === `www.${cfg.marketing}`) return "marketing";
  return null;
}

export function surfaceFromPath(pathname: string): SummexSurface | null {
  if (pathname === "/api" || pathname.startsWith("/api/")) return "api";
  if (pathname === "/app" || pathname.startsWith("/app/")) return "app";
  if (pathname === "/sites" || pathname.startsWith("/sites/")) return "sites";
  if (pathname.startsWith("/venue/") || pathname === "/kiosk") return "app";
  return null;
}

export function resolveSurface(hostname: string, pathname: string): SummexSurface {
  return surfaceFromHost(hostname) ?? surfaceFromPath(pathname) ?? "marketing";
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

/** True when we should keep a single origin (dev, preview, or unset split DNS). */
export function useSingleOrigin(): boolean {
  if (typeof window === "undefined") {
    const url = fallbackOrigin();
    try {
      return isSingleOriginHost(new URL(url).hostname);
    } catch {
      return true;
    }
  }
  return isSingleOriginHost(window.location.hostname);
}

export function originForSurface(surface: SummexSurface): string {
  if (useSingleOrigin()) {
    return typeof window !== "undefined" ? window.location.origin : fallbackOrigin();
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

/** Path inside the application surface (`/venue/...` not `/app/venue/...`). */
export function appHref(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return p === "/" ? "/app" : `/app${p}`;
  }
  const host = window.location.hostname;
  if (surfaceFromHost(host) === "app") return p === "/" ? "/" : p;
  if (isSingleOriginHost(host)) return p === "/" ? "/app" : `/app${p}`;
  const proto = window.location.protocol;
  return `${proto}//${configuredHosts().app}${p === "/" ? "" : p}`;
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

export function sitesHref(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (useSingleOrigin()) {
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
  const origin = originForSurface("sites");
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (surfaceFromHost(host) === "sites") return p;
  return withOrigin(origin, p);
}

/** Absolute staff URL (POS, KDS, kiosk). Prefers app host when split DNS is on. */
export function absoluteAppHref(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (useSingleOrigin()) {
    const origin = typeof window !== "undefined" ? window.location.origin : fallbackOrigin();
    const local = appHref(p);
    if (local.startsWith("http")) return local;
    return withOrigin(origin, local);
  }
  const href = appHref(p);
  if (href.startsWith("http")) return href;
  return withOrigin(originForSurface("app"), href);
}

/** Absolute guest URL (table QR, online, location sites). Prefers sites host when split DNS is on. */
export function absoluteGuestHref(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (useSingleOrigin()) {
    const origin = typeof window !== "undefined" ? window.location.origin : fallbackOrigin();
    return withOrigin(origin, p);
  }
  const href = sitesHref(p);
  if (href.startsWith("http")) return href;
  return withOrigin(originForSurface("sites"), href);
}

/** Absolute marketing / login / dashboard URL. */
export function absoluteMarketingHref(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (useSingleOrigin()) {
    const origin = typeof window !== "undefined" ? window.location.origin : fallbackOrigin();
    return withOrigin(origin, p);
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
      label: "app · POS",
      hint: "Floor, order, host stand",
      href: absoluteAppHref(`/venue/${venue}${locQ}`),
      surface: "app",
    },
    {
      id: "kds",
      label: "app · KDS",
      hint: "Kitchen rail on the same app host",
      href: absoluteAppHref(`/venue/${venue}${locQ ? `${locQ}&` : "?"}station=kitchen`),
      surface: "app",
    },
    {
      id: "kiosk",
      label: "app · kiosk",
      hint: "Guest kiosk device — still the app host",
      href: absoluteAppHref(`/kiosk${locQ}`),
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
