/** Client-safe delete class for CRM / pipeline records. */

export type CrmDeleteClass = "lead" | "training" | "live";

export function classifyCrmDelete(opts: {
  prospectStatus?: string | null;
  crmStage?: string | null;
  orgId?: string | null;
  locationCount?: number;
  locationLifecycles?: string[];
}): CrmDeleteClass {
  const status = String(opts.prospectStatus ?? "");
  const stage = String(opts.crmStage ?? "");
  const lives = opts.locationLifecycles ?? [];
  if (status === "live" || stage === "live" || lives.includes("live")) return "live";
  const hasVenue = Boolean(opts.orgId) && (opts.locationCount ?? 0) > 0;
  if (
    status === "onboarding" ||
    stage === "onboarding" ||
    hasVenue ||
    lives.some((s) => s === "training" || s === "onboarding" || s === "scheduled_live")
  ) {
    return "training";
  }
  return "lead";
}

export function deleteLeadPrompt(name: string): string {
  return `Delete lead ${name}?`;
}

export const DELETE_TRAINING_PROMPT =
  "This removes the shared venue, entities, menus, and devices.";
