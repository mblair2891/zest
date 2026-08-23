import type { LocationMode, OperatingModel, OperatorStationType } from "@/lib/pos/saas-types";
import type { PackageId } from "@/lib/pos/packages";

export type ProspectStatus =
  | "prospect"
  | "quoted"
  | "accepted"
  | "contracted"
  | "onboarding"
  | "live"
  | "churned"
  | "rejected";

export const STATUS_ORDER: ProspectStatus[] = [
  "prospect",
  "quoted",
  "accepted",
  "contracted",
  "onboarding",
  "live",
];

export const LOCATION_TYPE_OPTIONS: { id: LocationMode; label: string }[] = [
  { id: "restaurant", label: "Full-service restaurant" },
  { id: "bar_lounge", label: "Bar / lounge" },
  { id: "food_hall", label: "Food hall / host + operators" },
  { id: "truck_pod", label: "Truck pod" },
  { id: "ghost_kitchen", label: "Ghost kitchen" },
  { id: "cafe", label: "Café" },
  { id: "qsr", label: "QSR" },
  { id: "catering", label: "Catering" },
];

export interface CompanyIntake {
  legalName: string;
  dba: string;
  billingEmail: string;
  phone: string;
  hqAddress: string;
  taxId: string;
}

export interface LocationTypeCount {
  mode: LocationMode;
  count: number;
}

export interface IntakeAnswers {
  company: CompanyIntake;
  locationsNow: number;
  locations12mo: number;
  locationTypes: LocationTypeCount[];
  operatingModel: OperatingModel;
  operatorsPerLocation: number;
  oneHostCheck: boolean;
  barKitchenSplit: boolean;
  channels: {
    floor: boolean;
    counter: boolean;
    kiosk: boolean;
    online: boolean;
    kds: boolean;
    inventory: boolean;
    labor: boolean;
    giftCards: boolean;
    crm: boolean;
    marketing: boolean;
    vendorPortal: boolean;
    multiLocationReporting: boolean;
  };
  monthlyChecks: number;
  gmvBand: "under_50k" | "50_150k" | "150_500k" | "500k_plus";
  peakDevices: number;
  staffSeats: number;
  zestPaymentsAck: boolean;
  tips: boolean;
  splitTenders: boolean;
  roomCharge: boolean;
  operatorPayoutFrequency: "daily" | "weekly" | "biweekly";
  goLiveDate: string;
  notes: string;
}

export type QuoteLineKind =
  | "location"
  | "module"
  | "operator"
  | "seats"
  | "devices"
  | "onboarding"
  | "custom";

export interface QuoteLine {
  id: string;
  kind: QuoteLineKind;
  label: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
  packageId?: PackageId;
  recurring: "monthly" | "one_time";
}

export interface QuoteSnapshot {
  issuedAt: number;
  currency: "USD";
  lines: QuoteLine[];
  monthlyCents: number;
  annualCents: number;
  oneTimeCents: number;
  assumptions: string;
  packageIds: PackageId[];
  rulesVersion: string;
}

export interface PricingRules {
  version: string;
  locationMonthlyCents: Record<LocationMode, number>;
  operatorMonthlyCents: number;
  includedSeats: number;
  seatPackSize: number;
  seatPackCents: number;
  includedDevices: number;
  devicePackSize: number;
  devicePackCents: number;
  onboardingFeeCents: number;
  annualDiscount: number;
}

export interface OnboardingLocationDraft {
  name: string;
  address: string;
  timezone: string;
  mode: LocationMode;
  hostBrandName: string;
  operatingModel: OperatingModel;
  operators: {
    name: string;
    legalName: string;
    contact: string;
    stationType: OperatorStationType;
    payoutAccountLabel: string;
    payoutLast4: string;
  }[];
  tableCount: number;
  sectionNames: string;
  menuStart: "empty" | "template_categories";
}

export interface OnboardingPayload {
  orgName: string;
  legalName: string;
  billingEmail: string;
  locations: OnboardingLocationDraft[];
  devices: { pos: number; kds: number; handhelds: number };
  invites: { email: string; name: string; role: "owner" | "manager" | "staff" | "vendor" }[];
  settlementPeriod: "daily" | "weekly" | "biweekly" | "monthly";
  hostCutPercent: number;
  acknowledgements: {
    training: boolean;
    hardware: boolean;
    zestPayments: boolean;
  };
}

export interface OnboardingSteps {
  org: boolean;
  locations: boolean;
  operators: boolean;
  floor: boolean;
  menu: boolean;
  devices: boolean;
  invites: boolean;
  settlement: boolean;
  checklist: boolean;
}

export interface AuditEvent {
  id: string;
  prospectId: string | null;
  actor: string;
  action: string;
  detail: string;
  createdAt: number;
}

