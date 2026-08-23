import type { LocationMode } from "@/lib/pos/saas-types";
import type { MembershipRole, OrgStatus, PlanSlug } from "@/lib/saas/types";

/** Injected into every authenticated tenant-scoped request. */
export type ActiveTenantContext = {
  userId: string;
  organizationId: string;
  locationId: string | null;
  role: MembershipRole;
  orgName: string;
  orgStatus: OrgStatus;
  locationName: string | null;
  venueType: LocationMode | null;
};

export type WorkspaceLocation = {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  venueType: LocationMode;
  role: MembershipRole;
};
