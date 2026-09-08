/**
 * Canonical SaaS pipeline. Stages do not skip.
 * Request → Sent → Accepted → Signed → Onboarding → Training → Live
 * Rejected / Churned are terminal exits only.
 */
import type { ProspectStatus } from "./prospect-types";
import type { QuoteSnapshot } from "./prospect-types";
import { quoteHasSoftwarePackage, quoteIsSetupOnly } from "./pricing";

export const PIPELINE_COLUMNS = [
  "prospect",
  "quoted",
  "accepted",
  "contracted",
  "onboarding",
  "training",
  "live",
] as const;

export const PIPELINE_EXITS = ["rejected", "churned"] as const;

export type PipelineColumn = (typeof PIPELINE_COLUMNS)[number];

export const FORWARD_ADJACENT: Record<ProspectStatus, ProspectStatus[]> = {
  prospect: ["quoted", "rejected", "churned"],
  quoted: ["accepted", "rejected", "churned"],
  accepted: ["contracted", "rejected", "churned"],
  contracted: ["onboarding", "rejected", "churned"],
  onboarding: ["training", "churned"],
  training: ["live", "churned"],
  live: ["churned"],
  rejected: ["prospect"],
  churned: ["prospect"],
};

export function isPipelineColumn(s: string): s is PipelineColumn {
  return (PIPELINE_COLUMNS as readonly string[]).includes(s);
}

export function quoteIsComplete(quote: QuoteSnapshot | null | undefined): boolean {
  if (!quote) return false;
  const locations = Number(quote.locationCount ?? quote.maxLocations ?? 0);
  if (!quote.planSlug || locations < 1) return false;
  if (quoteIsSetupOnly(quote)) return false;
  if (!quoteHasSoftwarePackage(quote) || quote.monthlyCents == null) return false;
  if (!quote.expiresAt) return false;
  if (!quote.featureList || quote.featureList.length < 1) return false;
  return true;
}

export function quoteIsSent(quote: QuoteSnapshot | null | undefined): boolean {
  if (!quoteIsComplete(quote)) return false;
  if (quote!.draft) return false;
  return Boolean(quote!.sentAt);
}

export type PipelineFacts = {
  status: ProspectStatus;
  quote: QuoteSnapshot | null;
  quoteIssuedAt?: string | null;
  acceptedAt?: string | null;
  contractedAt?: string | null;
  liveReady?: boolean;
};

export function canTransition(from: ProspectStatus, to: ProspectStatus): boolean {
  if (from === to) return true;
  return FORWARD_ADJACENT[from]?.includes(to) ?? false;
}

export function nextForwardStatus(status: ProspectStatus): ProspectStatus | null {
  const next = FORWARD_ADJACENT[status]?.find((s) => isPipelineColumn(s) && s !== status);
  return next ?? null;
}

/** Why this hop is blocked. Null = allowed. */
export function gateBlockReason(facts: PipelineFacts, to: ProspectStatus): string | null {
  const from = facts.status;
  if (from === to) return null;
  if (to === "rejected" || to === "churned") return null;
  if ((from === "rejected" || from === "churned") && to === "prospect") return null;
  if (!canTransition(from, to)) {
    return `Cannot skip: ${from} → ${to}. Path is Request → Sent → Accepted → Signed → Onboarding → Training → Live.`;
  }
  if (to === "quoted") {
    if (!quoteIsSent(facts.quote)) {
      return "Send a quote first (monthly software package from intake + location count, marked sent). Setup-only is not a quote.";
    }
  }
  if (to === "accepted") {
    if (!quoteIsSent(facts.quote)) return "A sent monthly package quote is required before Accepted.";
  }
  if (to === "contracted") {
    if (from !== "accepted") return "Accept the quote before recording the contract.";
  }
  if (to === "onboarding") {
    if (!quoteHasSoftwarePackage(facts.quote) || quoteIsSetupOnly(facts.quote)) {
      return "Onboarding needs an accepted quote with a monthly software package from intake — not setup-only.";
    }
    if (from !== "contracted" && !facts.contractedAt) {
      return "Record the contract before Start onboarding.";
    }
    if (!facts.acceptedAt && from !== "contracted") {
      return "The monthly package quote must be accepted before onboarding.";
    }
  }
  if (to === "training") {
    if (from !== "onboarding") return "The venue owner must finish onboarding before Training.";
    if (facts.liveReady === false) return "Owner onboarding (org, location) is not finished.";
  }
  if (to === "live") {
    if (from !== "training") return "Training sandbox until the subscriber schedules go-live.";
  }
  return null;
}

export type PipelineAction = {
  kind: "open" | "send_quote" | "accept" | "contract" | "resend_invite";
  label: string;
};

export function nextAllowedAction(facts: PipelineFacts): PipelineAction | null {
  switch (facts.status) {
    case "prospect":
      return { kind: "send_quote", label: quoteIsComplete(facts.quote) ? "Send quote" : "Create quote" };
    case "quoted":
      return { kind: "accept", label: "Record accept" };
    case "accepted":
      return { kind: "contract", label: "Record contract" };
    case "contracted":
    case "onboarding":
    case "training":
      return { kind: "resend_invite", label: "Resend invite" };
    default:
      return null;
  }
}

export function canResendOwnerInvite(facts: PipelineFacts): boolean {
  return facts.status === "contracted" || facts.status === "onboarding" || facts.status === "training";
}

/** @deprecated Platform does not start the subscriber wizard. */
export function canStartOnboarding(facts: PipelineFacts): boolean {
  return canResendOwnerInvite(facts);
}

export const OVERRIDE_PHRASE = "OVERRIDE";
