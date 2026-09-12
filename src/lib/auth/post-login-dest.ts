import type { VenueEntityId } from "@/lib/pos/types";

const VENUE_IDS: readonly VenueEntityId[] = [
  "restaurant",
  "food_hall",
  "truck_pod",
  "ghost_kitchen",
  "catering",
  "bar_lounge",
  "cafe",
  "qsr",
];

export function asVenueType(raw: string | null | undefined): VenueEntityId | null {
  if (!raw) return null;
  return (VENUE_IDS as readonly string[]).includes(raw) ? (raw as VenueEntityId) : null;
}

/** Session fields needed to pick Admin dashboard vs owner house. */
export type PostLoginSession = {
  isPlatformAdmin: boolean;
  orgs: { id: string }[];
  locations: { id: string; venueType: string }[];
  active: { locationId: string | null } | null;
  setupToken?: string | null;
  setupStatus?: string | null;
};

export type PostLoginDest =
  | { to: "/dashboard" }
  | { to: "/get-pricing" }
  | { to: "/onboarding" }
  | { to: "/setup/$token"; token: string };

/**
 * After username/password sign-in: back office only. Never the staff PIN pad.
 * Each role lands on /dashboard tiles for that role (subscribed modules only).
 * PIN roles stay on the station home — not these dashboards.
 * Never `/venue/food_hall`. Never `/`. Never pipeline/CRM for a venue owner.
 */
export function postLoginDestination(session: PostLoginSession): PostLoginDest {
  if (session.isPlatformAdmin) return { to: "/dashboard" };
  const setup = session.setupToken;
  const setupStatus = session.setupStatus || "";
  if (setup && (setupStatus === "contracted" || setupStatus === "onboarding")) {
    return { to: "/setup/$token", token: setup };
  }
  const loc =
    session.locations.find((l) => l.id === session.active?.locationId) ??
    session.locations[0];
  if (loc) return { to: "/dashboard" };
  if (setup) return { to: "/setup/$token", token: setup };
  if (session.orgs.length > 0) return { to: "/onboarding" };
  return { to: "/get-pricing" };
}

/** Floor PIN surfaces — password login must not land here. */
export function isStaffPinSurface(path: string | null | undefined): boolean {
  if (!path) return false;
  const raw = path.trim();
  const p = (raw.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  const search = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
  if (p === "/station" || p.startsWith("/station/")) return true;
  if (p.startsWith("/venue/")) return true;
  if (p.startsWith("/app/venue/")) return true;
  if (p === "/" && /(?:^|[?&])station=/.test(search)) return true;
  return false;
}

/** Marketing paths that must not be the post-login landing. */
export function isMarketingStayPath(path: string | null | undefined): boolean {
  if (!path) return true;
  const p = path.split("?")[0] ?? "";
  return (
    p === "/" ||
    p === "/demo" ||
    p === "/features" ||
    p === "/pricing" ||
    p === "/whitepaper" ||
    p === "/blog" ||
    p === "/terms" ||
    p === "/privacy" ||
    p === "/contact" ||
    p === "/guide" ||
    p === "/get-pricing"
  );
}
