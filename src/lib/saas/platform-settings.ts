import { z } from "zod";
import type { PackageId } from "@/lib/pos/packages";
import {
  defaultQuotePackageCents,
  PACKAGE_BY_ID,
  QUOTE_SOFTWARE_PACKAGES,
} from "@/lib/pos/packages";

export { QUOTE_SOFTWARE_PACKAGES };

export const QUOTE_PACKAGE_LABEL: Record<string, string> = Object.fromEntries(
  QUOTE_SOFTWARE_PACKAGES.map((id) => [id, PACKAGE_BY_ID[id]?.name ?? id]),
);
import { PRODUCT_NAME } from "@/lib/platform/brand";
import type { PlanSlug } from "./types";

export const PLAN_SLUG_VALUES = [
  "starter",
  "full_service",
  "food_hall",
  "platform_internal",
] as const;

export const SETTINGS_SECTIONS = [
  "general",
  "security",
  "crm",
  "onboarding",
  "billing",
  "payments",
  "communications",
  "flags",
  "compliance",
  "team",
  "danger",
] as const;
export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];

export const SETTINGS_SECTION_LABEL: Record<SettingsSectionId, string> = {
  general: "General",
  security: "Security & auth",
  crm: "CRM & pipeline",
  onboarding: "Onboarding",
  billing: "Plans & billing",
  payments: "Payments & gift defaults",
  communications: "Communications",
  flags: "Feature flags",
  compliance: "Data & compliance",
  team: "Team",
  danger: "Danger zone",
};

export const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD", "MXN"] as const;

export const PIN_LENGTHS = [4, 5, 6] as const;

export const PLATFORM_TEAM_ROLES = ["admin", "sales", "success", "read_only"] as const;
export type PlatformTeamRole = (typeof PLATFORM_TEAM_ROLES)[number];

export const PLATFORM_TEAM_STATUS = ["active", "deactivated"] as const;
export type PlatformTeamStatus = (typeof PLATFORM_TEAM_STATUS)[number];

export const NETWORK_READY_MODES = ["warn_only", "off"] as const;
export type NetworkReadyMode = (typeof NETWORK_READY_MODES)[number];

export const PAYMENTS_MODES = ["sandbox", "live"] as const;
export type PaymentsMode = (typeof PAYMENTS_MODES)[number];

export const GIFT_ISSUER_MODES = ["sale_point", "house", "joint"] as const;
export type GiftIssuerMode = (typeof GIFT_ISSUER_MODES)[number];

export const GIFT_RESIDUAL_MODES = ["issuer_keeps", "split_equal", "custom"] as const;
export type GiftResidualMode = (typeof GIFT_RESIDUAL_MODES)[number];

export const SUSPEND_TARGETS = ["pos", "back_office"] as const;
export type SuspendTarget = (typeof SUSPEND_TARGETS)[number];

export const MODULE_FLAG_KEYS = [
  "floor",
  "multiOp",
  "crm",
  "waitlist",
  "reservations",
  "qrOrder",
  "voice",
  "aiInsights",
  "kiosk",
  "giftCards",
  "offline",
] as const;
export type ModuleFlagKey = (typeof MODULE_FLAG_KEYS)[number];

export const MODULE_FLAG_LABEL: Record<ModuleFlagKey, string> = {
  floor: "Floor / POS",
  multiOp: "Multi-op host",
  crm: "CRM",
  waitlist: "Waitlist",
  reservations: "Reservations",
  qrOrder: "QR order/pay",
  voice: "Voice control",
  aiInsights: "AI insights",
  kiosk: "Kiosk",
  giftCards: "Gift cards",
  offline: "Offline mode",
};

export const TENANT_EMAIL_TOKENS = [
  "{{tenantName}}",
  "{{hostBrand}}",
  "{{inviteUrl}}",
  "{{pocName}}",
  "{{ownerName}}",
  "{{expiryDays}}",
  "{{supportEmail}}",
  "{{platformName}}",
  "{{fromName}}",
] as const;

export const QUOTE_EMAIL_TOKENS = [
  "{{companyName}}",
  "{{planName}}",
  "{{monthly}}",
  "{{setup}}",
  "{{locationCount}}",
  "{{features}}",
  "{{expires}}",
  "{{processingNote}}",
  "{{quoteUrl}}",
  "{{supportEmail}}",
  "{{platformName}}",
  "{{fromName}}",
] as const;

