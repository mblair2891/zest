import { getSql } from "@/lib/db";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import type { LocationSetup, MembershipRole } from "@/lib/saas/types";
import { EMPTY_LOCATION_SETUP } from "@/lib/saas/types";
import {
  HOST_SCOPE,
  canEntityGrant,
  parseGrantMatrix,
  type EntityGrantKey,
} from "./entity-grants";
import { canWriteEntityResource } from "./entity-write-rules";

const HOST_WRITE: MembershipRole[] = ["owner", "manager", "platform_admin"];

export type EntityWriteContext = {
  userId: string;
  orgId: string;
  locationId: string;
  role: MembershipRole;
  isPlatformAdmin: boolean;
  operatorId: string;
  setup: LocationSetup;
};

function setupOf(raw: unknown): LocationSetup {
  if (!raw || typeof raw !== "object") return { ...EMPTY_LOCATION_SETUP };
  return { ...EMPTY_LOCATION_SETUP, ...(raw as LocationSetup) };
}

export async function loadEntityWriteContext(
  userId: string,
  orgId: string,
  locationId: string,
): Promise<EntityWriteContext> {
  const access = await requireMembership(userId, orgId, undefined, locationId);
  const sql = await getSql();
  const rows = await sql<{ setup: unknown; operator_id: string | null }>`
    select l.setup, m.operator_id
    from locations l
    left join memberships m
      on m.user_id = ${userId}
     and m.org_id = ${orgId}
     and m.status = 'active'
     and (m.location_id = ${locationId} or m.location_id is null)
    where l.id = ${locationId} and l.org_id = ${orgId} and coalesce(l.is_demo, false) = false
    order by m.location_id desc nulls last
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Location not found");
  const host = access.isPlatformAdmin || HOST_WRITE.includes(access.role);
  const operatorId =
    host && !row.operator_id ? HOST_SCOPE : String(row.operator_id ?? "").trim() || HOST_SCOPE;
  return {
    userId,
    orgId,
    locationId,
    role: access.role,
    isPlatformAdmin: access.isPlatformAdmin,
    operatorId,
    setup: setupOf(row.setup),
  };
}

/** Menu / settings / report writes: resource.operatorId must match caller scope or host privilege. */
export function assertEntityResourceWrite(
  ctx: EntityWriteContext,
  resourceOperatorId: string | null | undefined,
  grant: EntityGrantKey = "edit_menu",
): void {
  if (
    canWriteEntityResource({
      isPlatformAdmin: ctx.isPlatformAdmin,
      role: ctx.role,
      operatorId: ctx.operatorId,
      resourceOperatorId,
      matrix: ctx.setup.entityPermissions,
      grant,
    })
  ) {
    return;
  }
  throw new ForbiddenError("Not permitted for this operator");
}

export function assertHostOrManageDevices(ctx: EntityWriteContext, targetOperatorId: string): void {
  if (ctx.isPlatformAdmin) return;
  if (HOST_WRITE.includes(ctx.role) && ctx.operatorId === HOST_SCOPE && ctx.role !== "vendor") {
    return;
  }
  const matrix = parseGrantMatrix(ctx.setup.entityPermissions);
  if (canEntityGrant(matrix, ctx.operatorId, targetOperatorId, "manage_devices")) return;
  throw new ForbiddenError("Device assignment is host-managed");
}
