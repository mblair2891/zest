import { getSql } from "@/lib/db";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";

const HOST_WRITE = ["owner", "manager", "platform_admin"] as const;

/** Location-level / payout writes: subscriber host only — never vendor membership. */
export async function assertHostLocationWrite(userId: string, locationId: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ org_id: string }>`
    select org_id from locations
    where id = ${locationId} and coalesce(is_demo, false) = false
    limit 1
  `;
  const orgId = rows[0]?.org_id;
  if (!orgId) throw new ForbiddenError("Location not found");
  const access = await requireMembership(userId, orgId, [...HOST_WRITE], locationId);
  if (access.role === "vendor") {
    throw new ForbiddenError("Guest operators cannot change host settings or payouts");
  }
}

export async function assertHostOrgWrite(userId: string, orgId: string, locationId?: string | null) {
  const access = await requireMembership(userId, orgId, [...HOST_WRITE], locationId);
  if (access.role === "vendor") {
    throw new ForbiddenError("Guest operators cannot change host settings or payouts");
  }
  return access;
}