export const INVITE_TOKENS = [
  "{{ownerName}}",
  "{{orgName}}",
  "{{inviteUrl}}",
  "{{supportEmail}}",
  "{{platformName}}",
] as const;

export const WAITLIST_TOKENS = [
  "{{guestName}}",
  "{{partySize}}",
  "{{quotedWait}}",
  "{{locationName}}",
] as const;

const str = (max: number, min = 0) => z.string().trim().min(min).max(max);
const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const generalSettingsSchema = z.object({
  displayName: str(80, 1).default(PRODUCT_NAME),
  supportEmail: z
    .union([z.literal(""), z.string().trim().email().max(160)])
    .default("support@summex.app"),
  supportPhone: str(40).default(""),
  timezone: z.enum(TIMEZONES).default("America/Los_Angeles"),
  currency: z.enum(CURRENCIES).default("USD"),
  marketingUrl: str(240).default(""),
});
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;

export const securitySettingsSchema = z.object({
  minPasswordLength: int(8, 64).default(8),
  sessionIdleTimeoutMinutes: int(5, 24 * 60).default(60),
  pinLength: z.union([z.literal(4), z.literal(5), z.literal(6)]).default(4),
  pinMaxFailedAttempts: int(1, 20).default(5),
  pinLockoutMinutes: int(1, 1440).default(15),
  requireAdminPasswordChangeOnFirstLogin: z.boolean().default(true),
  factoryResetEnabled: z.boolean().default(true),
});
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;

export const pipelineStageSchema = z.object({
  id: str(40, 1),
  label: str(80, 1),
});
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const crmSettingsSchema = z.object({
  leadSources: z.array(str(80, 1)).min(1).max(40).default([
    "inbound",
    "website",
    "referral",
    "outbound",
    "other",
  ]),
  pipelineStages: z.array(pipelineStageSchema).min(1).max(24).default([
    { id: "lead", label: "Lead" },
    { id: "qualified", label: "Qualified" },
    { id: "proposal", label: "Proposal" },
    { id: "contract", label: "Contract" },
    { id: "onboarding", label: "Onboarding" },
    { id: "live", label: "Live" },
    { id: "churned", label: "Churned" },
  ]),
  defaultDealOwnerUserId: z.string().max(80).nullable().default(null),
  requireNextActivityWhenQualified: z.boolean().default(false),
});
export type CrmSettings = z.infer<typeof crmSettingsSchema>;

export const checklistStepSchema = z.object({
  id: str(40, 1),
  label: str(120, 1),
  required: z.boolean().default(false),
});
export type ChecklistStep = z.infer<typeof checklistStepSchema>;

export const onboardingSettingsSchema = z.object({
  checklist: z.array(checklistStepSchema).min(1).max(40).default([
    { id: "legal", label: "Legal / tax packet", required: true },
    { id: "bank", label: "Bank / payout details", required: true },
    { id: "hardware", label: "Hardware ordered", required: false },
    { id: "network", label: "Network readiness", required: true },
    { id: "staff", label: "Staff invited", required: false },
    { id: "menu", label: "Menu ready", required: false },
    { id: "training", label: "Training acknowledged", required: true },
    { id: "payments", label: "Payments acknowledged", required: true },
  ]),
  networkReadinessMode: z.enum(NETWORK_READY_MODES).default("warn_only"),
  defaultPlanSlug: z.enum(PLAN_SLUG_VALUES).default("starter"),
  autoEmailOwnerInviteOnGoLive: z.boolean().default(true),
  tenantInviteExpiryDays: int(1, 90).default(14),
});
export type OnboardingSettings = z.infer<typeof onboardingSettingsSchema>;

export const moduleFlagsSchema = z.object({
  floor: z.boolean().default(true),
  multiOp: z.boolean().default(false),
  crm: z.boolean().default(true),
  waitlist: z.boolean().default(true),
  reservations: z.boolean().default(true),
  qrOrder: z.boolean().default(true),
  voice: z.boolean().default(false),
  aiInsights: z.boolean().default(false),
  kiosk: z.boolean().default(false),
  giftCards: z.boolean().default(true),
  offline: z.boolean().default(true),
});
export type ModuleFlags = z.infer<typeof moduleFlagsSchema>;

