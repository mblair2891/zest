import { HOST_SCOPE } from "@/lib/access/entity-grants";
import type { EntityWriteContext } from "@/lib/access/assert-entity.server";
import { ForbiddenError } from "@/lib/saas/tenancy.server";
import {
  hrConfigForEntity,
  type EntityHrConfig,
  type HrAudience,
  type HrFeatureKey,
  type HrVisibilityKey,
} from "./types";
import type { LocationSetup } from "@/lib/saas/types";

export function employerOf(ctx: EntityWriteContext, requested?: string | null): string {
  if (ctx.isPlatformAdmin || ctx.role === "owner" || ctx.role === "manager") {
    const want = String(requested ?? "").trim();
    if (want) return want;
    return ctx.operatorId || HOST_SCOPE;
  }
  return ctx.operatorId || HOST_SCOPE;
}

export function configOf(setup: LocationSetup, employerId: string): EntityHrConfig {
  return hrConfigForEntity(setup.hrByEntity, employerId);
}

export function featureOn(setup: LocationSetup, employerId: string, key: HrFeatureKey): boolean {
  const c = configOf(setup, employerId);
  if (!c.enabled && key !== "scheduling" && key !== "timeClock") return false;
  return c.features[key];
}

function audienceAllows(
  audience: HrAudience,
  ctx: EntityWriteContext,
  employerId: string,
): boolean {
  const isEntityOwner =
    ctx.role === "owner" || (ctx.role === "vendor" && ctx.operatorId === employerId);
  const isEntityManager =
    isEntityOwner ||
    (ctx.role === "manager" &&
      (employerId === HOST_SCOPE || ctx.operatorId === employerId || ctx.operatorId === HOST_SCOPE));
  const isHost = ctx.role === "owner" || ctx.role === "manager" || ctx.isPlatformAdmin;

  if (audience === "none") return isEntityOwner && ctx.operatorId === employerId;
  if (audience === "entity_owner") {
    if (employerId === HOST_SCOPE) return ctx.role === "owner" || ctx.isPlatformAdmin;
    return ctx.operatorId === employerId && (ctx.role === "vendor" || ctx.role === "owner");
  }
  if (audience === "entity_managers") return isEntityManager;
  if (audience === "host") return isHost || isEntityManager;
  return false;
}

export function canViewHrField(
  ctx: EntityWriteContext,
  employerId: string,
  field: HrVisibilityKey,
): boolean {
  if (ctx.isPlatformAdmin && (field === "wages" || field === "documents")) {
    return false;
  }
  const vis = configOf(ctx.setup, employerId).visibility[field];
  return audienceAllows(vis, ctx, employerId);
}

export function assertEmployerScope(ctx: EntityWriteContext, employerId: string): void {
  if (ctx.isPlatformAdmin) return;
  if (ctx.role === "owner" || ctx.role === "manager") return;
  if (ctx.operatorId === employerId) return;
  throw new ForbiddenError("Cross-entity employment files are denied");
}

export function redactForPlatform<T extends Record<string, unknown>>(
  ctx: EntityWriteContext,
  row: T,
): T {
  if (!ctx.isPlatformAdmin) return row;
  const copy = { ...row };
  for (const k of Object.keys(copy)) {
    if (/ssn|tax_cipher|cipher|ein|itin/i.test(k)) {
      (copy as Record<string, unknown>)[k] = null;
    }
  }
  return copy;
}
