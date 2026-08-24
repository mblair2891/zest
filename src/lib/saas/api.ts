import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import type { LocationMode } from "@/lib/pos/saas-types";
import type { MembershipRole, PlanSlug } from "./types";

export const getSessionContextFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSessionContext } = await import("./tenancy.server");
    return getSessionContext(context.userId);
  });

export const createOrganizationFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string; venueType: string }) => ({
    name: String(d.name ?? "").trim(),
    venueType: String(d.venueType ?? "restaurant"),
  }))
  .handler(async ({ context, data }) => {
    if (data.name.length < 2) throw new Error("Organization name is required");
    const { createOrganizationForUser, parseVenueType } = await import(
      "./tenancy.server"
    );
    return createOrganizationForUser(context.userId, {
      name: data.name,
      venueType: parseVenueType(data.venueType),
    });
  });

export const listMyOrganizationsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listMyOrganizations } = await import("./tenancy.server");
    return listMyOrganizations(context.userId);
  });

export const createLocationFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; name: string; venueType: string; timezone?: string }) => ({
    orgId: String(d.orgId ?? ""),
    name: String(d.name ?? "").trim(),
    venueType: String(d.venueType ?? "restaurant"),
    timezone: d.timezone,
  }))
  .handler(async ({ context, data }) => {
    if (!data.orgId || data.name.length < 2) throw new Error("Location name is required");
    const { createLocationForOrg, parseVenueType } = await import("./tenancy.server");
    return createLocationForOrg(context.userId, {
      orgId: data.orgId,
      name: data.name,
      venueType: parseVenueType(data.venueType) as LocationMode,
      timezone: data.timezone,
    });
  });

export const listLocationsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string }) => ({ orgId: String(d.orgId ?? "") }))
  .handler(async ({ context, data }) => {
    const { listLocationsForOrg } = await import("./tenancy.server");
    return listLocationsForOrg(context.userId, data.orgId);
  });

export const inviteMemberFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; email: string; role: string; operatorId?: string | null }) => ({
    orgId: String(d.orgId ?? ""),
    email: String(d.email ?? "").trim(),
    role: String(d.role ?? "staff"),
    operatorId: d.operatorId ? String(d.operatorId).trim().slice(0, 80) : null,
  }))
  .handler(async ({ context, data }) => {
    const { rateLimit } = await import("./rate-limit.server");
    if (rateLimit(`invite:${context.userId}`, 10, 60_000)) {
      throw new Error("Too many invites — try again in a minute");
    }
    const { inviteMemberToOrg, parseRole } = await import("./tenancy.server");
    return inviteMemberToOrg(context.userId, {
      orgId: data.orgId,
      email: data.email,
      role: parseRole(data.role) as MembershipRole,
      operatorId: data.operatorId,
    });
  });

export const peekInviteFn = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ data }) => {
    const { peekInvite } = await import("./tenancy.server");
    return peekInvite(data.token);
  });

export const acceptInviteFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ context, data }) => {
    const { acceptInviteForUser } = await import("./tenancy.server");
    return acceptInviteForUser(context.userId, data.token);
  });

export const listMembersFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string }) => ({ orgId: String(d.orgId ?? "") }))
  .handler(async ({ context, data }) => {
    const { listMembersForOrg } = await import("./tenancy.server");
    return listMembersForOrg(context.userId, data.orgId);
  });

export const entitlementsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string }) => ({ orgId: String(d.orgId ?? "") }))
  .handler(async ({ context, data }) => {
    const { entitlementsForOrg } = await import("./tenancy.server");
    return entitlementsForOrg(context.userId, data.orgId);
  });

export const canAccessFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; featureKey: string }) => ({
    orgId: String(d.orgId ?? ""),
    featureKey: String(d.featureKey ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { canAccessFeature } = await import("./tenancy.server");
    return canAccessFeature(context.userId, data.orgId, data.featureKey);
  });

export const assertLocationAccessFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { locationId: string }) => ({
    locationId: String(d.locationId ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { assertLocationAccess } = await import("./tenancy.server");
    return assertLocationAccess(context.userId, data.locationId);
  });

export const listTenantsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listTenants } = await import("./tenancy.server");
    return listTenants(context.userId);
  });

export const setTenantPlanFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; planId: string }) => ({
    orgId: String(d.orgId ?? ""),
    planId: String(d.planId ?? "starter") as PlanSlug,
  }))
  .handler(async ({ context, data }) => {
    const { setTenantPlan } = await import("./tenancy.server");
    await setTenantPlan(context.userId, data.orgId, data.planId);
    return { ok: true };
  });