export const venuePlanMapSchema = z.object({
  restaurant: z.enum(PLAN_SLUG_VALUES).default("full_service"),
  food_hall: z.enum(PLAN_SLUG_VALUES).default("food_hall"),
  truck_pod: z.enum(PLAN_SLUG_VALUES).default("food_hall"),
  ghost_kitchen: z.enum(PLAN_SLUG_VALUES).default("starter"),
  catering: z.enum(PLAN_SLUG_VALUES).default("starter"),
  bar_lounge: z.enum(PLAN_SLUG_VALUES).default("full_service"),
  cafe: z.enum(PLAN_SLUG_VALUES).default("starter"),
  qsr: z.enum(PLAN_SLUG_VALUES).default("starter"),
});

export const billingSettingsSchema = z.object({
  trialDays: int(0, 365).default(14),
  failedPaymentGraceDays: int(0, 90).default(7),
  suspendOnLapsedPayment: z.boolean().default(false),
  suspendAffects: z.array(z.enum(SUSPEND_TARGETS)).min(1).default(["pos", "back_office"]),
  perLocationFeeCents: int(0, 10_000_000).default(4900),
  perOperatorFeeCents: int(0, 10_000_000).default(2900),
  seatPackSize: int(1, 100).default(8),
  seatPackFeeCents: int(0, 10_000_000).default(4000),
  devicePackSize: int(1, 100).default(4),
  devicePackFeeCents: int(0, 10_000_000).default(2500),
  annualDiscountPercent: int(0, 90).default(10),
  setupFeeMode: z.enum(["waive", "flat", "by_package"]).default("by_package"),
  setupFeeFlatCents: int(0, 10_000_000).default(0),
  quoteExpireDays: int(1, 180).default(30),
  terminalMonthlyCents: int(0, 10_000_000).default(0),
  terminalSetupCents: int(0, 10_000_000).default(0),
  packageMonthlyCents: z
    .record(z.string(), int(0, 10_000_000))
    .default(defaultQuotePackageCents()),
  gmvScaleCents: z
    .object({
      under_50k: int(0, 10_000_000).default(0),
      "50_150k": int(0, 10_000_000).default(4900),
      "150_400k": int(0, 10_000_000).default(9900),
      "400k_plus": int(0, 10_000_000).default(19900),
    })
    .default({
      under_50k: 0,
      "50_150k": 4900,
      "150_400k": 9900,
      "400k_plus": 19900,
    }),
  basePlanByLocationType: venuePlanMapSchema.default({
    restaurant: "full_service",
    food_hall: "food_hall",
    truck_pod: "food_hall",
    ghost_kitchen: "starter",
    catering: "starter",
    bar_lounge: "full_service",
    cafe: "starter",
    qsr: "starter",
  }),
  rulesVersion: int(1, 1_000_000).default(1),
});
export type BillingSettings = z.infer<typeof billingSettingsSchema>;

export const planRowSchema = z.object({
  id: str(40, 1),
  slug: z.enum(PLAN_SLUG_VALUES),
  name: str(80, 1),
  active: z.boolean(),
  monthlyCents: int(0, 10_000_000),
  onboardingFeeCents: int(0, 10_000_000),
  maxLocations: int(1, 9999),
  maxSeats: int(1, 99999),
  modules: moduleFlagsSchema,
});
export type PlanEditorRow = z.infer<typeof planRowSchema>;

export const savePlansPayloadSchema = z.object({
  plans: z.array(planRowSchema).min(1).max(12),
  billing: billingSettingsSchema,
});
export type SavePlansPayload = z.infer<typeof savePlansPayloadSchema>;

export const paymentsSettingsSchema = z.object({
  quantumPaymentsMode: z.enum(PAYMENTS_MODES).default("sandbox"),
  chargebackFeeCents: int(0, 1_000_000).default(3500),
  giftIssuerMode: z.enum(GIFT_ISSUER_MODES).default("sale_point"),
  giftTermMonths: int(0, 120).default(0),
  operatorResidualMode: z.enum(GIFT_RESIDUAL_MODES).default("split_equal"),
  operatorResidualCustomPercent: int(0, 100).default(50),
  houseIssuedResidualEnabled: z.boolean().default(true),
  giftDisclaimer: str(2000).default("Gift expiry subject to local law"),
});
export type PaymentsSettings = z.infer<typeof paymentsSettingsSchema>;

