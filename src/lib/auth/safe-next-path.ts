/**
 * Post-login destinations that exist in the TanStack route tree.
 * Unknown or off-site `?next=` values are dropped (never navigated to).
 */
export const POST_LOGIN_STATIC = [
  "/dashboard",
  "/platform",
  "/change-password",
  "/onboarding",
  "/pipeline",
  "/get-pricing",
  "/guide",
  "/apps",
  "/app",
  "/pricing",
  "/features",
  "/whitepaper",
  "/kiosk",
  "/online",
] as const;

export type PostLoginStatic = (typeof POST_LOGIN_STATIC)[number];

const STATIC_SET = new Set<string>(POST_LOGIN_STATIC);

const VENUE_TYPE =
  /^(restaurant|food_hall|truck_pod|ghost_kitchen|catering|bar_lounge|cafe|qsr)$/;
const TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\") || trimmed.includes("://")) return null;
  const pathOnly = trimmed.split("?")[0]?.split("#")[0] ?? "";
  const search = trimmed.includes("?")
    ? trimmed.slice(trimmed.indexOf("?") + 1).split("#")[0]
    : "";
  if (!pathOnly.startsWith("/") || pathOnly.includes("..")) return null;

  if (STATIC_SET.has(pathOnly)) {
    if (
      pathOnly === "/get-pricing" &&
      search &&
      /^t=[A-Za-z0-9_-]{8,128}$/.test(search)
    ) {
      return `${pathOnly}?${search}`;
    }
    return pathOnly;
  }

  const quote = pathOnly.match(/^\/quote\/([^/]+)$/);
  if (quote?.[1] && TOKEN.test(quote[1])) return pathOnly;
  const setup = pathOnly.match(/^\/setup\/([^/]+)$/);
  if (setup?.[1] && TOKEN.test(setup[1])) return pathOnly;
  const invite = pathOnly.match(/^\/invite\/([^/]+)$/);
  if (invite?.[1] && TOKEN.test(invite[1])) return pathOnly;
  const venue = pathOnly.match(/^\/venue\/([^/]+)$/);
  if (venue?.[1] && VENUE_TYPE.test(venue[1])) return pathOnly;
  const appVenue = pathOnly.match(/^\/app\/venue\/([^/]+)$/);
  if (appVenue?.[1] && VENUE_TYPE.test(appVenue[1])) return pathOnly;

  return null;
}

/** Default after a successful password sign-in (before forced password change). */
export const DEFAULT_POST_LOGIN = "/dashboard" as const;
