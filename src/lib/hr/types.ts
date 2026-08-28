import { HOST_SCOPE } from "@/lib/access/entity-grants";

export const HR_FEATURE_KEYS = [
  "applicants",
  "onboardingPackets",
  "esign",
  "scheduling",
  "timeOff",
  "timeClock",
  "payrollExport",
  "payrollSummary",
  "writeUps",
  "availability",
  "eligibility",
] as const;

export type HrFeatureKey = (typeof HR_FEATURE_KEYS)[number];

export const HR_FEATURE_LABEL: Record<HrFeatureKey, string> = {
  applicants: "Applicants / hiring",
  onboardingPackets: "Onboarding packets",
  esign: "E-sign",
  scheduling: "Scheduling",
  timeOff: "Time-off",
  timeClock: "Time clock",
  payrollExport: "Payroll CSV export",
  payrollSummary: "In-system payroll summary",
  writeUps: "Write-ups / incidents",
  availability: "Availability",
  eligibility: "Minor / alcohol eligibility",
};

export const HR_AUDIENCES = ["entity_owner", "entity_managers", "host", "none"] as const;
export type HrAudience = (typeof HR_AUDIENCES)[number];

export const HR_AUDIENCE_LABEL: Record<HrAudience, string> = {
  entity_owner: "Entity owner only",
  entity_managers: "Entity owner + managers",
  host: "Host (if tenant) + entity managers",
  none: "Entity owner only (hidden from others)",
};

export const HR_VISIBILITY_KEYS = ["hours", "wages", "documents", "writeUps"] as const;
export type HrVisibilityKey = (typeof HR_VISIBILITY_KEYS)[number];

export const HR_VISIBILITY_LABEL: Record<HrVisibilityKey, string> = {
  hours: "Hours",
  wages: "Wages / payroll amounts",
  documents: "Employment documents",
  writeUps: "Write-ups",
};

export type HrFeatures = Record<HrFeatureKey, boolean>;
export type HrVisibility = Record<HrVisibilityKey, HrAudience>;

export type EntityHrConfig = {
  enabled: boolean;
  features: HrFeatures;
  visibility: HrVisibility;
  /** US state code (CA) or "federal". Drives W-4 + state packet list. */
  employmentState: string;
};

export const DEFAULT_HR_FEATURES: HrFeatures = {
  applicants: false,
  onboardingPackets: false,
  esign: false,
  scheduling: true,
  timeOff: false,
  timeClock: true,
  payrollExport: false,
  payrollSummary: false,
  writeUps: false,
  availability: false,
  eligibility: false,
};

export const DEFAULT_HR_VISIBILITY: HrVisibility = {
  hours: "entity_managers",
  wages: "entity_owner",
  documents: "entity_owner",
  writeUps: "entity_managers",
};

export function parseEmploymentState(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s || s === "US" || s === "FEDERAL") return "federal";
  if (/^[A-Z]{2}$/.test(s)) return s;
  return "federal";
}

export function emptyHrConfig(): EntityHrConfig {
  return {
    enabled: false,
    features: { ...DEFAULT_HR_FEATURES },
    visibility: { ...DEFAULT_HR_VISIBILITY },
    employmentState: "federal",
  };
}

export const APPLICANT_STAGES = [
  "applied",
  "screen",
  "interview",
  "offer",
  "hired",
  "declined",
] as const;
export type ApplicantStage = (typeof APPLICANT_STAGES)[number];

export const PACKET_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "signed",
  "expired",
  "awaiting_upload",
] as const;
export type PacketStatus = (typeof PACKET_STATUSES)[number];

export const I9_STATUSES = [
  "not_started",
  "section1",
  "section2",
  "complete",
  "reverification",
] as const;
export type I9Status = (typeof I9_STATUSES)[number];

export type HrApplicant = {
  id: string;
  employerId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  stage: ApplicantStage;
  notes: string;
  createdAt: string;
};

export type HrI9File = {
  section: 1 | 2 | 3;
  fileName: string;
  fileKind: string;
  at: string;
};

export type HrOnboarding = {
  id: string;
  employerId: string;
  employeeId: string;
  employeeName: string;
  checklist: { id: string; label: string; done: boolean }[];
  i9Status: I9Status;
  i9Section1At: string | null;
  i9Section2At: string | null;
  i9Section3At: string | null;
  completedAt: string | null;
  i9Files: HrI9File[];
};

export type HrPacket = {
  id: string;
  employerId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  templateId: string;
  state: string;
  title: string;
  status: PacketStatus;
  provider: string | null;
  sentAt: string | null;
  signedAt: string | null;
  counterSignedAt: string | null;
  expiresAt: string | null;
  fileName: string | null;
  hasFile: boolean;
  esignConfigured: boolean;
};

export type HrTimeOff = {
  id: string;
  employerId: string;
  employeeId: string;
  employeeName: string;
  kind: string;
  startAt: string;
  endAt: string;
  status: "requested" | "approved" | "denied";
  notes: string;
};

export type HrWriteup = {
  id: string;
  employerId: string;
  employeeId: string;
  employeeName: string;
  title: string;
  body: string;
  severity: "coaching" | "written" | "final";
  createdAt: string;
  createdBy: string;
};

export type HrAvailability = {
  id: string;
  employeeId: string;
  weekday: number;
  startMin: number;
  endMin: number;
};

export type HrEligibility = {
  employeeId: string;
  minor: boolean;
  alcohol: boolean;
  notes: string;
};

export type HrPiiView = {
  employeeId: string;
  ssnLast4: string | null;
  ssnOnFile: boolean;
  taxOnFile: boolean;
  redacted: boolean;
};

export function parseHrAudience(raw: unknown): HrAudience {
  const s = String(raw ?? "");
  if (s === "entity_owner" || s === "entity_managers" || s === "host" || s === "none") return s;
  return "entity_managers";
}

export function parseHrConfig(raw: unknown): EntityHrConfig {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const feat =
    o.features && typeof o.features === "object" ? (o.features as Record<string, unknown>) : {};
  const vis =
    o.visibility && typeof o.visibility === "object"
      ? (o.visibility as Record<string, unknown>)
      : {};
  const features = { ...DEFAULT_HR_FEATURES };
  for (const k of HR_FEATURE_KEYS) {
    if (k in feat) features[k] = Boolean(feat[k]);
  }
  const visibility = { ...DEFAULT_HR_VISIBILITY };
  for (const k of HR_VISIBILITY_KEYS) {
    visibility[k] = parseHrAudience(vis[k]);
  }
  return {
    enabled: Boolean(o.enabled),
    features,
    visibility,
    employmentState: parseEmploymentState(o.employmentState ?? o.state),
  };
}

export function hrConfigForEntity(
  map: Record<string, unknown> | Record<string, EntityHrConfig> | undefined,
  employerId: string,
): EntityHrConfig {
  const id = employerId || HOST_SCOPE;
  const raw = map?.[id];
  return raw ? parseHrConfig(raw) : emptyHrConfig();
}

export function parseHrMap(raw: unknown): Record<string, EntityHrConfig> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, EntityHrConfig> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k) continue;
    out[k] = parseHrConfig(v);
  }
  return out;
}
