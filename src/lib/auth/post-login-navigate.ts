import type { useNavigate } from "@tanstack/react-router";
import type { VenueEntityId } from "@/lib/pos/types";
import { DEFAULT_POST_LOGIN, sanitizeNextPath } from "./safe-next-path";

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

function asVenueType(raw: string): VenueEntityId | null {
  return (VENUE_IDS as readonly string[]).includes(raw)
    ? (raw as VenueEntityId)
    : null;
}

type AppNavigate = ReturnType<typeof useNavigate>;

/**
 * Post-login / post-auth navigation that only uses registered TanStack routes.
 * Unknown `?next=` values fall through to `/dashboard`. Never `window.location`.
 */
export async function navigateToSanitizedPath(
  navigate: AppNavigate,
  raw: string | null | undefined,
): Promise<void> {
  const sanitized = sanitizeNextPath(raw);
  const path = sanitized?.split("?")[0] ?? null;
  const search = sanitized?.includes("?")
    ? sanitized.slice(sanitized.indexOf("?") + 1).split("#")[0]
    : "";

  if (!path || path === "/platform" || path === DEFAULT_POST_LOGIN) {
    await navigate({ to: "/dashboard" });
    return;
  }

  switch (path) {
    case "/change-password":
      await navigate({ to: "/change-password" });
      return;
    case "/dashboard":
      await navigate({ to: "/dashboard" });
      return;
    case "/onboarding":
      await navigate({ to: "/onboarding" });
      return;
    case "/pipeline":
      await navigate({ to: "/pipeline" });
      return;
    case "/get-pricing": {
      const t = search.match(/^t=([A-Za-z0-9_-]{8,128})$/)?.[1];
      if (t) await navigate({ to: "/get-pricing", search: { t } });
      else await navigate({ to: "/get-pricing" });
      return;
    }
    case "/guide":
      await navigate({ to: "/guide" });
      return;
    case "/apps":
      await navigate({ to: "/apps" });
      return;
    case "/app":
      await navigate({ to: "/app" });
      return;
    case "/pricing":
      await navigate({ to: "/pricing" });
      return;
    case "/features":
      await navigate({ to: "/features" });
      return;
    case "/whitepaper":
      await navigate({ to: "/whitepaper" });
      return;
    case "/kiosk":
      await navigate({ to: "/kiosk" });
      return;
    case "/online":
      await navigate({ to: "/online" });
      return;
    case "/demo":
      await navigate({ to: "/demo" });
      return;
    case "/demo/tour/full":
      await navigate({ to: "/demo/tour/full" });
      return;
    default:
      break;
  }

  const quote = path.match(/^\/quote\/([^/]+)$/);
  if (quote?.[1]) {
    await navigate({ to: "/quote/$token", params: { token: quote[1] } });
    return;
  }
  const setup = path.match(/^\/setup\/([^/]+)$/);
  if (setup?.[1]) {
    await navigate({ to: "/setup/$token", params: { token: setup[1] } });
    return;
  }
  const invite = path.match(/^\/invite\/([^/]+)$/);
  if (invite?.[1]) {
    await navigate({ to: "/invite/$token", params: { token: invite[1] } });
    return;
  }
  const venue = path.match(/^\/venue\/([^/]+)$/);
  const venueType = venue?.[1] ? asVenueType(venue[1]) : null;
  if (venueType) {
    await navigate({ to: "/venue/$type", params: { type: venueType } });
    return;
  }
  const demoType = path.match(/^\/demo\/([^/]+)$/);
  if (demoType?.[1] && demoType[1] !== "tour") {
    const vt = asVenueType(demoType[1]);
    if (vt) {
      await navigate({ to: "/demo/$type", params: { type: vt } });
      return;
    }
  }
  const demoTour = path.match(/^\/demo\/([^/]+)\/tour$/);
  if (demoTour?.[1]) {
    const vt = asVenueType(demoTour[1]);
    if (vt) {
      await navigate({ to: "/demo/$type/tour", params: { type: vt } });
      return;
    }
  }
  const appVenue = path.match(/^\/app\/venue\/([^/]+)$/);
  const appVenueType = appVenue?.[1] ? asVenueType(appVenue[1]) : null;
  if (appVenueType) {
    await navigate({ to: "/app/venue/$type", params: { type: appVenueType } });
    return;
  }

  await navigate({ to: "/dashboard" });
}

export async function navigateAfterPasswordSignIn(
  navigate: AppNavigate,
  opts: { mustChangePassword: boolean; nextRaw?: string | null },
): Promise<void> {
  if (opts.mustChangePassword) {
    await navigate({ to: "/change-password" });
    return;
  }
  await navigateToSanitizedPath(navigate, opts.nextRaw);
}