export const communicationsSettingsSchema = z.object({
  fromName: str(80, 1).default(PRODUCT_NAME),
  waitlistConfirmTemplate: str(2000).default(
    "Hi {{guestName}}, you're on the waitlist at {{locationName}} for {{partySize}}. We'll text when your table is ready.",
  ),
  waitlistTableReadyTemplate: str(2000).default(
    "Hi {{guestName}}, your table at {{locationName}} is ready. Please check in with the host.",
  ),
  inviteEmailSubject: str(200).default("You're invited to {{platformName}} — {{orgName}}"),
  inviteEmailBody: str(4000).default(
    "Hi {{ownerName}},\n\n{{platformName}} is ready for {{orgName}}. Open {{inviteUrl}} to set your password and go live.\n\nQuestions: {{supportEmail}}",
  ),
  quoteRequestSubject: str(200).default("We received your {{platformName}} pricing request"),
  quoteRequestBody: str(4000).default(
    "Hi {{companyName}},\n\nThanks for requesting pricing from {{platformName}}. We'll send a proposal to this inbox shortly.\n\nQuestions: {{supportEmail}}\n\n— {{fromName}}",
  ),
  quoteSentSubject: str(200).default("Your {{platformName}} proposal for {{companyName}}"),
  quoteSentBody: str(4000).default(
    "Hi {{companyName}},\n\nHere is your {{platformName}} proposal.\n\nPackage: {{planName}}\nLocations: {{locationCount}}\nMonthly software: {{monthly}}\nSetup: {{setup}}\nExpires: {{expires}}\n\nIncluded from intake:\n{{features}}\n\n{{processingNote}}\n\nReview, accept, or request changes: {{quoteUrl}}\n\nQuestions: {{supportEmail}}\n\n— {{fromName}}",
  ),
  quoteAcceptedSubject: str(200).default("You accepted the {{platformName}} proposal"),
  quoteAcceptedBody: str(4000).default(
    "Hi {{companyName}},\n\nYou accepted the {{planName}} proposal ({{monthly}} / mo, setup {{setup}}). Next we prepare the contract and onboarding.\n\n{{quoteUrl}}\n\nQuestions: {{supportEmail}}\n\n— {{fromName}}",
  ),
  quoteInternalSubject: str(200).default("New quote request: {{companyName}}"),
  quoteInternalBody: str(4000).default(
    "A pricing request landed for {{companyName}}.\n\nOpen Pipeline to build and send the quote:\n{{quoteUrl}}\n",
  ),
  hostReadySubject: str(200).default("Your {{platformName}} host account is ready — invite your operators"),
  hostReadyBody: str(4000).default(
    "Hi {{ownerName}},\n\n{{hostBrand}} is live on {{platformName}}. Invite each operator (tenant) from Operators / Tenants in Host settings. They complete their own details via email or SMS link.\n\nQuestions: {{supportEmail}}\n\n— {{fromName}}",
  ),
  tenantInviteSubject: str(200).default("You're invited to complete onboarding for {{tenantName}} at {{hostBrand}}"),
  tenantInviteBody: str(4000).default(
    "Hi {{pocName}},\n\n{{hostBrand}} invited you to finish onboarding for {{tenantName}} on {{platformName}}.\n\nOpen this link (expires in {{expiryDays}} days):\n{{inviteUrl}}\n\nQuestions: {{supportEmail}}\n\n— {{fromName}}",
  ),
  tenantCompleteSubject: str(200).default("{{tenantName}} completed onboarding at {{hostBrand}}"),
  tenantCompleteBody: str(4000).default(
    "{{tenantName}} finished self-serve onboarding at {{hostBrand}}. Review routing and payouts in Host settings.\n",
  ),
});
export type CommunicationsSettings = z.infer<typeof communicationsSettingsSchema>;

export const featureFlagSettingsSchema = moduleFlagsSchema;
export type FeatureFlagSettings = ModuleFlags;

export const complianceSettingsSchema = z.object({
  waitlistPhoneRetentionDays: int(0, 3650).default(90),
  auditLogRetentionDays: int(30, 3650).default(365),
  privacyProcessNotes: str(8000).default(""),
});
export type ComplianceSettings = z.infer<typeof complianceSettingsSchema>;

export type PlatformTeamMember = {
  userId: string;
  name: string;
  email: string;
  role: PlatformTeamRole;
  status: PlatformTeamStatus;
  isSelf: boolean;
};

export type SettingsMeta = {
  appUrl: string;
  marketingUrlFromEnv: string;
  stripeConnected: boolean;
  smsConfigured: boolean;
  emailConfigured: boolean;
  factoryResetEnvEnabled: boolean;
  factoryResetEnvReason: string | null;
  currentUserId: string;
};

export type EmailOutboxRow = {
  id: string;
  to: string;
  subject: string;
  kind: string;
  status: string;
  provider: string | null;
  prospectId: string | null;
  createdAt: string;
};

