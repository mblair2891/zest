export const TENANT_KINDS = ["bar", "kitchen", "retail", "other"] as const;
export type TenantKind = (typeof TENANT_KINDS)[number];

export const TENANT_ONBOARD_STATUSES = [
  "draft",
  "invited",
  "in_progress",
  "finix_pending",
  "ready",
  "complete",
  "expired",
] as const;
export type TenantOnboardStatus = (typeof TENANT_ONBOARD_STATUSES)[number];

export const TENANT_KIND_LABEL: Record<TenantKind, string> = {
  bar: "Bar",
  kitchen: "Kitchen",
  retail: "Retail",
  other: "Other",
};

export type TenantOnboardPayload = {
  legalName: string;
  dba: string;
  pocName: string;
  pocEmail: string;
  pocPhone: string;
  stationKind: TenantKind;
  stations: string;
  menuNotes: string;
  staffNotes: string;
  payoutBankLast4: string;
  payoutLabel: string;
  schedulePrefs: string;
  ein: string;
  ownersNote: string;
  bankName: string;
  mcc: string;
  menuIntake: "type" | "voice" | "upload";
  tipMode: string;
  closeoutMode: string;
  tillMode: string;
  invoiceOptIn: boolean;
};

export const EMPTY_TENANT_PAYLOAD: TenantOnboardPayload = {
  legalName: "",
  dba: "",
  pocName: "",
  pocEmail: "",
  pocPhone: "",
  stationKind: "other",
  stations: "",
  menuNotes: "",
  staffNotes: "",
  payoutBankLast4: "",
  payoutLabel: "",
  schedulePrefs: "",
  ein: "",
  ownersNote: "",
  bankName: "",
  mcc: "5812",
  menuIntake: "type",
  tipMode: "",
  closeoutMode: "",
  tillMode: "",
  invoiceOptIn: false,
};

export type TenantInviteRow = {
  operatorId: string;
  orgId: string;
  locationId: string | null;
  displayName: string;
  stationKind: TenantKind;
  pocName: string;
  email: string;
  phone: string;
  status: TenantOnboardStatus;
  expiresAt: string | null;
  inviteId: string | null;
  paymentsStatus?: string;
};

export type TenantInvitePeek = {
  displayName: string;
  hostBrand: string;
  orgName: string;
  email: string;
  pocName: string;
  stationKind: TenantKind;
  expired: boolean;
  revoked: boolean;
  completed: boolean;
  locationId: string | null;
  operatorId: string;
  peerVenue?: boolean;
};

export function parseTenantKind(raw: unknown): TenantKind {
  const s = String(raw ?? "");
  return (TENANT_KINDS as readonly string[]).includes(s) ? (s as TenantKind) : "other";
}

export function parseTenantPayload(raw: unknown): TenantOnboardPayload {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const str = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  const menuIntake =
    o.menuIntake === "voice" || o.menuIntake === "upload" ? o.menuIntake : "type";
  const mccRaw = str("mcc").replace(/\D/g, "");
  return {
    legalName: str("legalName"),
    dba: str("dba"),
    pocName: str("pocName"),
    pocEmail: str("pocEmail").trim().toLowerCase(),
    pocPhone: str("pocPhone"),
    stationKind: parseTenantKind(o.stationKind),
    stations: str("stations"),
    menuNotes: str("menuNotes"),
    staffNotes: str("staffNotes"),
    payoutBankLast4: str("payoutBankLast4").replace(/\D/g, "").slice(-4),
    payoutLabel: str("payoutLabel"),
    schedulePrefs: str("schedulePrefs"),
    ein: str("ein").replace(/\D/g, "").slice(0, 9),
    ownersNote: str("ownersNote"),
    bankName: str("bankName"),
    mcc: mccRaw === "5813" || mccRaw === "7299" ? mccRaw : mccRaw === "5812" ? "5812" : str("mcc") || "5812",
    menuIntake,
    tipMode: str("tipMode"),
    closeoutMode: str("closeoutMode"),
    tillMode: str("tillMode"),
    invoiceOptIn: Boolean(o.invoiceOptIn),
  };
}
