import type { LocationMode } from "@/lib/pos/saas-types";
import type { PackageId } from "@/lib/pos/packages";
import type { MembershipRole, PlanSlug } from "./types";

export const PROSPECT_STATUSES = [
  "prospect",
  "quoted",
  "accepted",
  "contracted",
  "onboarding",
  "live",
  "churned",
  "rejected",
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const GMV_BANDS = ["under_50k", "50_150k", "150_400k", "400k_plus"] as const;
export type GmvBand = (typeof GMV_BANDS)[number];

export const PAYOUT_FREQUENCIES = ["daily", "weekly", "biweekly"] as const;
export type PayoutFrequency = (typeof PAYOUT_FREQUENCIES)[number];

export const OPERATING_MODELS = ["single", "host_operators", "mixed"] as const;
export type OperatingModel = (typeof OPERATING_MODELS)[number];

export const LOCATION_OPERATING_MODELS = ["single", "host_operators"] as const;
export type LocationOperatingModel = (typeof LOCATION_OPERATING_MODELS)[number];

export const MENU_MODES = ["empty", "categories", "csv_later"] as const;
export type MenuMode = (typeof MENU_MODES)[number];

export const ONBOARDING_STEP_IDS = [
  "org",
  "locations",
  "operators",
  "floor",
  "menu",
  "devices",
  "hardware",
  "invites",
  "settlement",
  "payments",
  "network",
  "checklist",
] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export const ONBOARDING_STEP_LABEL: Record<OnboardingStepId, string> = {
  org: "Organization",
  locations: "Locations",
  operators: "Operators",
  floor: "Floor",
  menu: "Menu",
  devices: "Devices",
  hardware: "Partner hardware",
  invites: "Team",
  settlement: "Settlement",
  payments: "Payments",
  network: "Network",
  checklist: "Go-live",
};

export const STATION_TYPES = ["bar", "kitchen", "both"] as const;
export type StationType = (typeof STATION_TYPES)[number];

export type IntakeCompany = {
  legalName: string;
  dba: string;
  billingEmail: string;
  phone: string;
  hqAddress: string;
  taxId: string;
};

export type IntakePortfolio = {
  locationsNow: number;
  locations12mo: number;
  typeCounts: Partial<Record<LocationMode, number>>;
};

export type TerminalNeed = "none" | "lease" | "buy";

export type IntakeOperating = {
  model: OperatingModel;
  operatorsPerLocation: number;
  guestPaysHostCheck: boolean;
  barKitchenSplit: boolean;
  hostStand: boolean;
};

export type IntakeModules = {
  tableService: boolean;
  counterQsr: boolean;
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

export type IntakeVolume = {
  volumeKind: "checks" | "gmv";
  monthlyChecks: number;
  gmvBand: GmvBand;
  peakDevices: number;
  staffSeats: number;
  orderStations: number;
  odsStations: number;
  kioskCount: number;
  terminalNeed: TerminalNeed;
};

export type PartnerHardwareKind = "reader" | "kiosk" | "terminal" | "stand" | "other";

export type PartnerHardwareSku = {
  id: string;
  skuName: string;
  customerFacingName: string;
  kind: PartnerHardwareKind;
  monthlyCents: number;
  oneTimeCents: number;
  /** Internal only — never on Get a price or guest PDF. */
  costNoteInternal: string;
  shipToCustomer: boolean;
  active: boolean;
};

export type IntakeHardware = {
  /** Default true: tablets, printers, drawers, stands are the house's. */
  ownsTabletsPrintersDrawers: boolean;
  shipReaders: boolean;
  readerQty: number;
  /** Lease (monthly) vs purchase (one-time) for shipped readers. */
  readerPay: "purchase" | "lease";
  shipPartnerDevices: boolean;
  /** sku id → qty for non-reader partner catalog items */
  partnerSkuQty: Record<string, number>;
};

export type IntakePayments = {
  /** Required: guest cards are Quantum Payments only. */
  quantumPaymentsAck: boolean;
  /** @deprecated stored as quantumPaymentsAck; accepted on read */
  zestPaymentsAck?: boolean;
  tips: boolean;
  splitTenders: boolean;
  roomCharge: boolean;
  payoutFrequency: PayoutFrequency;
};

export type IntakeTimeline = {
  goLiveDate: string;
  notes: string;
};

export type IntakeAnswers = {
  company: IntakeCompany;
  portfolio: IntakePortfolio;
  operating: IntakeOperating;
  modules: IntakeModules;
  volume: IntakeVolume;
  hardware: IntakeHardware;
  payments: IntakePayments;
  timeline: IntakeTimeline;
};

export type InterviewStatus = "none" | "in_progress" | "accepted" | "skipped";
export type InterviewSource = "ai" | "heuristic";

export type InterviewMessage = {
  role: "user" | "assistant";
  text: string;
  at: string;
};

export type InterviewQuestion = {
  id: string;
  prompt: string;
  hint?: string;
};

export type InterviewRecommendation = {
  summary: string;
  operatingModel: "host_multi_operator" | "single_operator";
  venueTypes: LocationMode[];
  modules: Array<keyof IntakeModules>;
  estimates: {
    locations: number;
    operators: number;
    seats: number;
    devices: number;
  };
  rationale: string[];
  pricingHints: {
    suggestedPlan: PlanSlug;
    notes: string;
  };
};

export type InterviewTurnResult =
  | {
      type: "questions";
      questions: InterviewQuestion[];
      source: InterviewSource;
    }
  | {
      type: "recommendation";
      recommendation: InterviewRecommendation;
      source: InterviewSource;
    };

export type QuoteLineKind =
  | "plan"
  | "package"
  | "location"
  | "operator"
  | "seat_pack"
  | "device_pack"
  | "gmv_scale"
  | "onboarding"
  | "hardware"
  | "custom";

export type QuoteLineItem = {
  id: string;
  kind: QuoteLineKind;
  label: string;
  qty: number;
  unitCents: number;
  totalCents: number;
  packageId?: PackageId;
  note?: string;
  oneTime?: boolean;
  bucket?: "software" | "hardware" | "setup";
};

export type QuoteAddOn = {
  id: string;
  name: string;
  amountCents: number;
  oneTime: boolean;
};

export type SetupFeeMode = "waive" | "flat" | "by_package";

export type QuoteStationCounts = {
  order: number;
  ods: number;
  host: number;
};

export type QuoteChangeRequest = {
  at: string;
  message: string;
};

export type QuoteSnapshot = {
  version: 1;
  rulesVersion: number;
  generatedAt: string;
  planSlug: PlanSlug;
  planName?: string;
  maxLocations: number;
  maxSeats: number;
  locationCount?: number;
  entityCount?: number;
  stationCounts?: QuoteStationCounts;
  setupFeeCents?: number;
  setupFeeMode?: SetupFeeMode;
  addOns?: QuoteAddOn[];
  trialDays?: number;
  draft?: boolean;
  sentAt?: string | null;
  expiresAt?: string | null;
  featureList?: string[];
  processingNote?: string;
  terminalQty?: number;
  changeRequest?: QuoteChangeRequest | null;
  lineItems: QuoteLineItem[];
  /** Recurring software only — never partner hardware. */
  monthlyCents: number;
  softwareMonthlyCents?: number;
  hardwareMonthlyCents?: number;
  hardwareOneTimeCents?: number;
  byoChecklist?: string[];
  annualCents: number;
  onboardingFeeCents: number;
  assumptions: string[];
  packages: PackageId[];
};

export type PricingRules = {
  planMonthlyCents: Partial<Record<PlanSlug, number>>;
  perLocationFeeCents: number;
  perOperatorFeeCents: number;
  seatPackSize: number;
  seatPackFeeCents: number;
  devicePackSize: number;
  devicePackFeeCents: number;
  annualDiscountPercent: number;
  onboardingFeeCents: Partial<Record<PlanSlug, number>>;
  gmvScaleCents: Partial<Record<GmvBand, number>>;
  basePlanByLocationType: Partial<Record<LocationMode, PlanSlug>>;
  setupFeeMode: SetupFeeMode;
  setupFeeFlatCents: number;
  quoteExpireDays: number;
  terminalMonthlyCents: number;
  terminalSetupCents: number;
  /** Monthly cents per paid software package (Plans & billing forms). */
  packageMonthlyCents: Partial<Record<PackageId, number>>;
  quoteCatalog: QuoteCatalog;
};

export type QuoteCatalog = {
  baseCents: number;
  fullServiceCents: number;
  multiOpHostCents: number;
  tenantCents: number;
  opsPackCents: number;
  extraStationCents: number;
  includedStations: number;
  kioskCents: number;
  terminalLeaseCents: number;
  terminalBuyCents: number;
  setupCents: number;
  setupCapCents: number;
  byoDefault: boolean;
  partnerSkus: PartnerHardwareSku[];
};

export type OperatorDraft = {
  legalName: string;
  dba: string;
  contactEmail: string;
  contactPhone: string;
  stationTypes: StationType[];
  payoutBankLast4: string;
  payoutRoutingToken: string;
};

export type OnboardingLocationDraft = {
  clientId: string;
  serverId?: string;
  name: string;
  address: string;
  timezone: string;
  venueType: LocationMode;
  hostBrandName: string;
  operatingModel: LocationOperatingModel;
  operators: OperatorDraft[];
  tableCount: number;
  sectionNames: string;
  floorLater: boolean;
  menuMode: MenuMode;
  devices: { pos: number; kds: number; handhelds: number };
  networkReadyStatus?: import("./network-readiness").NetworkReadyStatus;
  networkCheckedAt?: string;
  networkNotes?: string;
  networkChecklist?: import("./network-readiness").NetworkChecklist;
};

export type OnboardingInviteDraft = {
  email: string;
  role: Exclude<MembershipRole, "platform_admin">;
};

export type OnboardingOrg = IntakeCompany & {
  ownerContactName: string;
  billingContactName: string;
  opsContactName: string;
  opsContactEmail: string;
  currency: string;
};

export type OnboardingPayload = {
  org: OnboardingOrg;
  locations: OnboardingLocationDraft[];
  invites: OnboardingInviteDraft[];
  settlement: {
    periodType: "daily" | "weekly" | "biweekly" | "monthly";
    hostCutPercent: number;
  };
  checklist: {
    trainingAck: boolean;
    hardwareAck: boolean;
    paymentsAck: boolean;
  };
  partnerHardware: {
    shipToName: string;
    shipToAddress: string;
    shipToPhone: string;
    items: Array<{
      skuId: string;
      name: string;
      qty: number;
      status: "requested" | "shipped" | "delivered";
    }>;
    note: string;
  };
};

export type OnboardingStepState = {
  done: boolean;
  completedAt?: string;
};

export type OperatorRecord = {
  id: string;
  orgId: string;
  locationId: string | null;
  legalName: string;
  dba: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  stationTypes: StationType[];
  payoutBankLast4: string | null;
  payoutRoutingToken: string | null;
};

export type ProspectRecord = {
  id: string;
  status: ProspectStatus;
  ownerUserId: string | null;
  email: string | null;
  answers: IntakeAnswers;
  quote: QuoteSnapshot | null;
  quoteIssuedAt: string | null;
  acceptedAt: string | null;
  contractedAt: string | null;
  contractSignedBy: string | null;
  orgId: string | null;
  publicToken: string;
  createdAt: string;
  updatedAt: string;
  interviewFreeText: string;
  interviewMessages: InterviewMessage[];
  interviewRecommendation: InterviewRecommendation | null;
  interviewSource: InterviewSource | null;
  interviewStatus: InterviewStatus;
};

export type OnboardingRunRecord = {
  id: string;
  prospectId: string;
  orgId: string | null;
  status: "in_progress" | "complete";
  steps: Partial<Record<OnboardingStepId, OnboardingStepState>>;
  payload: OnboardingPayload;
  createdAt: string;
  updatedAt: string;
};

export type ProspectDetail = ProspectRecord & {
  onboarding: OnboardingRunRecord | null;
  orgName: string | null;
  operators: OperatorRecord[];
  liveChecklist: {
    hasOrg: boolean;
    hasLocation: boolean;
    hasOwner: boolean;
    hasPlan: boolean;
    hasOperatorIfNeeded: boolean;
    ready: boolean;
  };
};

export type ProspectListItem = {
  id: string;
  status: ProspectStatus;
  email: string | null;
  legalName: string;
  dba: string;
  orgId: string | null;
  orgName: string | null;
  monthlyCents: number | null;
  publicToken: string;
  createdAt: string;
  updatedAt: string;
  locationCount: number;
  operatingModel: string;
  quoteSent: boolean;
};

export const MODULE_LABELS: { id: keyof IntakeModules; label: string; hint: string }[] = [
  { id: "tableService", label: "Table service", hint: "Floor plans, sections, host stand" },
  { id: "counterQsr", label: "Counter / QSR", hint: "Quick service order rail" },
  { id: "kiosk", label: "Kiosk", hint: "On-premise self-order" },
  { id: "online", label: "Online / order-ahead", hint: "Web ordering board" },
  { id: "kds", label: "Kitchen / bar display", hint: "Expo rails, bump, recall" },
  { id: "inventory", label: "Inventory / purchasing", hint: "On-hand, par, recipes" },
  { id: "labor", label: "Labor / scheduling / tips", hint: "Schedules, tip pooling, closeout" },
  { id: "giftCards", label: "Gift cards (first-party)", hint: "On our ledger — not an external vendor" },
  { id: "crm", label: "CRM / guests", hint: "Profiles, loyalty" },
  { id: "marketing", label: "Marketing", hint: "Campaigns, social, location sites" },
  { id: "vendorPortal", label: "Vendor portal", hint: "For host + operator locations" },
  { id: "multiLocationReporting", label: "Multi-location reporting", hint: "Roll-up across the portfolio" },
];
