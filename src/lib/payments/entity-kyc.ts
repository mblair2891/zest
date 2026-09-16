/** Per-entity Payments / KYC draft. Form fields, not JSON. No SSN, PAN, or full account numbers. */

export const KYC_MCCS = ["5812", "5813", "5814"] as const;
export type KycMcc = (typeof KYC_MCCS)[number];

export const KYC_MCC_LABEL: Record<KycMcc, string> = {
  "5812": "5812 — restaurant / eating place",
  "5813": "5813 — drinking place",
  "5814": "5814 — fast food / QSR",
};

export const FINIX_KYC_STATUSES = [
  "draft",
  "submitted",
  "pending",
  "approved",
  "action_required",
] as const;
export type FinixKycStatus = (typeof FINIX_KYC_STATUSES)[number];

export const FINIX_KYC_LABEL: Record<FinixKycStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending: "Pending",
  approved: "Approved",
  action_required: "Action required",
};

export const MCC_5813_COPY =
  "On-premise retail only. Summex does not support online or shipped alcohol sales.";

export type EntityKyc = {
  legalName: string;
  dba: string;
  ein: string;
  owners: string;
  address: string;
  city: string;
  state: string;
  postal: string;
  mcc: KycMcc | "";
  bankName: string;
  bankLast4: string;
  routingLast4: string;
  status: FinixKycStatus;
};

export const EMPTY_ENTITY_KYC: EntityKyc = {
  legalName: "",
  dba: "",
  ein: "",
  owners: "",
  address: "",
  city: "",
  state: "",
  postal: "",
  mcc: "",
  bankName: "",
  bankLast4: "",
  routingLast4: "",
  status: "draft",
};

function asStr(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export function parseEntityKyc(raw: unknown): EntityKyc {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ENTITY_KYC };
  const o = raw as Record<string, unknown>;
  const mccRaw = String(o.mcc ?? "");
  const mcc = KYC_MCCS.includes(mccRaw as KycMcc) ? (mccRaw as KycMcc) : "";
  const stRaw = String(o.status ?? "draft");
  const status = FINIX_KYC_STATUSES.includes(stRaw as FinixKycStatus)
    ? (stRaw as FinixKycStatus)
    : "draft";
  return {
    legalName: asStr(o.legalName ?? o.legal_name, 120),
    dba: asStr(o.dba, 80),
    ein: asStr(o.ein, 20),
    owners: asStr(o.owners ?? o.ownerName, 160),
    address: asStr(o.address, 120),
    city: asStr(o.city, 60),
    state: asStr(o.state, 2).toUpperCase(),
    postal: asStr(o.postal ?? o.zip, 12),
    mcc,
    bankName: asStr(o.bankName ?? o.bank, 80),
    bankLast4: asStr(o.bankLast4, 4).replace(/\D/g, "").slice(-4),
    routingLast4: asStr(o.routingLast4, 4).replace(/\D/g, "").slice(-4),
    status,
  };
}

export function parseEntityKycMap(raw: unknown): Record<string, EntityKyc> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, EntityKyc> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = String(k).trim().slice(0, 80);
    if (!id) continue;
    out[id] = parseEntityKyc(v);
  }
  return out;
}

export function kycStatusFromOnboarding(raw: string | null | undefined): FinixKycStatus {
  const s = String(raw ?? "");
  if (s === "approved" || s === "live" || s === "sandbox") return "approved";
  if (s === "submitted") return "submitted";
  if (s === "needs_info" || s === "rejected") return "action_required";
  if (s === "in_progress") return "pending";
  return "draft";
}
