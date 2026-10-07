import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { floorSessionMiddleware } from "@/lib/pos/floor-session";
import { HOST_SCOPE, canEditSchedule, canViewPayroll, canViewSchedule } from "@/lib/access/entity-grants";
import { parseGrantMatrix } from "@/lib/access/entity-grants";
import { hashPin } from "@/lib/pos/pin";
import { saveShiftPattern } from "@/lib/labor/shift-patterns";

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
      station?: string;
      section?: string;
      breakMinutes?: number;
      patternId?: string;
    }[];
  }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    shifts: Array.isArray(d.shifts)
      ? d.shifts.slice(0, 400).map((s) => ({
          ...s,
          station: s.station ? String(s.station).slice(0, 80) : "",
          section: s.section ? String(s.section).slice(0, 80) : "",
          breakMinutes: Math.max(0, Math.round(Number(s.breakMinutes) || 0)),
          patternId: s.patternId ? String(s.patternId).slice(0, 80) : "",
        }))
      : [],
  }))
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const matrix = parseGrantMatrix(ctx.setup.entityPermissions);
    const hostEdit = Boolean((ctx.setup as { hostMayEditEntitySchedules?: boolean }).hostMayEditEntitySchedules);
    const peerVenue = Boolean(
      (ctx.setup as { peerVenue?: boolean; operatingModel?: string }).peerVenue ||
        (ctx.setup as { operatingModel?: string }).operatingModel === "peer_venue",
    );
    const emp = {
      role: ctx.role === "vendor" ? ("vendor_operator" as const) : ctx.role === "owner" || ctx.role === "manager" ? ctx.role : ("manager" as const),
      operatorId: ctx.operatorId === HOST_SCOPE ? undefined : ctx.operatorId,
    };
    for (const s of data.shifts) {
      const target = s.operatorId || HOST_SCOPE;
      if (!canEditSchedule(emp, matrix, target, hostEdit, peerVenue)) {
        throw new ForbiddenError("Cannot edit this entity’s schedule");
      }
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    for (const s of data.shifts) {
      await sql`
        insert into location_shifts (
          id, location_id, operator_id, employee_id, start_at, end_at, published, role,
          station, section, break_minutes, pattern_id
        )
        values (
          ${s.id}, ${data.locationId}, ${s.operatorId || HOST_SCOPE}, ${s.employeeId},
          ${new Date(s.start).toISOString()}, ${new Date(s.end).toISOString()},
          ${s.published}, ${s.role ?? null},
          ${s.station || null}, ${s.section || null}, ${s.breakMinutes || 0},
          ${s.patternId || null}
        )
        on conflict (id) do update set
          operator_id = excluded.operator_id,
          employee_id = excluded.employee_id,
          start_at = excluded.start_at,
          end_at = excluded.end_at,
          published = excluded.published,
          role = excluded.role,
          station = excluded.station,
          section = excluded.section,
          break_minutes = excluded.break_minutes,
          pattern_id = excluded.pattern_id
      `;
    }
    return { ok: true as const, count: data.shifts.length };
  });

export const deleteShiftsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; ids: string[] }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    ids: Array.isArray(d.ids)
      ? [...new Set(d.ids.map((id) => String(id ?? "").trim().slice(0, 80)).filter(Boolean))].slice(0, 400)
      : [],
  }))
  .handler(async ({ context, data }) => {
    if (!data.ids.length) return { ok: true as const, count: 0 };
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const matrix = parseGrantMatrix(ctx.setup.entityPermissions);
    const hostEdit = Boolean((ctx.setup as { hostMayEditEntitySchedules?: boolean }).hostMayEditEntitySchedules);
    const peerVenue = Boolean(
      (ctx.setup as { peerVenue?: boolean; operatingModel?: string }).peerVenue ||
        (ctx.setup as { operatingModel?: string }).operatingModel === "peer_venue",
    );
    const emp = {
      role: ctx.role === "vendor" ? ("vendor_operator" as const) : ctx.role === "owner" || ctx.role === "manager" ? ctx.role : ("manager" as const),
      operatorId: ctx.operatorId === HOST_SCOPE ? undefined : ctx.operatorId,
    };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    let count = 0;
    for (const id of data.ids) {
      const rows = await sql<{ operator_id: string | null }>`
        select operator_id from location_shifts
        where id = ${id} and location_id = ${data.locationId}
        limit 1
      `;
      const row = rows[0];
      if (!row) continue;
      const target = row.operator_id || HOST_SCOPE;
      if (!canEditSchedule(emp, matrix, target, hostEdit, peerVenue)) {
        throw new ForbiddenError("Cannot edit this entity’s schedule");
      }
      await sql`
        delete from location_shifts
        where id = ${id} and location_id = ${data.locationId}
      `;
      count += 1;
    }
    return { ok: true as const, count };
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
          station: string | null;
          section: string | null;
          break_minutes: number | null;
          pattern_id: string | null;
        }>`
          select id, employee_id, operator_id, start_at, end_at, published, role,
                 station, section, break_minutes, pattern_id
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
          station: string | null;
          section: string | null;
          break_minutes: number | null;
          pattern_id: string | null;
        }>`
          select id, employee_id, operator_id, start_at, end_at, published, role,
                 station, section, break_minutes, pattern_id
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
      station: r.station ?? "",
      section: r.section ?? "",
      breakMinutes: r.break_minutes ?? 0,
      patternId: r.pattern_id ?? "",
    }));
  });