export const setOrgStatusFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; status: "active" | "suspended" }) => ({
    orgId: String(d.orgId ?? ""),
    status: d.status === "suspended" ? ("suspended" as const) : ("active" as const),
  }))
  .handler(async ({ context, data }) => {
    const { setOrgStatus } = await import("./tenancy.server");
    return setOrgStatus(context.userId, data.orgId, data.status);
  });

export const startCheckoutFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; planId: string }) => ({
    orgId: String(d.orgId ?? ""),
    planId: String(d.planId ?? "starter") as PlanSlug,
  }))
  .handler(async ({ context, data }) => {
    const { startCheckout } = await import("./billing.server");
    return startCheckout(context.userId, data.orgId, data.planId);
  });

export const startPortalFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string }) => ({ orgId: String(d.orgId ?? "") }))
  .handler(async ({ context, data }) => {
    const { startPortal } = await import("./billing.server");
    return startPortal(context.userId, data.orgId);
  });

export const recordCardPaymentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    orgId: string;
    locationId?: string;
    amountCents: number;
    last4?: string;
  }) => ({
    orgId: String(d.orgId ?? ""),
    locationId: d.locationId ? String(d.locationId) : undefined,
    amountCents: Number(d.amountCents) || 0,
    last4: d.last4 ? String(d.last4) : undefined,
  }))
  .handler(async ({ context, data }) => {
    if (data.amountCents <= 0) throw new Error("Invalid amount");
    const { recordCapturedCard } = await import("@/lib/payments/summex-payments");
    return recordCapturedCard({
      userId: context.userId,
      orgId: data.orgId,
      locationId: data.locationId,
      amountCents: data.amountCents,
      last4: data.last4,
    });
  });

export const billingStatusFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { getBillingProvider } = await import("./billing.server");
    const p = getBillingProvider();
    return { provider: p.kind };
  });

export const setActiveContextFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orgId: string; locationId?: string | null }) => ({
    orgId: String(d.orgId ?? ""),
    locationId: d.locationId ? String(d.locationId) : null,
  }))
  .handler(async ({ context, data }) => {
    const { setActiveContext } = await import("./tenancy.server");
    return setActiveContext(context.userId, data.orgId, data.locationId);
  });

export const getActiveTenantFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { resolveActiveTenant } = await import("./tenancy.server");
    return resolveActiveTenant(context.userId);
  });

export const startProspectFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    const { rateLimit } = await import("./rate-limit.server");
    if (rateLimit(`prospect:${context.userId ?? "anon"}`, 12, 60_000)) {
      throw new Error("Too many intake sessions — try again in a minute");
    }
    const { createProspect } = await import("./prospects.server");
    return createProspect({
      userId: context.userId,
      email: context.email,
    });
  });

export const getProspectFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { token?: string; prospectId?: string }) => ({
    token: d.token ? String(d.token) : undefined,
    prospectId: d.prospectId ? String(d.prospectId) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { getProspectDetail } = await import("./prospects.server");
    return getProspectDetail({
      userId: context.userId,
      token: data.token,
      prospectId: data.prospectId,
    });
  });

export const interviewTurnFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: {
    token: string;
    freeText: string;
    replies?: Array<{ id: string; answer: string }>;
  }) => ({
    token: String(d.token ?? ""),
    freeText: String(d.freeText ?? ""),
    replies: Array.isArray(d.replies)
      ? d.replies.map((r) => ({
          id: String(r?.id ?? ""),
          answer: String(r?.answer ?? ""),
        }))
      : [],
  }))
  .handler(async ({ context, data }) => {
    const { rateLimit } = await import("./rate-limit.server");
    if (rateLimit(`interview:${context.userId ?? data.token.slice(0, 8)}`, 20, 60_000)) {
      throw new Error("Too many interview turns — wait a minute");
    }
    const { runInterviewTurn } = await import("./interview.server");
    return runInterviewTurn({
      userId: context.userId,
      token: data.token,
      freeText: data.freeText,
      replies: data.replies,
    });
  });

export const finishInterviewFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: {
    token: string;
    status: "accepted" | "skipped";
    recommendation?: unknown;
    email?: string;
  }) => ({
    token: String(d.token ?? ""),
    status: d.status === "skipped" ? ("skipped" as const) : ("accepted" as const),
    recommendation: d.recommendation,
    email: d.email ? String(d.email) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { finishInterview } = await import("./interview.server");
    return finishInterview({
      userId: context.userId,
      token: data.token,
      status: data.status,
      recommendation: data.recommendation,
      email: data.email,
    });
  });

