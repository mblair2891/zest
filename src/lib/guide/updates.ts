import { topicMatchesRoles } from "./roles";
import {
  GUIDE_VERSION,
  type GuideRole,
  type GuideUpdate,
  type WhatsNewSurface,
} from "./types";
import { WHATS_NEW_ENTRIES } from "@/lib/whats-new/entries";
import type { VenueEntityId } from "@/lib/pos/types";

/**
 * Newest first. Keep ~10 entries so the login popup stays useful.
 * Add a row in src/lib/whats-new/entries.ts when a feature ships.
 */
export const GUIDE_UPDATES: GuideUpdate[] = WHATS_NEW_ENTRIES;

export type WhatsNewContext = {
  roles: GuideRole[] | "all";
  entityType?: VenueEntityId | null;
  surfaces?: WhatsNewSurface[] | "all";
  includePlatform?: boolean;
  isDemo?: boolean;
};

function isPurePlatformNote(update: GuideUpdate): boolean {
  if (update.audience === "platform") return true;
  if (update.surfaces && update.surfaces !== "all") {
    const onlyPlatform =
      update.surfaces.length > 0 && update.surfaces.every((s) => s === "platform");
    if (onlyPlatform && update.roles !== "all") {
      const roles = update.roles;
      if (roles.length > 0 && roles.every((r) => r === "platform_admin")) return true;
    }
  }
  if (
    update.roles !== "all" &&
    update.roles.length > 0 &&
    update.roles.every((r) => r === "platform_admin")
  ) {
    return true;
  }
  return false;
}

export function updateVisibleToRoles(
  update: GuideUpdate,
  roles: GuideRole[] | "all",
  opts?: { includePlatform?: boolean },
): boolean {
  return updateMatchesContext(update, {
    roles,
    includePlatform: opts?.includePlatform,
  });
}

export function updateMatchesContext(
  update: GuideUpdate,
  ctx: WhatsNewContext,
): boolean {
  const includePlatform =
    ctx.includePlatform ??
    (Array.isArray(ctx.roles) && ctx.roles.includes("platform_admin"));

  if (!includePlatform && isPurePlatformNote(update)) return false;

  if (update.audience === "demo" && ctx.isDemo === false) return false;
  if (update.audience === "tenant" && ctx.isDemo === true) return false;

  if (update.entityTypes && update.entityTypes !== "all" && update.entityTypes.length > 0) {
    if (ctx.entityType && !update.entityTypes.includes(ctx.entityType)) return false;
  }

  const wantedSurfaces =
    ctx.surfaces && ctx.surfaces !== "all" ? ctx.surfaces : null;
  const updateSurfaces =
    update.surfaces && update.surfaces !== "all" ? update.surfaces : null;
  if (wantedSurfaces && wantedSurfaces.length > 0 && updateSurfaces && updateSurfaces.length > 0) {
    if (!updateSurfaces.some((s) => wantedSurfaces.includes(s))) return false;
  }

  if (ctx.roles === "all" || ctx.roles.length === 0) {
    if (includePlatform) return true;
    return !isPurePlatformNote(update);
  }
  return topicMatchesRoles(update.roles, ctx.roles);
}

export function updatesForRoles(
  roles: GuideRole[] | "all",
  limit = 10,
  opts?: { includePlatform?: boolean },
): GuideUpdate[] {
  return updatesForContext({ roles, includePlatform: opts?.includePlatform }, limit);
}

export function updatesForContext(ctx: WhatsNewContext, limit = 10): GuideUpdate[] {
  return GUIDE_UPDATES.filter((u) => updateMatchesContext(u, ctx)).slice(0, limit);
}

export function latestUpdateId(): string {
  return GUIDE_UPDATES[0]?.id ?? GUIDE_VERSION;
}

export function latestMatchingUpdateId(ctx: WhatsNewContext): string {
  return updatesForContext(ctx, 1)[0]?.id ?? latestUpdateId();
}

export function isNewerThan(
  updateId: string,
  watermarkId: string | null,
): boolean {
  if (!watermarkId) return true;
  const ids = GUIDE_UPDATES.map((u) => u.id);
  const a = ids.indexOf(updateId);
  const b = ids.indexOf(watermarkId);
  if (a < 0) return true;
  if (b < 0) return true;
  return a < b;
}

export function hasUnseenUpdates(
  roles: GuideRole[] | "all",
  silencedAfterUpdateId: string | null,
  ctx?: Omit<WhatsNewContext, "roles">,
): boolean {
  const forRole = updatesForContext({ roles, ...ctx }, 20);
  if (forRole.length === 0) return false;
  if (!silencedAfterUpdateId) return true;
  return forRole.some((u) => isNewerThan(u.id, silencedAfterUpdateId));
}