function readPatternDays(raw: unknown): number[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    ),
  ].sort((a, b) => a - b);
}

function scheduleActor(ctx: { role: string; operatorId: string }): {
  role: "vendor_operator" | "owner" | "manager";
  operatorId: string | undefined;
} {
  const role =
    ctx.role === "vendor"
      ? "vendor_operator"
      : ctx.role === "owner"
        ? "owner"
        : "manager";
  return {
    role,
    operatorId: ctx.operatorId === HOST_SCOPE ? undefined : ctx.operatorId,
  };
}

export const listShiftPatternsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; operatorId: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    operatorId: String(d.operatorId ?? "").trim(),
  }))
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const matrix = parseGrantMatrix(ctx.setup.entityPermissions);
    if (!canViewSchedule(scheduleActor(ctx), matrix, data.operatorId || ctx.operatorId)) {
      throw new ForbiddenError("Cannot view this schedule");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      operator_id: string;
      name: string;
      days: unknown;
      start_hm: string;
      end_hm: string;
      role: string;
    }>`
      select id, operator_id, name, days, start_hm, end_hm, role
      from location_shift_patterns
      where location_id = ${data.locationId} and operator_id = ${data.operatorId}
      order by name asc
    `;
    return rows.map((r) => ({
      id: r.id,
      operatorId: r.operator_id,
      name: r.name,
      days: readPatternDays(r.days),
      startHm: r.start_hm,
      endHm: r.end_hm,
      role: r.role,
    }));
  });

