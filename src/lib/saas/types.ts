import type { LocationMode } from "@/lib/pos/saas-types";
import type { PackageId } from "@/lib/pos/packages";

export type OrgStatus = "active" | "suspended";
export type LocationOperatingModel = "single" | "host_operators";

export type LocationSetup = {
  tableCount: number;
  sectionNames: string[];
  floorLater: boolean;
  menuMode: string;
  devices: { pos: number; kds: number; handhelds: number };
  settlement: { periodType: string; hostCutPercent: number };
  hostBrandName: string;
};

export const EMPTY_LOCATION_SETUP: LocationSetup = {
  tableCount: 0,
  sectionNames: [],
  floorLater: true,
  menuMode: "empty",
  devices: { pos: 0, kds: 0, handhelds: 0 },
  settlement: { periodType: "weekly", hostCutPercent: 0 },
  hostBrandName: "",
};
export type MembershipRole =
  | "owner"
  | "manager"
  | "cashier"
  | "staff"
  | "vendor"
  | "platform_admin";
export type MembershipStatus = "active" | "invited" | "revoked";
export type PlanSlug =
  | "starter"
  | "full_service"
  | "food_hall"
  | "platform_internal";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export const MEMBERSHIP_ROLES: MembershipRole[] = [
  "owner",
  "manager",
  "cashier",
  "staff",
  "vendor",
  "platform_admin",
];

export const VENUE_TYPES: LocationMode[] = [
  "restaurant",
  "food_hall",
  "truck_pod",
  "ghost_kitchen",
  "catering",
  "bar_lounge",
  "cafe",
  "qsr",
];

export const PLAN_SLUGS: PlanSlug[] = [
  "starter",
  "full_service",
  "food_hall",
  "platform_internal",
];

export type OrgRecord = {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  venueDefaultType: LocationMode;
  createdAt: string;
  legalName?: string | null;
  dba?: string | null;
  billingEmail?: string | null;
  phone?: string | null;
  hqAddress?: string | null;
  taxId?: string | null;
};

export type MembershipRecord = {
  id: string;
  userId: string;
  orgId: string | null;
  locationId?: string | null;
  role: MembershipRole;
  status: MembershipStatus;
  email?: string | null;
  name?: string | null;
};

export type LocationRecord = {
  id: string;
  orgId: string;
  name: string;
  venueType: LocationMode;
  timezone: string;
  status: string;
  enabledPackages: PackageId[];
  createdAt: string;
  address?: string;
  hostBrandName?: string | null;
  operatingModel?: LocationOperatingModel;
  setup?: LocationSetup;
};

export type InviteRecord = {
  id: string;
  orgId: string;
  email: string;
  role: MembershipRole;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  inviteUrl?: string;
};

export type PlanRecord = {
  id: PlanSlug;
  slug: PlanSlug;
  name: string;
  features: string[];
  maxLocations: number;
  maxSeats: number;
};

export type SubscriptionRecord = {
  id: string;
  orgId: string;
  planId: PlanSlug;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
};

export type ActiveContextRecord = {
  orgId: string;
  locationId: string | null;
};

export type SessionContext = {
  user: { id: string; email: string | null; name: string | null };
  isPlatformAdmin: boolean;
  memberships: Array<MembershipRecord & { orgName?: string; orgStatus?: OrgStatus }>;
  orgs: Array<
    OrgRecord & {
      role: MembershipRole;
      planId: PlanSlug | null;
      planStatus: SubscriptionStatus | null;
      features: string[];
    }
  >;
  /** Locations this user may open, across every org they belong to. */
  locations: Array<{
    id: string;
    orgId: string;
    orgName: string;
    name: string;
    venueType: LocationMode;
    role: MembershipRole;
  }>;
  active: ActiveContextRecord | null;
};