export type SettingsBundle = {
  general: GeneralSettings;
  security: SecuritySettings;
  crm: CrmSettings;
  onboarding: OnboardingSettings;
  billing: BillingSettings;
  payments: PaymentsSettings;
  communications: CommunicationsSettings;
  flags: FeatureFlagSettings;
  compliance: ComplianceSettings;
  plans: PlanEditorRow[];
  team: PlatformTeamMember[];
  meta: SettingsMeta;
  emailOutbox: EmailOutboxRow[];
};

export const DEFAULT_GENERAL = generalSettingsSchema.parse({});
export const DEFAULT_SECURITY = securitySettingsSchema.parse({});
export const DEFAULT_CRM = crmSettingsSchema.parse({});
export const DEFAULT_ONBOARDING = onboardingSettingsSchema.parse({});
export const DEFAULT_BILLING = billingSettingsSchema.parse({});
export const DEFAULT_PAYMENTS = paymentsSettingsSchema.parse({});
export const DEFAULT_COMMUNICATIONS = communicationsSettingsSchema.parse({});
export const DEFAULT_FLAGS = featureFlagSettingsSchema.parse({
  floor: true,
  multiOp: false,
  crm: true,
  waitlist: true,
  reservations: true,
  qrOrder: true,
  voice: false,
  aiInsights: false,
  kiosk: true,
  giftCards: true,
  offline: true,
});
export const DEFAULT_COMPLIANCE = complianceSettingsSchema.parse({});

export const SECTION_SCHEMAS = {
  general: generalSettingsSchema,
  security: securitySettingsSchema,
  crm: crmSettingsSchema,
  onboarding: onboardingSettingsSchema,
  payments: paymentsSettingsSchema,
  communications: communicationsSettingsSchema,
  flags: featureFlagSettingsSchema,
  compliance: complianceSettingsSchema,
} as const;

export type SaveableSection = keyof typeof SECTION_SCHEMAS;

const CORE_PACKAGES: PackageId[] = [
  "pos_core",
  "kds",
  "reports_cash",
  "menu_admin",
  "saas_console",
];

export function packagesFromModules(
  modules: ModuleFlags,
  existing: string[] = [],
): PackageId[] {
  const s = new Set<PackageId>(CORE_PACKAGES);
  const keep = new Set<PackageId>([
    "hall_settlement",
    "vendor_portal",
    "truck_pod",
    "integrations",
    "labor",
    "inventory",
    "marketing_suite",
    "location_website",
    "advanced_ops",
  ]);
  for (const p of existing) {
    if ((keep as Set<string>).has(p)) s.add(p as PackageId);
  }
  if (modules.crm || modules.giftCards) s.add("guests_crm");
  if (modules.waitlist || modules.reservations || modules.multiOp) s.add("host_stand");
  if (modules.qrOrder || modules.kiosk) s.add("online_kiosk");
  if (modules.aiInsights) {
    s.add("drink_ai");
    s.add("ai_inventory");
  }
  if (modules.voice) s.add("advanced_ops");
  if (modules.multiOp) {
    s.add("hall_settlement");
    s.add("vendor_portal");
  }
  return [...s];
}

export function modulesFromFeatures(features: unknown): ModuleFlags {
  const list = Array.isArray(features) ? features.map(String) : [];
  const has = (id: string) => list.includes(id);
  return featureFlagSettingsSchema.parse({
    floor: true,
    multiOp: has("hall_settlement") || has("vendor_portal"),
    crm: has("guests_crm"),
    waitlist: has("host_stand"),
    reservations: has("host_stand"),
    qrOrder: has("online_kiosk"),
    voice: has("advanced_ops"),
    aiInsights: has("drink_ai") || has("ai_inventory"),
    kiosk: has("online_kiosk"),
    giftCards: has("guests_crm"),
    offline: true,
  });
}

export function operatorResidualBps(settings: PaymentsSettings): number {
  if (settings.operatorResidualMode === "issuer_keeps") return 0;
  if (settings.operatorResidualMode === "split_equal") return 5000;
  return Math.min(10_000, Math.max(0, settings.operatorResidualCustomPercent * 100));
}

export function formatMoneyCents(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export function parseMoneyToCents(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function newLocalId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function planSlugOf(id: string): PlanSlug {
  return (PLAN_SLUG_VALUES as readonly string[]).includes(id) ? (id as PlanSlug) : "starter";
}