export interface ProspectRecord {
  id: string;
  publicToken: string;
  status: ProspectStatus;
  billingEmail: string;
  company: CompanyIntake;
  answers: IntakeAnswers;
  quote: QuoteSnapshot | null;
  quoteIssuedAt: number | null;
  acceptedAt: number | null;
  contractedAt: number | null;
  contractSignedBy: string;
  orgId: string;
  createdAt: number;
  updatedAt: number;
  onboarding: {
    id: string;
    steps: OnboardingSteps;
    payload: OnboardingPayload;
  } | null;
}

export function emptyCompany(): CompanyIntake {
  return {
    legalName: "",
    dba: "",
    billingEmail: "",
    phone: "",
    hqAddress: "",
    taxId: "",
  };
}

export function emptyChannels(): IntakeAnswers["channels"] {
  return {
    floor: true,
    counter: false,
    kiosk: false,
    online: false,
    kds: true,
    inventory: false,
    labor: false,
    giftCards: false,
    crm: false,
    marketing: false,
    vendorPortal: false,
    multiLocationReporting: false,
  };
}

export function emptyAnswers(): IntakeAnswers {
  return {
    company: emptyCompany(),
    locationsNow: 1,
    locations12mo: 1,
    locationTypes: [{ mode: "restaurant", count: 1 }],
    operatingModel: "single_operator",
    operatorsPerLocation: 0,
    oneHostCheck: true,
    barKitchenSplit: false,
    channels: emptyChannels(),
    monthlyChecks: 2000,
    gmvBand: "50_150k",
    peakDevices: 4,
    staffSeats: 12,
    zestPaymentsAck: false,
    tips: true,
    splitTenders: false,
    roomCharge: false,
    operatorPayoutFrequency: "weekly",
    goLiveDate: "",
    notes: "",
  };
}

export function emptyOnboardingSteps(): OnboardingSteps {
  return {
    org: false,
    locations: false,
    operators: false,
    floor: false,
    menu: false,
    devices: false,
    invites: false,
    settlement: false,
    checklist: false,
  };
}

export function emptyOnboardingPayload(answers?: IntakeAnswers): OnboardingPayload {
  const co = answers?.company ?? emptyCompany();
  const types = answers?.locationTypes?.length
    ? answers.locationTypes
    : [{ mode: "restaurant" as const, count: 1 }];
  const locations: OnboardingLocationDraft[] = [];
  for (const t of types) {
    const n = Math.max(1, Math.min(8, t.count || 1));
    for (let i = 0; i < n; i++) {
      const host =
        answers?.operatingModel === "host_multi_operator" || t.mode === "food_hall";
      locations.push({
        name: co.dba
          ? `${co.dba}${n > 1 ? ` ${i + 1}` : ""}`
          : "",
        address: co.hqAddress,
        timezone: "America/Los_Angeles",
        mode: t.mode,
        hostBrandName: co.dba || co.legalName,
        operatingModel: host ? "host_multi_operator" : "single_operator",
        operators:
          host
            ? [
                {
                  name: "",
                  legalName: "",
                  contact: "",
                  stationType: "bar",
                  payoutAccountLabel: "",
                  payoutLast4: "",
                },
                {
                  name: "",
                  legalName: "",
                  contact: "",
                  stationType: "kitchen",
                  payoutAccountLabel: "",
                  payoutLast4: "",
                },
              ]
            : [],
        tableCount: 0,
        sectionNames: "",
        menuStart: "empty",
      });
    }
  }
  return {
    orgName: co.dba || co.legalName,
    legalName: co.legalName,
    billingEmail: co.billingEmail,
    locations,
    devices: { pos: 1, kds: 1, handhelds: 0 },
    invites: [
      {
        email: co.billingEmail,
        name: co.legalName || "Owner",
        role: "owner",
      },
    ],
    settlementPeriod: answers?.operatorPayoutFrequency === "daily" ? "daily" : "weekly",
    hostCutPercent: 5,
    acknowledgements: {
      training: false,
      hardware: false,
      zestPayments: false,
    },
  };
}

export function liveReady(payload: OnboardingPayload, steps: OnboardingSteps): boolean {
  const hasOrg = Boolean(payload.orgName.trim()) && steps.org;
  const hasLoc =
    payload.locations.some((l) => l.name.trim()) && steps.locations;
  const hasOwner = payload.invites.some(
    (i) => i.role === "owner" && i.email.trim(),
  );
  const multi = payload.locations.some(
    (l) => l.operatingModel === "host_multi_operator",
  );
  const opsOk =
    !multi ||
    payload.locations.every(
      (l) =>
        l.operatingModel !== "host_multi_operator" ||
        l.operators.filter((o) => o.name.trim()).length >= 1,
    );
  return Boolean(
    hasOrg &&
      hasLoc &&
      hasOwner &&
      opsOk &&
      steps.checklist &&
      payload.acknowledgements.zestPayments,
  );
}
