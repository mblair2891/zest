import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import type { OpsDecisionAction, OpsFeatureSnapshot, OpsRecType } from "./types";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

export const recordOpsDecisionFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    operatorId?: string | null;
    recType: OpsRecType;
    recId: string;
    action: OpsDecisionAction;
    features: OpsFeatureSnapshot;
  }) => ({
    locationId: loc(d.locationId),
    operatorId: d.operatorId ? String(d.operatorId).slice(0, 80) : null,
    recType: String(d.recType ?? "labor_high").slice(0, 40) as OpsRecType,
    recId: String(d.recId ?? "").slice(0, 80),
    action: (["accept", "dismiss", "snooze"].includes(d.action) ? d.action : "dismiss") as OpsDecisionAction,
    features: d.features,
  }))
  .handler(async ({ context, data }) => {
    const { bindTenant } = await import("@/lib/saas/assert-tenant.server");
    await bindTenant(context.userId, { locationId: data.locationId });
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const id = `oad_${Math.random().toString(36).slice(2, 12)}`;
    await sql`
      insert into ops_ai_decisions (
        id, location_id, operator_id, user_id, rec_type, rec_id, action, features
      )
      values (
        ${id}, ${data.locationId}, ${data.operatorId}, ${context.userId},
        ${data.recType}, ${data.recId}, ${data.action}, ${JSON.stringify(data.features)}::jsonb
      )
    `;
    return { ok: true as const, id };
  });
