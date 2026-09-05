/**
 * Production host split (pure — no window / env).
 *
 *   summex.app / www.summex.app  → public marketing only
 *   app.summex.app               → login, dashboard, stations, owner POS
 *
 * Localhost, grok preview, and Vercel preview stay one origin (path prefixes).
 */

export const APEX_MARKETING_HOST = "summex.app";
export const APP_PLATFORM_HOST = "app.summex.app";

export function stripHostPort(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? "";
}

export function isSingleOriginHostName(hostname: string): boolean {
  const h = stripHostPort(hostname);
  return (
    !h ||
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "[::1]" ||
    h.endsWith(".grok-sandbox.com") ||
    h.endsWith(".grok.me") ||
    h.endsWith(".vercel.app")
  );
}

export function isMarketingPublicHostName(
  hostname: string,
  extraMarketing?: string,
): boolean {
  const h = stripHostPort(hostname);
  if (!h) return false;
  if (h.startsWith("app.") || h.startsWith("api.") || h.startsWith("sites.")) {
    return false;
  }
  const names = new Set<string>([APEX_MARKETING_HOST, `www.${APEX_MARKETING_HOST}`]);
  if (extraMarketing) {
    const x = stripHostPort(extraMarketing);
    if (x) {
      names.add(x);
      if (!x.startsWith("www.")) names.add(`www.${x}`);
    }
  }
  return names.has(h);
}

export function isAppPlatformHostName(
  hostname: string,
  configuredApp = APP_PLATFORM_HOST,
): boolean {
  const h = stripHostPort(hostname);
  if (!h) return false;
  if (h.startsWith("app.")) return true;
  return h === stripHostPort(configuredApp);
}

/** True on live apex or app hosts — not preview/local. */
export function hostSplitActive(hostname: string): boolean {
  if (isSingleOriginHostName(hostname)) return false;
  return (
    isMarketingPublicHostName(hostname) || isAppPlatformHostName(hostname)
  );
}

const PLATFORM_PREFIXES = [
  "/login",
  "/signup",
  "/dashboard",
  "/platform",
  "/pipeline",
  "/onboarding",
  "/change-password",
  "/station",
  "/venue",
  "/app",
  "/kiosk",
  "/setup",
  "/invite",
] as const;

export function isPlatformPath(pathname: string): boolean {
  const p = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (p === "/station" || p.startsWith("/station/")) return true;
  return PLATFORM_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`));
}

export function platformOriginFor(
  protocol: string,
  configuredApp = APP_PLATFORM_HOST,
): string {
  const proto = protocol.endsWith(":") ? protocol : `${protocol}:`;
  const host = stripHostPort(configuredApp) || APP_PLATFORM_HOST;
  return `${proto}//${host}`;
}

/**
 * When the visitor is on the marketing apex with a leftover console path,
 * return the app.summex.app URL. Null = stay (sales page, or not split).
 */
export function marketingToPlatformHref(
  pathnameWithSearch: string,
  hostname: string,
  protocol: string,
  configuredApp = APP_PLATFORM_HOST,
): string | null {
  if (!hostSplitActive(hostname)) return null;
  if (!isMarketingPublicHostName(hostname)) return null;
  const raw = pathnameWithSearch.startsWith("/")
    ? pathnameWithSearch
    : `/${pathnameWithSearch}`;
  const pathname = raw.split("?")[0] || "/";
  const search = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
  if (pathname === "/" && /(?:^|[?&])station=/.test(search)) {
    return `${platformOriginFor(protocol, configuredApp)}${raw}`;
  }
  if (!isPlatformPath(pathname)) return null;
  return `${platformOriginFor(protocol, configuredApp)}${raw}`;
}
