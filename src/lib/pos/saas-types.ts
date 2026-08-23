/** SaaS + truck pod domain for Zest platform */

export type LocationMode =
  | "restaurant"
  | "food_hall"
  | "truck_pod"
  | "ghost_kitchen"
  | "catering"
  | "bar_lounge"
  | "cafe"
  | "qsr";

/** How a location sells and settles — independent of venue type. */
export type OperatingModel = "single_operator" | "host_multi_operator";

/** Where an operator's tickets land. "both" follows each item/category station. */
export type OperatorStationType = "bar" | "kitchen" | "both";

export type LocationCreatedBy = "seed" | "ui";

export type OrgPlan = "starter" | "growth" | "enterprise";

export interface PlatformCompany {
  name: string;
  legalName: string;
  proprietors: { name: string; role: string }[];
  tagline: string;
  supportEmail: string;
  version: string;
}

export interface SaasOrganization {
  id: string;
  name: string;
  legalName: string;
  plan: OrgPlan;
  seats: number;
  locationsIncluded: number;
  merchantsIncluded: number;
  billingEmail: string;
  status: "trial" | "active" | "past_due" | "cancelled";
  trialEndsAt?: number;
  createdAt: number;
}

export interface SaasMembership {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "ops" | "accountant" | "support";
}

export interface SaasLocation {
  id: string;
  orgId: string;
  name: string;
  code: string;
  mode: LocationMode;
  address: string;
  timezone: string;
  open: boolean;
  /** Commercial packages enabled for this location */
  enabledPackages: string[];
  /** For pods: max simultaneous pads occupied */
  padCapacity?: number;
  powerAmpsTotal?: number;
  /**
   * Guest-facing brand printed on checks and card statements.
   * For host + multiple operators this is the HOST, never an operator name.
   */
  hostBrandName?: string;
  operatingModel?: OperatingModel;
  /** "ui" = created in the SaaS console. */
  createdBy?: LocationCreatedBy;
}

export interface LocationOperator {
  id: string;
  orgId: string;
  locationId: string;
  name: string;
  shortName: string;
  /** Placeholder payout destination (no live ACH). */
  payoutAccountLabel: string;
  payoutLast4: string;
  stationType: OperatorStationType;
  ownedCategoryIds: string[];
  ownedItemIds: string[];
  color: string;
  active: boolean;
}

export interface LocationMenuCategory {
  id: string;
  locationId: string;
  name: string;
  sort: number;
  color: string;
  station: "bar" | "kitchen";
}

export interface LocationMenuItem {
  id: string;
  locationId: string;
  categoryId: string;
  name: string;
  priceCents: number;
  description?: string;
  course: "drink" | "appetizer" | "entree" | "dessert" | "side" | "other";
  /** Defaults to the category station when omitted */
  station?: "bar" | "kitchen";
  available: boolean;
}

export interface TruckPad {
  id: string;
  locationId: string;
  label: string;
  /** grid position 0–100 */
  x: number;
  y: number;
  amps: 30 | 50 | 100;
  status: "vacant" | "occupied" | "reserved" | "maintenance";
  merchantId?: string;
  merchantName?: string;
  leaseStart?: number;
  leaseEnd?: number;
  monthlyRentCents: number;
  powerFeeCents: number;
  gmvPercent: number;
}

export interface PadAssignment {
  id: string;
  padId: string;
  merchantId: string;
  merchantName: string;
  /** day of week 0–6 or -1 for ongoing */
  dayOfWeek: number;
  startDate: string;
  endDate?: string;
  notes?: string;
}

export interface PodMerchant {
  id: string;
  orgId: string;
  name: string;
  cuisine: string;
  contactName: string;
  phone: string;
  bankLast4: string;
  w9OnFile: boolean;
  active: boolean;
  permitNumber?: string;
}

export interface LeaseInvoiceLine {
  kind: "pad_rent" | "power" | "gmv_percent" | "host_cut" | "card_fees" | "other";
  label: string;
  amountCents: number;
}

export interface LeaseInvoice {
  id: string;
  locationId: string;
  merchantId: string;
  merchantName: string;
  periodStart: number;
  periodEnd: number;
  lines: LeaseInvoiceLine[];
  totalCents: number;
  status: "draft" | "sent" | "paid";
}

export interface DeviceEnrollment {
  id: string;
  locationId: string;
  name: string;
  type: "pos" | "kds" | "kiosk" | "printer" | "terminal" | "handheld";
  status: "online" | "offline" | "pending";
  lastSeenAt: number;
  serial: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  done: boolean;
}
