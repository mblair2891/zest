import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { HOST_SCOPE, canEditSchedule, canViewPayroll, canViewSchedule } from "@/lib/access/entity-grants";
import { parseGrantMatrix } from "@/lib/access/entity-grants";
import { hashPin } from "@/lib/pos/pin";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

export const saveShiftsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
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
  .middleware([tenantMiddleware])
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
  .middleware([tenantMiddleware])
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
  .middleware([tenantMiddleware])
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
    pin: String(d.pin ?? "").replace(/\D/g, "").slice(0, 8),
    operatorId: d.operatorId ? String(d.operatorId).trim() : null,
  }))
  .handler(async ({ context, data }) => {
    let pinLen = 4;
    try {
      const { getPinLength } = await import("@/lib/saas/platform-settings.server");
      pinLen = await getPinLength();
    } catch {
      pinLen = 4;
    }
    if (!new RegExp(`^\\d{${pinLen}}$`).test(data.pin)) {
      throw new Error(`PIN must be ${pinLen} digits`);
    }
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

export const upsertPunchFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      punch: {
        id: string;
        employeeId: string;
        employeeName: string;
        employerId?: string | null;
        clockInAt: number;
        clockOutAt?: number | null;
        regularMinutes?: number;
        otMinutes?: number;
        status: string;
      };
    }) => ({
      orgId: String(d.orgId ?? "").trim(),
      locationId: loc(d.locationId),
      punch: {
        id: String(d.punch.id ?? "").slice(0, 80),
        employeeId: String(d.punch.employeeId ?? "").slice(0, 80),
        employeeName: String(d.punch.employeeName ?? "").slice(0, 120),
        employerId: String(d.punch.employerId ?? HOST_SCOPE).slice(0, 80) || HOST_SCOPE,
        clockInAt: Number(d.punch.clockInAt) || Date.now(),
        clockOutAt: d.punch.clockOutAt ? Number(d.punch.clockOutAt) : null,
        regularMinutes: Math.max(0, Math.round(Number(d.punch.regularMinutes) || 0)),
        otMinutes: Math.max(0, Math.round(Number(d.punch.otMinutes) || 0)),
        status: String(d.punch.status ?? "open").slice(0, 40),
      },
    }),
  )
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const employerId = data.punch.employerId || ctx.operatorId || HOST_SCOPE;
    if (ctx.role === "vendor" && ctx.operatorId !== employerId && ctx.operatorId !== HOST_SCOPE) {
      const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
      throw new ForbiddenError("Clock is scoped to your employer entity");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const inAt = new Date(data.punch.clockInAt).toISOString();
    const outAt = data.punch.clockOutAt ? new Date(data.punch.clockOutAt).toISOString() : null;
    await sql`
      insert into location_punches (
        id, org_id, location_id, employer_id, employee_id, employee_name,
        clock_in_at, clock_out_at, regular_minutes, ot_minutes, status, updated_at
      ) values (
        ${data.punch.id}, ${ctx.orgId}, ${ctx.locationId}, ${employerId},
        ${data.punch.employeeId}, ${data.punch.employeeName},
        ${inAt}, ${outAt}, ${data.punch.regularMinutes}, ${data.punch.otMinutes},
        ${data.punch.status}, now()
      )
      on conflict (id) do update set
        clock_out_at = excluded.clock_out_at,
        regular_minutes = excluded.regular_minutes,
        ot_minutes = excluded.ot_minutes,
        status = excluded.status,
        employee_name = excluded.employee_name,
        updated_at = now()
    `;
    return { ok: true as const };
  });
