import { getSql } from "@/lib/db";
import {
  ForbiddenError,
  SuspendedError,
  assertLocationAccess,
  isPlatformAdmin,
  requireMembership,
  resolveActiveTenant,
} from "./tenancy.server";
import type { MembershipRole } from "./types";
import { extractTenantIds } from "./tenancy-rules";

export type BoundTenant = {
  userId: string;
  organizationId: string | null;
  locationId: string | null;
  role: MembershipRole;
  isPlatformAdmin: boolean;
};

/**
 * Bind the caller to a verified org/location. Never trust client orgId alone:
 * location ownership is loaded from Postgres; mismatch is Forbidden.
 */
export async function bindTenant(userId: string, input?: unknown): Promise<BoundTenant> {
  const { orgId, locationId } = extractTenantIds(input);
  const admin = await isPlatformAdmin(userId);

  if (locationId) {
    const access = await assertLocationAccess(userId, locationId);
    if (orgId && orgId !== access.org.id && !admin) {
      throw new ForbiddenError("Organization mismatch");
    }
    return {
      userId,
      organizationId: access.org.id,
      locationId: access.location.id,
      role: access.role,
      isPlatformAdmin: admin || access.role === "platform_admin",
    };
  }

  if (orgId) {
    const access = await requireMembership(userId, orgId);
    if (access.org.status === "suspended" && !access.isPlatformAdmin) {
      throw new SuspendedError();
    }
    return {
      userId,
      organizationId: access.org.id,
      locationId: access.locationId,
      role: access.role,
      isPlatformAdmin: access.isPlatformAdmin,
    };
  }

  if (admin) {
    const tenant = await resolveActiveTenant(userId).catch(() => null);
    return {
      userId,
      organizationId: tenant?.organizationId ?? null,
      locationId: tenant?.locationId ?? null,
      role: "platform_admin",
      isPlatformAdmin: true,
    };
  }

  const tenant = await resolveActiveTenant(userId);
  if (!tenant) {
    return {
      userId,
      organizationId: null,
      locationId: null,
      role: "staff",
      isPlatformAdmin: false,
    };
  }
  if (tenant.orgStatus === "suspended") throw new SuspendedError();
  return {
    userId,
    organizationId: tenant.organizationId,
    locationId: tenant.locationId,
    role: tenant.role,
    isPlatformAdmin: false,
  };
}

export async function assertLocationMembership(userId: string, locationId: string): Promise<BoundTenant> {
  return bindTenant(userId, { locationId });
}

/** Org that owns a location, or null. Used when verifying client orgId. */
export async function orgIdForLocation(locationId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ org_id: string }>`
    select org_id from locations
    where id = ${locationId} and coalesce(is_demo, false) = false
    limit 1
  `;
  return rows[0]?.org_id ?? null;
}
