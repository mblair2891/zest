/**
 * Pure helpers for the platform Tenants → Users tab.
 * Location admin = membership owner (product: venue_owner). Never platform_admin.
 */
import type { MembershipRole } from "./types";
import type { EmployeeRole } from "../pos/types";

export const VENUE_OWNER_ROLE = "owner" as const;

export const TENANT_LOGIN_ROLES: MembershipRole[] = [
  "owner",
  "manager",
  "cashier",
  "staff",
  "vendor",
  "server",
  "host",
  "bartender",
  "kitchen",
  "accountant",
];

export const TENANT_FLOOR_ROLES: EmployeeRole[] = [
  "server",
  "host",
  "bartender",
  "kitchen",
  "busser",
  "cashier",
  "supervisor",
  "manager",
  "owner",
  "vendor_operator",
];

export const TENANT_USERS_EMPTY = "No location admins or floor staff on this venue yet.";

export const TENANT_USERS_CIRCLE_COPY = "No users yet. Add people on the platform.";

export function tenantConsoleLoginUrl(appUrl?: string): string {
  const raw = (appUrl || "https://app.summex.app").trim();
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "summex.app") return "https://app.summex.app/login";
    return `${u.origin}/login`;
  } catch {
    return "https://app.summex.app/login";
  }
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const e = (email || "").trim().toLowerCase();
  return e === "admin@summex.local";
}

export function parseTenantLoginRole(raw: string): MembershipRole {
  const v = raw.trim().toLowerCase();
  if (v === "venue_owner" || v === "location_admin") return "owner";
  if (v === "platform_admin") {
    throw new Error("Cannot create a second platform Admin.");
  }
  if ((TENANT_LOGIN_ROLES as readonly string[]).includes(v)) return v as MembershipRole;
  throw new Error("That role is not allowed for a location user.");
}

export function parseTenantFloorRole(raw: string): EmployeeRole {
  const v = raw.trim().toLowerCase();
  if (v === "platform_admin" || v === "venue_owner") {
    throw new Error("Floor staff use a PIN role — not platform Admin.");
  }
  if ((TENANT_FLOOR_ROLES as readonly string[]).includes(v)) return v as EmployeeRole;
  throw new Error("Choose a floor role.");
}

export function loginRoleLabel(role: string): string {
  if (role === "owner" || role === "venue_owner") return "Location admin";
  if (role === "platform_admin") return "Platform Admin";
  if (!role) return "Staff";
  return role.replaceAll("_", " ");
}

export function floorRoleLabel(role: string): string {
  if (role === "vendor_operator") return "Vendor";
  if (!role) return "Staff";
  return role.replaceAll("_", " ");
}

/** Demo houses stay off other tenants' sessions; members of that demo may sign in. */
export function demoVenueIsolated(opts: {
  isDemo: boolean;
  isPlatformAdmin: boolean;
  hasOrgMembership: boolean;
}): boolean {
  if (!opts.isDemo) return false;
  if (opts.isPlatformAdmin || opts.hasOrgMembership) return false;
  return true;
}

export type TenantUserKind = "login" | "floor";

export type TenantUserRow = {
  id: string;
  kind: TenantUserKind;
  userId?: string;
  name: string;
  email?: string;
  role: string;
  status: "active" | "disabled";
  mustChangePassword?: boolean;
  homeEntityId?: string | null;
  homeEntityName?: string | null;
  locationId?: string | null;
};

export function assertNotPlatformAdminRole(role: string): void {
  if (role.trim().toLowerCase() === "platform_admin") {
    throw new Error("Cannot create a second platform Admin.");
  }
}
