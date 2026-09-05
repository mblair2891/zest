import type { LocationMode } from "@/lib/pos/saas-types";
import type { PackageId } from "@/lib/pos/packages";
import type { LocationOperatingModel as LocationOperatingModelT } from "./location-model";

export type OrgStatus = "active" | "suspended";
export type LocationOperatingModel = LocationOperatingModelT;
export {
  LOCATION_OPERATING_MODELS,
  LOCATION_MODEL_LABEL,
  parseLocationOperatingModel,
  isSharedFloorModel,
  isPeerVenueModel,
} from "./location-model";

export type LocationSetup = {
  tableCount: number;
  sectionNames: string[];
  floorLater: boolean;
  menuMode: string;
  devices: { pos: number; kds: number; handhelds: number };
  settlement: { periodType: string; hostCutPercent: number };
  hostBrandName: string;
  operatingModel?: import("./location-model").LocationOperatingModel;
  peerVenue?: boolean;
  cashDiscountEnabled?: boolean;
  cashDiscountPercent?: number;
  cashRoundIncrement?: number;
  cashRoundMode?: string;
  timezone?: string;
  hoursNote?: string;
  tipPooling?: boolean;
  tabAutoCloseMinutes?: number;
  ticketPrefix?: string;
  kioskMode?: string;
  waitlistEnabled?: boolean;
  /** Waitlist + tenant-invite SMS. Off = no guest/invite texts; email still sends. */
  smsEnabled?: boolean;
  /** Hard cap this location, at or below platform included. Null = platform included. */
  smsMonthlyCap?: number | null;
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
  lifecycleStatus?: "onboarding" | "training" | "scheduled_live" | "live";
  trainingTrackInventory?: boolean;
  aiReportSchedule?: "off" | "daily" | "weekly";
  aiReportEmail?: string;
  opsJobs?: import("@/lib/ops-jobs/types").OpsJobsConfig;
  operatorLifecycle?: Record<string, string>;
  goLiveAt?: string | null;
  goLiveChoices?: Record<string, "keep" | "erase">;
  qrMode?: string;
  qrPolicy?: import("@/lib/pos/qr-policy").QrPolicy;
  /** When true, Open POS does not hash in the training PIN roster. Add staff in the UI. */
  skipTrainingRoster?: boolean;
  /** inherit = platform default (sandbox unless Platform → Payments is live). */
  paymentsMode?: "inherit" | "sandbox" | "live";
  /** Processor reader id for live card-present (Quantum terminal serial). */
  quantumReaderId?: string;
  /** First-party gift policy (server ledger). */
  giftHouseIssuerEnabled?: boolean;
  giftHostessDefaultIssuerId?: string;
  giftTermAllowed?: boolean;
  giftTermDays?: number | null;
  giftOperatorBreakageSplitBps?: number;
  /** Saved floor map (x/y/size). Always kept on go-live. */
  floorPlan?: import("./location-catalog").LocationFloorPlan;
  /** Saved menu catalog. Always kept on go-live. */
  menuCatalog?: import("./location-catalog").LocationMenuCatalog;
  /** Saved recipes. Always kept on go-live. */
  recipes?: import("@/lib/costs/types").ItemRecipe[];
  /** Employer-of-record HR config keyed by entity id (`host` or operator id). */
  hrByEntity?: Record<string, import("@/lib/hr/types").EntityHrConfig>;
  /** Location default US state for employment packets when an entity has none. */
  employmentState?: string;
  /** Clock / approval / pay-period rules keyed by employer entity. */
  laborByEntity?: Record<string, import("@/lib/labor/rules").EntityLaborRules>;
  /** Drawers, wells, server banks — location-configurable cash handling. */
  cashHandling?: import("@/lib/pos/cash-handling").CashHandlingConfig;
  /** Cost catalog (SKUs, invoices, suppliers, POs) — no image blobs. */
  costPack?: {
    skus: import("@/lib/costs/types").CostSku[];
    suppliers: import("@/lib/costs/types").CostSupplier[];
    invoices: import("@/lib/costs/types").CostInvoice[];
    maps: import("@/lib/costs/types").VendorSkuMap[];
    exceptions: import("@/lib/costs/types").VarianceException[];
    settings: import("@/lib/costs/types").CostSettings;
    pos?: import("@/lib/costs/types").PurchaseOrder[];
  };
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
  smsEnabled: true,
  smsMonthlyCap: null,
  reservationCheckIn: true,
  waitlistReason: "",
  operatorPayouts: [],
  entityPermissions: [],
  locationDevices: [],
  paymentsMode: "inherit",
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
  lifecycleStatus?: string;
};

/** Public partner-demo location row for the temporary Login → picker path. */
export type OpenDemoLocation = {
  id: string;
  orgId: string;
  name: string;
  orgName: string;
  venueType: LocationMode;
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
