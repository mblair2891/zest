import type { PlanSlug } from "./types";
import type { ProspectStatus } from "./prospect-types";

export const ACCOUNT_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "contract",
  "onboarding",
  "live",
  "churned",
] as const;
export type AccountStage = (typeof ACCOUNT_STAGES)[number];

export const DEAL_STAGES = ACCOUNT_STAGES;
export type DealStage = AccountStage;

export const ACCOUNT_SOURCES = [
  "inbound",
  "website",
  "referral",
  "outbound",
  "other",
] as const;
export type AccountSource = (typeof ACCOUNT_SOURCES)[number];

export const CONTACT_ROLES = [
  "owner",
  "gm",
  "chef",
  "billing",
  "other",
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const ACTIVITY_KINDS = [
  "note",
  "call",
  "email",
  "task",
  "status",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const INVOICE_STATUSES = ["draft", "open", "paid", "failed", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type CrmAccount = {
  id: string;
  name: string;
  legalName: string | null;
  stage: AccountStage;
  ownerUserId: string | null;
  ownerName: string | null;
  tags: string[];
  source: AccountSource;
  prospectId: string | null;
  orgId: string | null;
  orgName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  contactCount: number;
  openTickets: number;
  nextDueAt: string | null;
};

export type CrmContact = {
  id: string;
  accountId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: ContactRole;
  createdAt: string;
};

export type CrmOpportunity = {
  id: string;
  accountId: string;
  name: string;
  amountCents: number;
  planSlug: PlanSlug | null;
  stage: DealStage;
  closeDate: string | null;
  probability: number;
  prospectId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrmActivity = {
  id: string;
  accountId: string;
  contactId: string | null;
  kind: ActivityKind;
  body: string;
  dueAt: string | null;
  doneAt: string | null;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  accountId: string | null;
  accountName: string | null;
  orgId: string | null;
  orgName: string | null;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
};

export type TicketComment = {
  id: string;
  ticketId: string;
  body: string;
  authorUserId: string | null;
  authorName: string | null;
  createdAt: string;
};

export type SaasInvoice = {
  id: string;
  orgId: string;
  orgName: string;
  amountCents: number;
  status: InvoiceStatus;
  dueAt: string | null;
  paidAt: string | null;
  stripeInvoiceId: string | null;
  note: string | null;
  createdAt: string;
};

export type TenantDirectoryRow = {
  id: string;
  name: string;
  status: "active" | "suspended";
  planId: PlanSlug | null;
  planStatus: string | null;
  locationCount: number;
  operatorCount: number;
  memberCount: number;
  mrrCents: number;
  pastDue: boolean;
  openTickets: number;
  accountId: string | null;
  stage: AccountStage | null;
  createdAt: string;
};

export type TenantDrillIn = {
  org: TenantDirectoryRow;
  locations: { id: string; name: string; venueType: string; status: string; lifecycleStatus?: string }[];
  members: { id: string; name: string; email: string; role: string }[];
  operators: { id: string; dba: string; locationId: string | null; onboardStatus?: string }[];
};

export type OnboardingWorkspaceRow = {
  runId: string;
  prospectId: string;
  accountId: string | null;
  accountName: string;
  orgId: string | null;
  orgName: string | null;
  status: "in_progress" | "complete";
  prospectStatus: ProspectStatus;
  progressPct: number;
  blockers: string[];
  updatedAt: string;
  publicToken: string;
};

export type SaasReportSnapshot = {
  funnel: { stage: string; count: number }[];
  pipelineValueByStage: { stage: string; amountCents: number }[];
  newAccounts30d: number;
  liveLocations: number;
  liveOrgs: number;
  churnedAccounts: number;
  openTickets: number;
  pastDueOrgs: number;
  failedInvoices: number;
};

export const SUPPORT_MACROS: { id: string; title: string; body: string }[] = [
  {
    id: "welcome",
    title: "Welcome / go-live",
    body: "Welcome to Summex. Your location is live. Staff use a 4-digit floor PIN on POS; owners use email and password for the control plane. Guest cards run through Quantum Payments — separate from software billing.",
  },
  {
    id: "network",
    title: "Network readiness",
    body: "Network readiness is warn-only and does not block go-live. Confirm venue Wi‑Fi, a staff bookmark of the app host, and guest table QR on the sites host. Re-run the checklist from location Settings.",
  },
  {
    id: "billing",
    title: "Software billing vs cards",
    body: "Summex software fees (this invoice) are separate from Quantum Payments, which processes guest cards at the house. A failed software payment does not stop floor cash; card tenders still need a connection.",
  },
  {
    id: "pin",
    title: "Floor PIN vs back office",
    body: "Working staff sign in with a 4-digit PIN on shared devices. Owners, managers, and accountants use email and password. There is no universal demo PIN.",
  },
];

export const STAGE_LABEL: Record<AccountStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Quote",
  contract: "Contract",
  onboarding: "Onboarding",
  live: "Live",
  churned: "Churned",
};

export function prospectStatusToStage(status: ProspectStatus): AccountStage {
  switch (status) {
    case "quoted":
    case "accepted":
      return "proposal";
    case "contracted":
      return "contract";
    case "onboarding":
      return "onboarding";
    case "live":
      return "live";
    case "churned":
      return "churned";
    default:
      return "lead";
  }
}
