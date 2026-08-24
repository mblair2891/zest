import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { HOST_SCOPE, canEditSchedule, canViewPayroll, canViewSchedule } from "@/lib/access/entity-grants";
import { parseGrantMatrix } from "@/lib/access/entity-grants";
import { hashPin, isFourDigitPin } from "@/lib/pos/pin";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

export const saveShiftsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    shifts: {
      id: string;
      employeeId: string;
      operatorId: string;
      start: number;
      end: number;
      published: boolean;
      role?: string;
    }[];
  }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    shifts: Array.isArray(d.shifts) ? d.shifts.slice(0, 400) : [],
  }))
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const matrix = parseGrantMatrix(ctx.setup.entityPermissions);
    const hostEdit = Boolean((ctx.setup as { hostMayEditEntitySchedules?: boolean }).hostMayEditEntitySchedules);
    const emp = {
      role: ctx.role === "vendor" ? ("vendor_operator" as const) : ctx.role === "owner" || ctx.role === "manager" ? ctx.role : ("manager" as const),
      operatorId: ctx.operatorId === HOST_SCOPE ? undefined : ctx.operatorId,
    };
    for (const s of data.shifts) {
      const target = s.operatorId || HOST_SCOPE;
      if (!canEditSchedule(emp, matrix, target, hostEdit)) {
        throw new ForbiddenError("Cannot edit this entity’s schedule");
      }
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    for (const s of data.shifts) {
      await sql`
        insert into location_shifts (
          id, location_id, operator_id, employee_id, start_at, end_at, published, role
        )
        values (
          ${s.id}, ${data.locationId}, ${s.operatorId || HOST_SCOPE}, ${s.employeeId},
          ${new Date(s.start).toISOString()}, ${new Date(s.end).toISOString()},
          ${s.published}, ${s.role ?? null}
        )
        on conflict (id) do update set
          operator_id = excluded.operator_id,
          employee_id = excluded.employee_id,
          start_at = excluded.start_at,
          end_at = excluded.end_at,
          published = excluded.published,
          role = excluded.role
      `;
    }
    return { ok: true as const, count: data.shifts.length };
  });

export const listShiftsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; locationId: string; operatorId?: string | null }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    operatorId: d.operatorId ? String(d.operatorId).trim() : null,
  }))
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const matrix = parseGrantMatrix(ctx.setup.entityPermissions);
    const emp = {
      role: ctx.role === "vendor" ? ("vendor_operator" as const) : ctx.role === "owner" || ctx.role === "manager" ? ctx.role : ("manager" as const),
      operatorId: ctx.operatorId === HOST_SCOPE ? undefined : ctx.operatorId,
    };
    const target = data.operatorId || ctx.operatorId;
    if (!canViewSchedule(emp, matrix, target)) {
      throw new ForbiddenError("Cannot view this schedule");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = data.operatorId
      ? await sql<{
          id: string;
          employee_id: string;
          operator_id: string | null;
          start_at: unknown;
          end_at: unknown;
          published: boolean;
          role: string | null;
        }>`
          select id, employee_id, operator_id, start_at, end_at, published, role
          from location_shifts
          where location_id = ${data.locationId} and operator_id = ${data.operatorId}
          order by start_at asc
        `
      : await sql<{
          id: string;
          employee_id: string;
          operator_id: string | null;
          start_at: unknown;
          end_at: unknown;
          published: boolean;
          role: string | null;
        }>`
          select id, employee_id, operator_id, start_at, end_at, published, role
          from location_shifts
          where location_id = ${data.locationId}
          order by start_at asc
        `;
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      operatorId: r.operator_id ?? HOST_SCOPE,
      start: new Date(r.start_at as string | number | Date).getTime() || 0,
      end: new Date(r.end_at as string | number | Date).getTime() || 0,
      published: Boolean(r.published),
      role: r.role ?? "",
    }));
  });

export const payrollReportFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; locationId: string; operatorId?: string | null }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    operatorId: d.operatorId ? String(d.operatorId).trim() : null,
  }))
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const matrix = parseGrantMatrix(ctx.setup.entityPermissions);
    const emp = {
      role: ctx.role === "vendor" ? ("vendor_operator" as const) : ctx.role === "owner" || ctx.role === "manager" ? ctx.role : ("manager" as const),
      operatorId: ctx.operatorId === HOST_SCOPE ? undefined : ctx.operatorId,
    };
    const target = data.operatorId || ctx.operatorId;
    if (!canViewPayroll(emp, matrix, target)) {
      throw new ForbiddenError("Cannot view this payroll");
    }
    return { ok: true as const, operatorId: target };
  });

export const setStaffPinFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    staffId: string;
    pin: string;
    operatorId?: string | null;
  }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    staffId: String(d.staffId ?? "").trim().slice(0, 80),
    pin: String(d.pin ?? "").replace(/\D/g, "").slice(0, 4),
    operatorId: d.operatorId ? String(d.operatorId).trim() : null,
  }))
  .handler(async ({ context, data }) => {
    if (!isFourDigitPin(data.pin)) throw new Error("PIN must be 4 digits");
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const target = data.operatorId || ctx.operatorId;
    if (ctx.role === "vendor" && ctx.operatorId !== target) {
      throw new ForbiddenError("You can only set PINs for your entity");
    }
    if (ctx.role !== "owner" && ctx.role !== "manager" && ctx.role !== "vendor" && !ctx.isPlatformAdmin) {
      throw new ForbiddenError("Back office only");
    }
    const pinHash = hashPin(data.pin, data.locationId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into location_staff (id, location_id, operator_id, name, role, pin_hash, active)
      values (${data.staffId}, ${data.locationId}, ${target || HOST_SCOPE}, ${data.staffId}, 'staff', ${pinHash}, true)
      on conflict (id) do update set pin_hash = excluded.pin_hash, operator_id = excluded.operator_id
    `;
    return { ok: true as const };
  });