export const saveShiftPatternFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    pattern: {
      id: string;
      operatorId: string;
      name: string;
      days: number[];
      startHm: string;
      endHm: string;
      role: string;
    };
  }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    pattern: {
      id: String(d.pattern?.id ?? "").trim().slice(0, 80),
      operatorId: String(d.pattern?.operatorId ?? "").trim().slice(0, 80),
      name: String(d.pattern?.name ?? "").trim().slice(0, 40),
      days: Array.isArray(d.pattern?.days) ? d.pattern.days.map((n) => Number(n)).slice(0, 7) : [],
      startHm: String(d.pattern?.startHm ?? "").trim().slice(0, 8),
      endHm: String(d.pattern?.endHm ?? "").trim().slice(0, 8),
      role: String(d.pattern?.role ?? "").trim().slice(0, 40),
    },
  }))
  .handler(async ({ context, data }) => {
    const saved = saveShiftPattern(data.pattern);
    if ("error" in saved) throw new Error(saved.error);
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const matrix = parseGrantMatrix(ctx.setup.entityPermissions);
    const hostEdit = Boolean((ctx.setup as { hostMayEditEntitySchedules?: boolean }).hostMayEditEntitySchedules);
    const peerVenue = Boolean(
      (ctx.setup as { peerVenue?: boolean; operatingModel?: string }).peerVenue ||
        (ctx.setup as { operatingModel?: string }).operatingModel === "peer_venue",
    );
    if (!canEditSchedule(scheduleActor(ctx), matrix, saved.operatorId, hostEdit, peerVenue)) {
      throw new ForbiddenError("Cannot edit this entity’s schedule");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into location_shift_patterns (
        id, location_id, operator_id, name, days, start_hm, end_hm, role
      )
      values (
        ${saved.id}, ${data.locationId}, ${saved.operatorId}, ${saved.name},
        ${JSON.stringify(saved.days)}::jsonb, ${saved.startHm}, ${saved.endHm}, ${saved.role}
      )
      on conflict (id) do update set
        operator_id = excluded.operator_id,
        name = excluded.name,
        days = excluded.days,
        start_hm = excluded.start_hm,
        end_hm = excluded.end_hm,
        role = excluded.role
    `;
    return saved;
  });

export const deleteShiftPatternFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string; operatorId: string; id: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: loc(d.locationId),
    operatorId: String(d.operatorId ?? "").trim().slice(0, 80),
    id: String(d.id ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
    const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
    const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
    const matrix = parseGrantMatrix(ctx.setup.entityPermissions);
    const hostEdit = Boolean((ctx.setup as { hostMayEditEntitySchedules?: boolean }).hostMayEditEntitySchedules);
    const peerVenue = Boolean(
      (ctx.setup as { peerVenue?: boolean; operatingModel?: string }).peerVenue ||
        (ctx.setup as { operatingModel?: string }).operatingModel === "peer_venue",
    );
    if (!canEditSchedule(scheduleActor(ctx), matrix, data.operatorId, hostEdit, peerVenue)) {
      throw new ForbiddenError("Cannot edit this entity’s schedule");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      delete from location_shift_patterns
      where id = ${data.id} and location_id = ${data.locationId} and operator_id = ${data.operatorId}
    `;
    return { ok: true as const };
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
      throw new ForbiddenError("Cannot view this hours export");
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
      insert into location_staff (id, location_id, operator_id, name, role, pin_hash, pin_display, active)
      values (${data.staffId}, ${data.locationId}, ${target || HOST_SCOPE}, ${data.staffId}, 'staff', ${pinHash}, ${data.pin}, true)
      on conflict (id) do update set pin_hash = excluded.pin_hash, pin_display = excluded.pin_display, operator_id = excluded.operator_id
    `;
    return { ok: true as const };
  });

export const upsertPunchFn = createServerFn({ method: "POST" })
  .middleware([floorSessionMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      stationDeviceId?: string;
      stationPin?: string;
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
      stationDeviceId: String(d.stationDeviceId ?? "").trim().slice(0, 80),
      stationPin: String(d.stationPin ?? "").replace(/\D/g, "").slice(0, 8),
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
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    let orgId = data.orgId;
    let locationId = data.locationId;
    let employerId = data.punch.employerId || HOST_SCOPE;
    if (context.userId) {
      const { loadEntityWriteContext } = await import("@/lib/access/assert-entity.server");
      const ctx = await loadEntityWriteContext(context.userId, data.orgId, data.locationId);
      employerId = data.punch.employerId || ctx.operatorId || HOST_SCOPE;
      if (ctx.role === "vendor" && ctx.operatorId !== employerId && ctx.operatorId !== HOST_SCOPE) {
        const { ForbiddenError } = await import("@/lib/saas/tenancy.server");
        throw new ForbiddenError("Clock is scoped to your employer entity");
      }
      orgId = ctx.orgId;
      locationId = ctx.locationId;
    } else {
      const { authorizeStationFloor } = await import("@/lib/pos/station-pin-auth.server");
      const { UnauthorizedError } = await import("@/lib/auth/verify.server");
      const grant = await authorizeStationFloor({
        pin: data.stationPin,
        deviceId: data.stationDeviceId,
        locationId: data.locationId,
      });
      if (!grant.ok) {
        const err = new UnauthorizedError();
        if (grant.error) err.message = grant.error;
        throw err;
      }
      orgId = grant.grant.orgId;
      locationId = grant.grant.locationId;
    }
    const inAt = new Date(data.punch.clockInAt).toISOString();
    const outAt = data.punch.clockOutAt ? new Date(data.punch.clockOutAt).toISOString() : null;
    await sql`
      insert into location_punches (
        id, org_id, location_id, employer_id, employee_id, employee_name,
        clock_in_at, clock_out_at, regular_minutes, ot_minutes, status, updated_at
      ) values (
        ${data.punch.id}, ${orgId}, ${locationId}, ${employerId},
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
