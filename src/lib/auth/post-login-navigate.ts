import type { useNavigate } from "@tanstack/react-router";
import { DEFAULT_POST_LOGIN, sanitizeNextPath } from "./safe-next-path";
import {
  asVenueType,
  isMarketingStayPath,
  postLoginDestination,
  type PostLoginSession,
} from "./post-login-dest";
import { parseStationQuery } from "@/lib/pos/device-roles";

type AppNavigate = ReturnType<typeof useNavigate>;

async function navigateSessionDest(
  navigate: AppNavigate,
  session: PostLoginSession | null | undefined,
): Promise<void> {
  if (!session) {
    await navigate({ to: "/dashboard" });
    return;
  }
  const dest = postLoginDestination(session);
  if (dest.to === "/venue/$type") {
    await navigate({
      to: "/venue/$type",
      params: { type: dest.type },
      search: { loc: dest.loc },
    });
    return;
  }
  await navigate({ to: dest.to });
}

/**
 * Post-login / post-auth navigation that only uses registered TanStack routes.
 * Unknown `?next=` values fall through to session dest (Admin dashboard or owner house).
 * Never `window.location`. Never `/`.
 */
export async function navigateToSanitizedPath(
  navigate: AppNavigate,
  raw: string | null | undefined,
  session?: PostLoginSession | null,
): Promise<void> {
  const sanitized = sanitizeNextPath(raw);
  const path = sanitized?.split("?")[0] ?? null;
  const search = sanitized?.includes("?")
    ? sanitized.slice(sanitized.indexOf("?") + 1).split("#")[0]
    : "";

  if (!path || path === "/platform" || path === DEFAULT_POST_LOGIN || isMarketingStayPath(path)) {
    await navigateSessionDest(navigate, session);
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
    case "/kiosk":
      await navigate({ to: "/kiosk" });
      return;
    case "/online":
      await navigate({ to: "/online" });
      return;
    case "/station": {
      const station = parseStationQuery(search.match(/(?:^|&)station=([^&]+)/)?.[1]);
      const loc = search.match(/(?:^|&)loc=([^&]+)/)?.[1];
      if (station) {
        await navigate({
          to: "/station/$role",
          params: { role: station },
          search: loc ? { loc: decodeURIComponent(loc) } : {},
        });
        return;
      }
      await navigate({ to: "/station" });
      return;
    }
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
    const loc = search.match(/(?:^|&)loc=([^&]+)/)?.[1];
    await navigate({
      to: "/venue/$type",
      params: { type: venueType },
      search: loc ? { loc: decodeURIComponent(loc) } : {},
    });
    return;
  }
  const stationRole = path.match(/^\/station\/([^/]+)$/);
  const role = stationRole?.[1] ? parseStationQuery(stationRole[1]) : null;
  if (role) {
    const loc = search.match(/(?:^|&)loc=([^&]+)/)?.[1];
    await navigate({
      to: "/station/$role",
      params: { role },
      search: loc ? { loc: decodeURIComponent(loc) } : {},
    });
    return;
  }
  const appVenue = path.match(/^\/app\/venue\/([^/]+)$/);
  const appVenueType = appVenue?.[1] ? asVenueType(appVenue[1]) : null;
  if (appVenueType) {
    await navigate({ to: "/app/venue/$type", params: { type: appVenueType } });
    return;
  }

  await navigateSessionDest(navigate, session);
}

export async function navigateAfterPasswordSignIn(
  navigate: AppNavigate,
  opts: {
    mustChangePassword: boolean;
    nextRaw?: string | null;
    session?: PostLoginSession | null;
  },
): Promise<void> {
  if (opts.mustChangePassword) {
    await navigate({ to: "/change-password" });
    return;
  }
  await navigateToSanitizedPath(navigate, opts.nextRaw, opts.session);
}
