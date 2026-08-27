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

export const getProcessorRailStatusFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .handler(async () => {
    const { finixConfigured } = await import("./finix");
    const { readServerEnv } = await import("@/lib/database-url");
    return {
      configured: finixConfigured(),
      environment: readServerEnv("FINIX_ENVIRONMENT") === "live" ? "live" : "sandbox",
    };
  });
