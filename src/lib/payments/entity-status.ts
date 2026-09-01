/** Surface status for an entity payments account. Guest UI never names Finix. */

export const ENTITY_MERCHANT_STATUSES = [
  "not_started",
  "sandbox",
  "submitted",
  "approved",
  "live",
] as const;

export type EntityMerchantStatus = (typeof ENTITY_MERCHANT_STATUSES)[number];

export const ENTITY_MERCHANT_LABEL: Record<EntityMerchantStatus, string> = {
  not_started: "Not started",
  sandbox: "Sandbox",
  submitted: "Submitted",
  approved: "Approved",
  live: "Live",
};

export function isSandboxMerchantId(id: string | null | undefined): boolean {
  const s = String(id ?? "");
  return !s || s.includes("sandbox");
}

export function surfaceEntityStatus(opts: {
  onboardingStatus?: string | null;
  paymentsProvider?: string | null;
  merchantId?: string | null;
  locationLive: boolean;
  liveMode: boolean;
}): EntityMerchantStatus {
  const onboard = String(opts.onboardingStatus ?? "not_started");
  const sandboxRail =
    opts.paymentsProvider !== "finix" || isSandboxMerchantId(opts.merchantId);
  if (!onboard || onboard === "not_started" || onboard === "rejected") {
    return "not_started";
  }
  if (onboard === "submitted" || onboard === "needs_info" || onboard === "in_progress") {
    return sandboxRail && !opts.liveMode ? "sandbox" : "submitted";
  }
  if (onboard === "approved") {
    if (opts.locationLive && opts.liveMode && !sandboxRail) return "live";
    if (sandboxRail) return "sandbox";
    return "approved";
  }
  return sandboxRail ? "sandbox" : "submitted";
}

/** Training accepts (or provisions) sandbox ids. Live requires approved/live. */
export function entityCanCapture(
  status: EntityMerchantStatus,
  opts: { training: boolean },
): { ok: boolean; error?: string } {
  if (opts.training) return { ok: true };
  if (status === "approved" || status === "live") return { ok: true };
  return {
    ok: false,
    error:
      "This brand’s Quantum Payments account is not approved for live cards. Use cash or keep the check open.",
  };
}
