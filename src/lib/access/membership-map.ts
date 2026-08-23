import type { MembershipRole } from "@/lib/saas/types";
import type { EmployeeRole } from "@/lib/pos/types";

/** Map org membership onto a location PIN role. Platform admin is not a floor role. */
export function membershipToEmployeeRole(
  role: MembershipRole | string | null | undefined,
): EmployeeRole | null {
  switch (role) {
    case "owner":
      return "owner";
    case "manager":
      return "manager";
    case "cashier":
      return "cashier";
    case "vendor":
      return "vendor_operator";
    case "accountant":
      return "accountant";
    case "server":
      return "server";
    case "host":
      return "host";
    case "bartender":
      return "bartender";
    case "kitchen":
      return "kitchen";
    case "staff":
      return "server";
    case "platform_admin":
      return null;
    default:
      return null;
  }
}

export const SETTINGS_WRITE_MEMBERSHIP: MembershipRole[] = [
  "owner",
  "manager",
  "platform_admin",
];