export const interviewAiStatusFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { interviewUsesAi } = await import("./interview.server");
    return { ai: interviewUsesAi() };
  });

export const saveIntakeFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { token: string; answers: unknown }) => ({
    token: String(d.token ?? ""),
    answers: d.answers,
  }))
  .handler(async ({ context, data }) => {
    const { saveProspectAnswers } = await import("./prospects.server");
    return saveProspectAnswers({
      userId: context.userId,
      token: data.token,
      answers: data.answers,
    });
  });

export const issueQuoteFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ context, data }) => {
    const { issueQuote } = await import("./prospects.server");
    return issueQuote({ userId: context.userId, token: data.token });
  });

export const acceptQuoteFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ context, data }) => {
    const { acceptQuote } = await import("./prospects.server");
    return acceptQuote({ userId: context.userId, token: data.token });
  });

export const claimProspectFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ context, data }) => {
    const { claimProspect } = await import("./prospects.server");
    return claimProspect(context.userId, data.token);
  });

export const listMyProspectsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listMyProspects } = await import("./prospects.server");
    return listMyProspects(context.userId);
  });

export const listAllProspectsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listAllProspects } = await import("./prospects.server");
    return listAllProspects(context.userId);
  });

export const markContractSignedFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { prospectId: string }) => ({
    prospectId: String(d.prospectId ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { markContractSigned } = await import("./prospects.server");
    return markContractSigned({ userId: context.userId, prospectId: data.prospectId });
  });

export const adminSetProspectStatusFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { prospectId: string; status: string; note?: string }) => ({
    prospectId: String(d.prospectId ?? ""),
    status: String(d.status ?? ""),
    note: d.note ? String(d.note) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { adminSetProspectStatus } = await import("./prospects.server");
    return adminSetProspectStatus({
      userId: context.userId,
      prospectId: data.prospectId,
      status: data.status as import("./prospect-types").ProspectStatus,
      note: data.note,
    });
  });

export const adminPatchQuoteFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { prospectId: string; lineItems: unknown; reissue?: boolean }) => ({
    prospectId: String(d.prospectId ?? ""),
    lineItems: d.lineItems,
    reissue: Boolean(d.reissue),
  }))
  .handler(async ({ context, data }) => {
    const { adminPatchQuote } = await import("./prospects.server");
    const items = Array.isArray(data.lineItems)
      ? (data.lineItems as import("./prospect-types").QuoteLineItem[])
      : [];
    return adminPatchQuote({
      userId: context.userId,
      prospectId: data.prospectId,
      lineItems: items,
      reissue: data.reissue,
    });
  });

export const loadPricingRulesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { loadPricingRules } = await import("./prospects.server");
    return loadPricingRules();
  });

export const savePricingRulesFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { rules: unknown }) => ({ rules: d.rules }))
  .handler(async () => {
    throw new Error("Pricing is edited in Platform → Settings → Plans & billing. Free-form JSON is not accepted.");
  });

export const listProspectAuditFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { prospectId: string }) => ({
    prospectId: String(d.prospectId ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { listAuditForProspect } = await import("./prospects.server");
    return listAuditForProspect(context.userId, data.prospectId);
  });

export const saveOnboardingFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string; payload: unknown }) => ({
    token: String(d.token ?? ""),
    payload: d.payload,
  }))
  .handler(async ({ context, data }) => {
    const { saveOnboardingPayload } = await import("./onboarding.server");
    return saveOnboardingPayload({
      userId: context.userId,
      token: data.token,
      payload: data.payload,
    });
  });

export const applyOnboardingStepFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string; step: string; payload?: unknown }) => ({
    token: String(d.token ?? ""),
    step: String(d.step ?? ""),
    payload: d.payload,
  }))
  .handler(async ({ context, data }) => {
    const { applyOnboardingStep } = await import("./onboarding.server");
    return applyOnboardingStep({
      userId: context.userId,
      token: data.token,
      step: data.step as import("./prospect-types").OnboardingStepId,
      payload: data.payload,
    });
  });

export const getPosBootstrapFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { locationId: string }) => ({
    locationId: String(d.locationId ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { assertLocationAccess } = await import("./tenancy.server");
    const access = await assertLocationAccess(context.userId, data.locationId);
    const { operatorsAsVendors } = await import("./onboarding.server");
    const operators = await operatorsAsVendors(data.locationId);
    return { ...access, operators };
  });
