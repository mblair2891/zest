/**
 * Pure tenancy rules — no DB. Used by server bindTenant and IDOR tests.
 * Client-supplied orgId/locationId is never trusted without a matching membership
 * (platform admin is global).
 */

export type MembershipStub = {
  orgId: string;
  locationId: string | null;
  role: string;
  status: string;
};

export class TenancyDenied extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "TenancyDenied";
  }
}

export function assertMembershipScope(opts: {
  isPlatformAdmin: boolean;
  memberships: MembershipStub[];
  requestedOrgId?: string | null;
  requestedLocationId?: string | null;
  /** Org that actually owns requestedLocationId (looked up server-side, not client). */
  locationOrgId?: string | null;
}): { orgId: string; role: string } {
  const requestedOrg = String(opts.requestedOrgId ?? "").trim();
  const requestedLoc = String(opts.requestedLocationId ?? "").trim();
  const locationOrg = String(opts.locationOrgId ?? "").trim();

  if (opts.isPlatformAdmin) {
    return {
      orgId: locationOrg || requestedOrg || "platform",
      role: "platform_admin",
    };
  }

  const active = opts.memberships.filter((m) => m.status === "active" && m.orgId);

  if (requestedLoc) {
    if (!locationOrg) throw new TenancyDenied("Location not found");
    if (requestedOrg && requestedOrg !== locationOrg) {
      throw new TenancyDenied("Organization mismatch");
    }
    const mem = active.find(
      (m) =>
        m.orgId === locationOrg &&
        (m.locationId === requestedLoc || !m.locationId),
    );
    if (!mem) throw new TenancyDenied("Forbidden");
    return { orgId: locationOrg, role: mem.role };
  }

  if (requestedOrg) {
    const mem = active.find((m) => m.orgId === requestedOrg);
    if (!mem) throw new TenancyDenied("Forbidden");
    return { orgId: requestedOrg, role: mem.role };
  }

  throw new TenancyDenied("Select an organization");
}

export function extractTenantIds(input: unknown): {
  orgId: string | null;
  locationId: string | null;
} {
  if (!input || typeof input !== "object") return { orgId: null, locationId: null };
  const raw = input as Record<string, unknown>;
  const o =
    raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : raw;
  const orgId = typeof o.orgId === "string" && o.orgId.trim() ? o.orgId.trim() : null;
  const locationId =
    typeof o.locationId === "string" && o.locationId.trim() ? o.locationId.trim() : null;
  return { orgId, locationId };
}
