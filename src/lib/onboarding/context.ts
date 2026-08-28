import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useDemoDeviceStore, type DemoDevice } from "@/lib/demo/device-session";
import { isProspectDemo } from "@/lib/demo/session";
import { employeeToGuideRoles, saasRoleToGuideRoles } from "@/lib/guide/roles";
import type { GuideRole } from "@/lib/guide/types";
import { PLATFORM_ADMIN_EMAIL } from "@/lib/platform/brand";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import type { Employee, EmployeeRole, VenueEntityId } from "@/lib/pos/types";
import { isVenueEntityId } from "@/lib/pos/entities";

export type WalkthroughKey =
  | EmployeeRole
  | "kds_kitchen"
  | "kds_bar"
  | "platform_admin";

export type OnboardingContext = {
  userKey: string;
  walkthroughKey: WalkthroughKey | null;
  employeeRole: EmployeeRole | null;
  guideRoles: GuideRole[];
  entityType: VenueEntityId | null;
  isPlatformAdmin: boolean;
  isDemo: boolean;
  demoDevice: DemoDevice;
  demoEntered: boolean;
  emp: Employee | null;
};

export function walkthroughTourId(key: WalkthroughKey): string {
  return `walkthrough:${key}`;
}

export function walkthroughLabel(key: WalkthroughKey): string {
  switch (key) {
    case "owner":
      return "Owner";
    case "manager":
      return "Manager";
    case "server":
      return "Server";
    case "host":
      return "Host stand";
    case "bartender":
      return "Bartender";
    case "kitchen":
      return "Kitchen";
    case "busser":
      return "Server";
    case "cashier":
      return "Cashier";
    case "vendor_operator":
      return "Vendor operator";
    case "accountant":
      return "Accountant";
    case "kiosk":
      return "Guest kiosk";
    case "kds_kitchen":
      return "Kitchen ODS";
    case "kds_bar":
      return "Bar ODS";
    case "platform_admin":
      return "Platform Admin";
    default:
      return key;
  }
}

export function resolveWalkthroughKey(opts: {
  pathname: string;
  emp: Employee | null;
  demoDevice: DemoDevice;
  demoEntered: boolean;
  isPlatformAdmin: boolean;
}): WalkthroughKey | null {
  if (opts.demoEntered && opts.demoDevice === "kiosk") return "kiosk";
  if (opts.demoEntered && opts.demoDevice === "kds_kitchen") return "kds_kitchen";
  if (opts.demoEntered && opts.demoDevice === "kds_bar") return "kds_bar";
  if (opts.emp) {
    if (opts.emp.role === "busser") return "server";
    return opts.emp.role;
  }
  if (
    opts.isPlatformAdmin &&
    /^\/(dashboard|platform|pipeline)(\/|$)/.test(opts.pathname)
  ) {
    return "platform_admin";
  }
  return null;
}

export function currentOnboardingUserKey(): string {
  try {
    const pos = usePosStore.getState();
    const emp = pos.employees.find((e) => e.id === pos.currentEmployeeId) ?? null;
    if (emp) return `emp:${emp.id}`;
  } catch {
    /* store not ready */
  }
  return "local";
}

export function useOnboardingContext(pathname: string): OnboardingContext {
  const { user } = useCurrentUserState();
  const employees = usePosStore((s) => s.employees);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const activeEntityId = usePosStore((s) => s.activeEntityId);
  const platformAdminRole = useSaasStore((s) => s.platformAdminRole);
  const platformAuthed = useSaasStore((s) => s.platformAuthed);
  const demoEntered = useDemoDeviceStore((s) => s.entered);
  const demoDevice = useDemoDeviceStore((s) => s.device);
  const demoEmployeeId = useDemoDeviceStore((s) => s.employeeId);
  const isDemo = isProspectDemo();
  const emp =
    employees.find((e) => e.id === currentEmployeeId) ??
    (demoEmployeeId
      ? (employees.find((e) => e.id === demoEmployeeId) ?? null)
      : null);

  const isAdminEmail = user?.primaryEmail?.toLowerCase() === PLATFORM_ADMIN_EMAIL;
  const isPlatformAdmin = platformAuthed || isAdminEmail;

  const roles = new Set<GuideRole>();
  if (emp) {
    for (const r of employeeToGuideRoles(emp.role, activeEntityId)) roles.add(r);
  }
  if (isPlatformAdmin) {
    for (const r of saasRoleToGuideRoles(platformAdminRole, true)) roles.add(r);
  }

  const userKey = user?.id
    ? `acct:${user.id}`
    : emp
      ? `emp:${emp.id}`
      : isDemo
        ? "demo:local"
        : "local";

  const walkthroughKey = resolveWalkthroughKey({
    pathname,
    emp,
    demoDevice,
    demoEntered: isDemo && demoEntered,
    isPlatformAdmin,
  });

  const entityType =
    activeEntityId && isVenueEntityId(activeEntityId) ? activeEntityId : null;

  return {
    userKey,
    walkthroughKey,
    employeeRole: emp?.role ?? null,
    guideRoles: [...roles],
    entityType,
    isPlatformAdmin,
    isDemo,
    demoDevice,
    demoEntered: isDemo && demoEntered,
    emp,
  };
}

/** Product surfaces where login onboarding may run. */
export function isOnboardingSurface(pathname: string): boolean {
  if (/^\/(dashboard|platform|pipeline)(\/|$)/.test(pathname)) return true;
  if (/^\/kiosk(\/|$)/.test(pathname)) return true;
  if (/^\/venue\//.test(pathname)) return true;
  if (/^\/app(\/|$)/.test(pathname)) return true;
  return false;
}
