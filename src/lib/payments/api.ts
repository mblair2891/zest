import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import type { CardPresentResult, PaymentsStatus } from "./types";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

export const getPaymentsStatusFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string }) => ({
    locationId: loc(d.locationId),
  }))
  .handler(async ({ context, data }): Promise<PaymentsStatus> => {
    const { getPaymentsStatus } = await import("./facade.server");
    return getPaymentsStatus(context.userId, data.locationId);
  });

export const captureCardPresentFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    orgId: string;
    locationId: string;
    amountCents: number;
    checkId?: string;
    hostBrand?: string;
    readerId?: string;
    clientMutationId?: string;
    sandboxLast4?: string;
  }) => ({
    orgId: String(d.orgId ?? "").trim().slice(0, 80),
    locationId: loc(d.locationId),
    amountCents: Math.max(0, Math.round(Number(d.amountCents) || 0)),
    checkId: d.checkId ? String(d.checkId).slice(0, 80) : undefined,
    hostBrand: d.hostBrand ? String(d.hostBrand).slice(0, 80) : undefined,
    readerId: d.readerId ? String(d.readerId).slice(0, 80) : undefined,
    clientMutationId: d.clientMutationId ? String(d.clientMutationId).slice(0, 80) : undefined,
    sandboxLast4: d.sandboxLast4
      ? String(d.sandboxLast4).replace(/\D/g, "").slice(-4)
      : undefined,
  }))
  .handler(async ({ context, data }): Promise<CardPresentResult> => {
    const { captureCardPresent } = await import("./facade.server");
    return captureCardPresent(context.userId, data);
  });
