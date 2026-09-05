/**
 * Venue hosts: {slug}.summex.app with path fallback /v/{slug}.
 *
 * Operator DNS is one-time: wildcard *.summex.app on Namecheap + Vercel.
 * No per-tenant DNS job. Preview / localhost keep the path fallback.
 */

const APEX = "summex.app";

function stripPort(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? host.toLowerCase();
}

function isPreviewHost(hostname: string): boolean {
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

function hereHost(): string {
  if (typeof window !== "undefined") return window.location.host;
  return "";
}

function hereOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Host labels that must never become a venue subdomain. */
export const RESERVED_VENUE_SLUGS: ReadonlySet<string> = new Set([
  "www",
  "www2",
  "app",
  "api",
  "sites",
  "site",
  "mail",
  "email",
  "ftp",
  "sftp",
  "ssh",
  "vpn",
  "ns",
  "ns1",
  "ns2",
  "mx",
  "smtp",
  "imap",
  "pop",
  "admin",
  "platform",
  "dashboard",
  "login",
  "signin",
  "signup",
  "register",
  "auth",
  "account",
  "accounts",
  "guide",
  "blog",
  "docs",
  "status",
  "support",
  "help",
  "cdn",
  "static",
  "assets",
  "dev",
  "staging",
  "stage",
  "test",
  "demo",
  "preview",
  "vercel",
  "summex",
  "quantum",
  "order",
  "pay",
  "kiosk",
  "station",
  "venue",
  "online",
  "privacy",
  "pricing",
  "features",
  "onboarding",
  "pipeline",
  "whitepaper",
  "reserve",
  "invite",
  "setup",
  "quote",
  "tenant",
  "table",
  "v",
  "beta",
  "alpha",
  "prod",
  "production",
  "local",
  "localhost",
  "billing",
  "crm",
  "pos",
  "ods",
  "console",
  "control",
  "settings",
  "config",
  "system",
  "root",
  "health",
  "webhook",
  "webhooks",
  "graphql",
  "rest",
  "git",
  "m",
  "mobile",
  "embed",
  "img",
  "images",
  "media",
  "files",
  "js",
  "css",
  "go",
  "new",
  "ssl",
  "tls",
  "dns",
  "public",
  "private",
  "internal",
  "default",
  "null",
  "undefined",
  "true",
  "false",
  "owner",
  "operator",
  "operators",
  "store",
  "shop",
  "checkout",
  "assets2",
]);

export function slugifyVenue(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "venue";
}

export function isReservedVenueSlug(slug: string): boolean {
  return RESERVED_VENUE_SLUGS.has(String(slug ?? "").trim().toLowerCase());
}

/** Normalize a typed slug; empty if unusable. Does not check uniqueness. */
export function normalizeVenueSlug(raw: string): string {
  return slugifyVenue(String(raw ?? "").trim());
}

export function suggestVenueSlug(name: string): string {
  const s = slugifyVenue(name);
  if (isReservedVenueSlug(s)) return `v-${s}`.slice(0, 48);
  return s;
}

export function venueSlugFromHost(hostname: string): string | null {
  const h = stripPort(hostname);
  if (!h.endsWith(`.${APEX}`)) return null;
  const sub = h.slice(0, -(APEX.length + 1));
  if (!sub || sub.includes(".")) return null;
  if (isReservedVenueSlug(sub)) return null;
  return sub;
}

export function venueSlugFromPath(pathname: string): string | null {
  const m = /^\/v\/([a-z0-9-]{2,48})(?:\/|$)/i.exec(pathname);
  if (!m?.[1]) return null;
  const s = m[1].toLowerCase();
  if (isReservedVenueSlug(s)) return null;
  return s;
}

/** Production apex / www / app / sites / a venue slug — wildcard DNS applies. */
export function canUseVenueSubdomain(hostname?: string): boolean {
  const h = stripPort(hostname || hereHost());
  if (!h || isPreviewHost(h)) return false;
  if (h === APEX || h === `www.${APEX}`) return true;
  return h.endsWith(`.${APEX}`);
}

export function venueSubdomainHost(slug: string): string {
  return `${normalizeVenueSlug(slug)}.${APEX}`;
}

export function venuePublicOrigin(slug: string, hostname?: string): string {
  const s = normalizeVenueSlug(slug);
  const host = stripPort(hostname || hereHost());
  const want = venueSubdomainHost(s);
  if (host === want) {
    return hereOrigin() || `https://${want}`;
  }
  if (canUseVenueSubdomain(host)) return `https://${want}`;
  return hereOrigin();
}

export function venuePosPath(slug: string): string {
  return `/v/${encodeURIComponent(normalizeVenueSlug(slug))}`;
}

/** Open this venue: subdomain on summex.app, else /v/{slug} on this origin. */
export function venuePosHref(slug: string, hostname?: string): string {
  const s = normalizeVenueSlug(slug);
  const host = stripPort(hostname || hereHost());
  if (canUseVenueSubdomain(host)) {
    const origin = venuePublicOrigin(s, host);
    return `${origin.replace(/\/$/, "")}/`;
  }
  const origin = venuePublicOrigin(s, host);
  return `${(origin || "").replace(/\/$/, "")}${venuePosPath(s)}`;
}

/** Staff/guest path on the venue origin (pair, QR, station). */
export function venueAwareHref(path: string, slug?: string | null, hostname?: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const s = slug ? normalizeVenueSlug(slug) : "";
  if (!s) {
    const origin = hereOrigin();
    return origin ? `${origin.replace(/\/$/, "")}${p}` : p;
  }
  const origin = venuePublicOrigin(s, hostname);
  return `${(origin || "").replace(/\/$/, "")}${p}`;
}
