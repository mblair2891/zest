/**
 * Canonical SaaS pipeline. Stages do not skip.
 * Request → Sent → Accepted → Contracted → Onboarding → Live
 * Rejected / Churned are terminal exits only.
 */
import type { ProspectStatus } from "./prospect-types";
import type { QuoteSnapshot } from "./prospect-types";

export const PIPELINE_COLUMNS = [
  "prospect",
  "quoted",
  "accepted",
  "contracted",
  "onboarding",
  "live",
] as const;

export const PIPELINE_EXITS = ["rejected", "churned"] as const;

export type PipelineColumn = (typeof PIPELINE_COLUMNS)[number];

export const FORWARD_ADJACENT: Record<ProspectStatus, ProspectStatus[]> = {
  prospect: ["quoted", "rejected", "churned"],
  quoted: ["accepted", "rejected", "churned"],
  accepted: ["contracted", "rejected", "churned"],
  contracted: ["onboarding", "rejected", "churned"],
  onboarding: ["live", "churned"],
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
  return Boolean(quote.planSlug) && locations >= 1 && quote.monthlyCents != null;
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
    return `Cannot skip: ${from} → ${to}. Path is Request → Sent → Accepted → Contracted → Onboarding → Live.`;
  }
  if (to === "quoted") {
    if (!quoteIsSent(facts.quote)) {
      return "Send a quote first (plan + price + location count, marked sent).";
    }
  }
  if (to === "accepted") {
    if (!quoteIsSent(facts.quote)) return "A sent quote is required before Accepted.";
  }
  if (to === "contracted") {
    if (from !== "accepted") return "Accept the quote before recording the contract.";
  }
  if (to === "onboarding") {
    if (from !== "contracted" && !facts.contractedAt) {
      return "Record the contract before Start onboarding.";
    }
  }
  if (to === "live") {
    if (from !== "onboarding") return "Host onboarding must complete before Live.";
    if (facts.liveReady === false) return "Finish host onboarding (org, location, owner) and go live.";
  }
  return null;
}

export type PipelineAction = {
  kind: "open" | "send_quote" | "accept" | "contract" | "start_onboarding" | "go_live";
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
      return { kind: "start_onboarding", label: "Start onboarding" };
    case "onboarding":
      return { kind: "go_live", label: "Go live" };
    default:
      return null;
  }
}

export function canStartOnboarding(facts: PipelineFacts): boolean {
  return facts.status === "contracted";
}

export const OVERRIDE_PHRASE = "OVERRIDE";
