import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "./tenant-middleware";
import type { TenantUserKind } from "./tenant-users";

export const listTenantUsersFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { orgId: string; locationId: string }) => ({
    orgId: String(d.orgId ?? "").trim(),
    locationId: String(d.locationId ?? "").trim(),
  }))
  .handler(async ({ context, data }) => {
    const { listTenantUsers } = await import("./tenant-users.server");
    return listTenantUsers(context.userId, data.orgId, data.locationId);
  });

export const addLocationAdminFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      name: string;
      email: string;
      tempPassword?: string;
      forceChange?: boolean;
      operatorId?: string | null;
      role?: string;
    }) => ({
      orgId: String(d.orgId ?? "").trim(),
      locationId: String(d.locationId ?? "").trim(),
      name: String(d.name ?? "").trim().slice(0, 80),
      email: String(d.email ?? "").trim().slice(0, 160),
      tempPassword: d.tempPassword ? String(d.tempPassword).slice(0, 80) : "",
      forceChange: d.forceChange !== false,
      operatorId: d.operatorId ? String(d.operatorId).trim().slice(0, 80) : null,
      role: d.role ? String(d.role).trim() : "",
    }),
  )
  .handler(async ({ context, data }) => {
    const { rateLimit } = await import("./rate-limit.server");
    if (rateLimit(`tenant-admin:${context.userId}`, 20, 60_000)) {
      throw new Error("Too many user adds — try again in a minute");
    }
    const { addLocationAdmin } = await import("./tenant-users.server");
    return addLocationAdmin(context.userId, data);
  });

export const addFloorStaffFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      employeeNumber?: string;
      payRateType?: string;
      payAmount?: string;
      hireDate?: string | null;
      employmentStatus?: string;
      email?: string;
      phone?: string;
      position?: string;
      pin: string;
      role: string;
      homeEntityId?: string | null;
    }) => ({
      orgId: String(d.orgId ?? "").trim(),
      locationId: String(d.locationId ?? "").trim(),
      name: String(d.name ?? "").trim().slice(0, 80),
      firstName: String(d.firstName ?? "").trim().slice(0, 80),
      lastName: String(d.lastName ?? "").trim().slice(0, 80),
      displayName: String(d.displayName ?? "").trim().slice(0, 80),
      employeeNumber: String(d.employeeNumber ?? "").trim().slice(0, 40),
      payRateType: String(d.payRateType ?? "hourly").trim(),
      payAmount: String(d.payAmount ?? "").trim().slice(0, 20),
      hireDate: d.hireDate ? String(d.hireDate).slice(0, 10) : null,
      employmentStatus: String(d.employmentStatus ?? "active").trim(),
      email: String(d.email ?? "").trim().slice(0, 160),
      phone: String(d.phone ?? "").trim().slice(0, 40),
      position: String(d.position ?? "").trim().slice(0, 80),
      pin: String(d.pin ?? "").replace(/\D/g, "").slice(0, 8),
      role: String(d.role ?? "server").trim(),
      homeEntityId: d.homeEntityId ? String(d.homeEntityId).trim().slice(0, 80) : null,
    }),
  )
  .handler(async ({ context, data }) => {
    const { addFloorStaff } = await import("./tenant-users.server");
    return addFloorStaff(context.userId, data);
  });

export const updateTenantUserFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      kind: string;
      id: string;
      role?: string;
      status?: string;
      homeEntityId?: string | null;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      employeeNumber?: string;
      payRateType?: string;
      payAmount?: string;
      hireDate?: string | null;
      employmentStatus?: string;
      email?: string;
      phone?: string;
      position?: string;
    }) => ({
      orgId: String(d.orgId ?? "").trim(),
      locationId: String(d.locationId ?? "").trim(),
      kind: (d.kind === "floor" ? "floor" : "login") as TenantUserKind,
      id: String(d.id ?? "").trim().slice(0, 80),
      role: d.role ? String(d.role).trim() : undefined,
      status:
        d.status === "disabled" || d.status === "active"
          ? (d.status as "active" | "disabled")
          : undefined,
      homeEntityId:
        d.homeEntityId === undefined
          ? undefined
          : d.homeEntityId
            ? String(d.homeEntityId).trim().slice(0, 80)
            : null,
      firstName: d.firstName === undefined ? undefined : String(d.firstName).trim().slice(0, 80),
      lastName: d.lastName === undefined ? undefined : String(d.lastName).trim().slice(0, 80),
      displayName: d.displayName === undefined ? undefined : String(d.displayName).trim().slice(0, 80),
      employeeNumber:
        d.employeeNumber === undefined ? undefined : String(d.employeeNumber).trim().slice(0, 40),
      payRateType: d.payRateType === undefined ? undefined : String(d.payRateType).trim(),
      payAmount: d.payAmount === undefined ? undefined : String(d.payAmount).trim().slice(0, 20),
      hireDate: d.hireDate === undefined ? undefined : d.hireDate ? String(d.hireDate).slice(0, 10) : null,
      employmentStatus:
        d.employmentStatus === undefined ? undefined : String(d.employmentStatus).trim(),
      email: d.email === undefined ? undefined : String(d.email).trim().slice(0, 160),
      phone: d.phone === undefined ? undefined : String(d.phone).trim().slice(0, 40),
      position: d.position === undefined ? undefined : String(d.position).trim().slice(0, 80),
    }),
  )
  .handler(async ({ context, data }) => {
    const { updateTenantUser } = await import("./tenant-users.server");
    return updateTenantUser(context.userId, data);
  });

export const resetTenantUserSecretFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(
    (d: {
      orgId: string;
      locationId: string;
      kind: string;
      id: string;
      pin?: string;
    }) => ({
      orgId: String(d.orgId ?? "").trim(),
      locationId: String(d.locationId ?? "").trim(),
      kind: (d.kind === "floor" ? "floor" : "login") as TenantUserKind,
      id: String(d.id ?? "").trim().slice(0, 80),
      pin: d.pin ? String(d.pin).replace(/\D/g, "").slice(0, 8) : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const { resetTenantUserSecret } = await import("./tenant-users.server");
    return resetTenantUserSecret(context.userId, data);
  });
