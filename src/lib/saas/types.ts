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
  timezone?: string;
  hoursNote?: string;
  tipPooling?: boolean;
  tabAutoCloseMinutes?: number;
  ticketPrefix?: string;
  kioskMode?: string;
  waitlistEnabled?: boolean;
  reservationCheckIn?: boolean;
  waitlistReason?: string;
  /** Host-managed operator payout destinations. Guest operators cannot edit. */
  operatorPayouts?: { id: string; bankLast4: string; bankLabel: string }[];
  /** Host-controlled subject × target grants. Empty = product defaults. */
  entityPermissions?: import("@/lib/access/entity-grants").EntityGrantRow[];
  /** Location device registry with entity + function assignment. */
  locationDevices?: import("@/lib/pos/location-devices").LocationDevice[];
  voiceControlEnabledByRole?: Partial<Record<string, boolean>>;
  networkReadyStatus?: import("./network-readiness").NetworkReadyStatus;
  networkCheckedAt?: string;
  networkNotes?: string;
  networkChecklist?: import("./network-readiness").NetworkChecklist;
};

export const EMPTY_LOCATION_SETUP: LocationSetup = {
  tableCount: 0,
  sectionNames: [],
  floorLater: true,
  menuMode: "empty",
  devices: { pos: 0, kds: 0, handhelds: 0 },
  settlement: { periodType: "weekly", hostCutPercent: 0 },
  hostBrandName: "",
  timezone: "America/Los_Angeles",
  hoursNote: "",
  tipPooling: false,
  tabAutoCloseMinutes: 0,
  ticketPrefix: "",
  kioskMode: "combined",
  waitlistEnabled: false,
  reservationCheckIn: true,
  waitlistReason: "",
  operatorPayouts: [],
  entityPermissions: [],
  locationDevices: [],
};
export type MembershipRole =
  | "owner"
  | "manager"
  | "cashier"
  | "staff"
  | "vendor"
  | "server"
  | "host"
  | "bartender"
  | "kitchen"
  | "accountant"
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
  "server",
  "host",
  "bartender",
  "kitchen",
  "accountant",
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
  /** Guest entity this membership is scoped to (host when null). */
  operatorId?: string | null;
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
  operatorId?: string | null;
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
    operatorId?: string | null;
  }>;
  active: ActiveContextRecord | null;
};
