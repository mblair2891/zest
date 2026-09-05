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
};

export type PostLoginDest =
  | { to: "/dashboard" }
  | { to: "/get-pricing" }
  | { to: "/venue/$type"; type: VenueEntityId; loc: string };

/**
 * After username/password sign-in: Platform Admin → control plane.
 * Venue owner (or any tenant member with a location) → that house.
 * Never `/` (sales landing).
 */
export function postLoginDestination(session: PostLoginSession): PostLoginDest {
  if (session.isPlatformAdmin) return { to: "/dashboard" };
  const loc =
    session.locations.find((l) => l.id === session.active?.locationId) ??
    session.locations[0];
  const type = loc ? asVenueType(loc.venueType) : null;
  if (loc && type) return { to: "/venue/$type", type, loc: loc.id };
  if (session.orgs.length > 0) return { to: "/dashboard" };
  return { to: "/get-pricing" };
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
    p === "/blog"
  );
}
