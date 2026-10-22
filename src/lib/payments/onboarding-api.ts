import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import type { PaymentAccountView } from "./onboarding.server";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

function opId(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Operator is required");
  return s;
}

export const getPaymentsOnboardingFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; operatorId?: string }) => ({
    locationId: d.locationId ? loc(d.locationId) : undefined,
    operatorId: d.operatorId ? opId(d.operatorId) : undefined,
  }))
  .handler(async ({ context, data }): Promise<PaymentAccountView> => {
    const { getPaymentAccount } = await import("./onboarding.server");
    return getPaymentAccount(context.userId, data);
  });

export const startPaymentsOnboardingFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; operatorId?: string; returnUrl?: string }) => ({
    locationId: d.locationId ? loc(d.locationId) : undefined,
    operatorId: d.operatorId ? opId(d.operatorId) : undefined,
    returnUrl: d.returnUrl ? String(d.returnUrl).slice(0, 240) : undefined,
  }))
  .handler(async ({ context, data }): Promise<PaymentAccountView> => {
    const { startPaymentsOnboarding } = await import("./onboarding.server");
    return startPaymentsOnboarding(context.userId, data);
  });

export const submitSandboxPaymentsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId?: string;
    operatorId?: string;
    legalName: string;
    ownerName?: string;
    bankLast4: string;
    routingLast4?: string;
  }) => ({
    locationId: d.locationId ? loc(d.locationId) : undefined,
    operatorId: d.operatorId ? opId(d.operatorId) : undefined,
    legalName: String(d.legalName ?? "").trim().slice(0, 120),
    ownerName: d.ownerName ? String(d.ownerName).trim().slice(0, 80) : undefined,
    bankLast4: String(d.bankLast4 ?? "").replace(/\D/g, "").slice(-4),
    routingLast4: d.routingLast4
      ? String(d.routingLast4).replace(/\D/g, "").slice(-4)
      : undefined,
  }))
  .handler(async ({ context, data }): Promise<PaymentAccountView> => {
    if (data.legalName.length < 2) throw new Error("Legal name is required");
    if (data.bankLast4.length !== 4) throw new Error("Bank last 4 is required");
    const { submitSandboxApplication } = await import("./onboarding.server");
    return submitSandboxApplication(context.userId, data);
  });

export const saveEntityFinixMerchantIdFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { operatorId?: string; locationId?: string; merchantId?: string; mid?: string }) => {
    const operatorId = d.operatorId ? opId(d.operatorId) : undefined;
    const locationId = d.locationId ? loc(d.locationId) : undefined;
    if (!operatorId && !locationId) throw new Error("Location or operator is required");
    const merchantId = String(d.merchantId ?? "").trim().slice(0, 80);
    const mid = String(d.mid ?? "").trim().slice(0, 40);
    return {
      operatorId,
      locationId,
      merchantId: merchantId || null,
      mid: mid || null,
    };
  })
  .handler(async ({ context, data }): Promise<PaymentAccountView> => {
    const { saveEntityFinixMerchantId } = await import("./onboarding.server");
    return saveEntityFinixMerchantId(context.userId, data);
  });

export const refreshPaymentsOnboardingFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; operatorId?: string }) => ({
    locationId: d.locationId ? loc(d.locationId) : undefined,
    operatorId: d.operatorId ? opId(d.operatorId) : undefined,
  }))
  .handler(async ({ context, data }): Promise<PaymentAccountView> => {
    const { refreshPaymentAccount } = await import("./onboarding.server");
    return refreshPaymentAccount(context.userId, data);
  });

export const listLocationPaymentAccountsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string }) => ({ locationId: loc(d.locationId) }))
  .handler(async ({ context, data }): Promise<PaymentAccountView[]> => {
    const { listPaymentAccountsForLocation } = await import("./onboarding.server");
    return listPaymentAccountsForLocation(context.userId, data.locationId);
  });

export const queueOperatorPayoutsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    shares: { operatorId: string; amountCents: number }[];
  }) => ({
    locationId: loc(d.locationId),
    shares: Array.isArray(d.shares)
      ? d.shares.slice(0, 40).map((s) => ({
          operatorId: String(s.operatorId ?? "").slice(0, 80),
          amountCents: Math.max(0, Math.round(Number(s.amountCents) || 0)),
        }))
      : [],
  }))
  .handler(async ({ context, data }) => {
    const { queueOperatorPayouts } = await import("./onboarding.server");
    return queueOperatorPayouts(context.userId, data.locationId, data.shares);
  });

export const getFinixWebhookDeskFn = createServerFn({ method: "GET" })
  .middleware([tenantMiddleware])
  .handler(async ({ context }) => {
    const { ForbiddenError, isPlatformAdmin } = await import("@/lib/saas/tenancy.server");
    if (!(await isPlatformAdmin(context.userId))) {
      throw new ForbiddenError("Platform admin only");
    }
    const { loadFinixWebhookDesk } = await import("./finix-webhook.server");
    return loadFinixWebhookDesk();
  });

export const getLocationFinixOnboardingFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string }) => ({ locationId: loc(d.locationId) }))
  .handler(async ({ context, data }) => {
    const { getLocationFinixOnboarding } = await import("./location-finix-form.server");
    return getLocationFinixOnboarding(context.userId, data.locationId);
  });

export const generateLocationFinixFormFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId?: string;
    returnUrl?: string;
    businessName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    line1?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  }) => ({
    locationId: loc(d.locationId),
    returnUrl: d.returnUrl ? String(d.returnUrl).slice(0, 240) : undefined,
    prefill: {
      businessName: String(d.businessName ?? "").trim().slice(0, 120),
      contactName: String(d.contactName ?? "").trim().slice(0, 80),
      email: String(d.email ?? "").trim().slice(0, 120),
      phone: String(d.phone ?? "").trim().slice(0, 20),
      line1: String(d.line1 ?? "").trim().slice(0, 160),
      city: String(d.city ?? "").trim().slice(0, 80),
      region: String(d.region ?? "").trim().slice(0, 2),
      postalCode: String(d.postalCode ?? "").trim().slice(0, 12),
    },
  }))
  .handler(async ({ context, data }) => {
    const { generateLocationOnboardingForm } = await import("./location-finix-form.server");
    return generateLocationOnboardingForm(context.userId, data);
  });

export const refreshLocationFinixFormFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string }) => ({ locationId: loc(d.locationId) }))
  .handler(async ({ context, data }) => {
    const { refreshLocationFinixOnboarding } = await import("./location-finix-form.server");
    return refreshLocationFinixOnboarding(context.userId, data.locationId);
  });

export const emailLocationFinixFormFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; to?: string }) => ({
    locationId: loc(d.locationId),
    to: d.to ? String(d.to).trim().slice(0, 120) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { emailLocationOnboardingLink } = await import("./location-finix-form.server");
    return emailLocationOnboardingLink(context.userId, data);
  });

export const markLocationReadyForLiveCardsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string }) => ({ locationId: loc(d.locationId) }))
  .handler(async ({ context, data }) => {
    const { markLocationReadyForLiveCards } = await import("./location-finix-form.server");
    return markLocationReadyForLiveCards(context.userId, data.locationId);
  });

export const getProcessorRailStatusFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .handler(async () => {
    const { finixConfigured } = await import("./finix");
    return {
      configured: finixConfigured("sandbox") || finixConfigured("live"),
      environment: finixConfigured("live") ? "live" : "sandbox",
    };
  });
