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
  return "http://127.0.0.1:8080";
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
  if (typeof window === "undefined") return `/sites${p === "/" ? "" : p}`;
  const host = window.location.hostname;
  if (surfaceFromHost(host) === "sites") return p;
  if (isSingleOriginHost(host)) return p.startsWith("/sites") ? p : `/sites${p === "/" ? "" : p}`;
  const proto = window.location.protocol;
  return `${proto}//${configuredHosts().sites}${p === "/" ? "" : p}`;
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
