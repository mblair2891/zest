import type { EmployeeRole, EntityId } from "@/lib/pos/types";
import type { GuideRole } from "./types";

/** Map a POS PIN role (+ optional venue) onto one or more guide audiences. */
export function employeeToGuideRoles(
  role: EmployeeRole | null | undefined,
  venue?: EntityId | null,
): GuideRole[] {
  if (!role) return [];
  const out: GuideRole[] = [];
  if (role === "owner" || role === "manager") {
    out.push("owner_manager");
    if (venue === "food_hall" || venue === "truck_pod") {
      out.push("host_operator");
    }
  }
  if (role === "server" || role === "host" || role === "busser" || role === "cashier") {
    out.push("server");
  }
  if (role === "bartender" || role === "kitchen") {
    out.push("kitchen_bar");
  }
  if (role === "vendor_operator") out.push("vendor_operator");
  if (role === "accountant") out.push("owner_manager");
  return out;
}

export function saasRoleToGuideRoles(
  saasRole: string | null | undefined,
  isPlatformAdmin?: boolean,
): GuideRole[] {
  if (isPlatformAdmin || saasRole === "platform_admin") {
    return ["platform_admin"];
  }
  if (saasRole === "owner" || saasRole === "manager") {
    return ["owner_manager", "host_operator"];
  }
  if (saasRole === "vendor" || saasRole === "operator") {
    return ["vendor_operator"];
  }
  if (saasRole === "accountant") return ["owner_manager"];
  if (saasRole === "staff" || saasRole === "server" || saasRole === "cashier") {
    return ["server"];
  }
  if (saasRole === "bartender" || saasRole === "kitchen") return ["kitchen_bar"];
  if (saasRole === "host") return ["server"];
  return [];
}

export function topicMatchesRoles(
  audience: GuideRole[] | "all",
  roles: GuideRole[] | "all",
): boolean {
  if (audience === "all" || roles === "all") return true;
  if (roles.length === 0) return true;
  return audience.some((r) => roles.includes(r));
}
