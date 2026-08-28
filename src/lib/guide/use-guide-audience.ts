import { useMemo } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { PLATFORM_ADMIN_EMAIL } from "@/lib/platform/brand";
import { employeeToGuideRoles, saasRoleToGuideRoles } from "./roles";
import type { GuideRole } from "./types";

export type GuideAudienceState = {
  roles: GuideRole[];
  /** Stable key for progress (account, PIN, or local). */
  userKey: string;
  /** True when we could infer a session role — otherwise the UI shows All. */
  hasSessionRole: boolean;
};

export function useGuideAudience(): GuideAudienceState {
  const { user } = useCurrentUserState();
  const employees = usePosStore((s) => s.employees);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const venue = usePosStore((s) => s.activeEntityId);
  const emp = employees.find((e) => e.id === currentEmployeeId) ?? null;
  const platformAdminRole = useSaasStore((s) => s.platformAdminRole);
  const platformAuthed = useSaasStore((s) => s.platformAuthed);

  return useMemo(() => {
    const roles = new Set<GuideRole>();
    if (emp) {
      for (const r of employeeToGuideRoles(emp.role, venue)) roles.add(r);
    }
    const isAdminEmail = user?.primaryEmail?.toLowerCase() === PLATFORM_ADMIN_EMAIL;
    if (platformAuthed || isAdminEmail) {
      for (const r of saasRoleToGuideRoles(platformAdminRole, isAdminEmail)) {
        roles.add(r);
      }
    }
    const list = [...roles];
    const userKey = user?.id
      ? `acct:${user.id}`
      : emp
        ? `emp:${emp.id}`
        : "local";
    return {
      roles: list,
      userKey,
      hasSessionRole: list.length > 0,
    };
  }, [
    emp,
    venue,
    user?.id,
    user?.primaryEmail,
    platformAdminRole,
    platformAuthed,
  ]);
}
