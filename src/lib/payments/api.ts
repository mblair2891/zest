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
    entities?: {
      entityId: string;
      kind: "host" | "operator";
      displayName: string;
      merchandiseCents: number;
      taxCents: number;
      serviceCents: number;
      tipCents: number;
      amountCents: number;
    }[];
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
    entities: Array.isArray(d.entities)
      ? d.entities.slice(0, 40).map((e) => ({
          entityId: String(e?.entityId ?? "host").slice(0, 80),
          kind: e?.kind === "operator" ? ("operator" as const) : ("host" as const),
          displayName: String(e?.displayName ?? "").slice(0, 80),
          merchandiseCents: Math.max(0, Math.round(Number(e?.merchandiseCents) || 0)),
          taxCents: Math.max(0, Math.round(Number(e?.taxCents) || 0)),
          serviceCents: Math.max(0, Math.round(Number(e?.serviceCents) || 0)),
          tipCents: Math.max(0, Math.round(Number(e?.tipCents) || 0)),
          amountCents: Math.max(0, Math.round(Number(e?.amountCents) || 0)),
        }))
      : undefined,
  }))
  .handler(async ({ context, data }): Promise<CardPresentResult> => {
    const { captureCardPresent } = await import("./facade.server");
    return captureCardPresent(context.userId, data);
  });

export const sendGuestReceiptFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    to: string;
    subject?: string;
    text: string;
    html?: string;
  }) => ({
    locationId: loc(d.locationId),
    to: String(d.to ?? "").trim().toLowerCase().slice(0, 160),
    subject: String(d.subject || "Your receipt").slice(0, 180),
    text: String(d.text || "").slice(0, 12_000),
    html: typeof d.html === "string" ? d.html.slice(0, 24_000) : "",
  }))
  .handler(async ({ context, data }): Promise<{ ok: boolean; status: string; error?: string }> => {
    if (data.locationId) {
      const { bindTenant } = await import("@/lib/saas/assert-tenant.server");
      await bindTenant(context.userId, { locationId: data.locationId });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.to)) {
      return { ok: false, status: "failed", error: "Enter a valid email" };
    }
    const { sendEmail } = await import("@/lib/saas/email.server");
    const res = await sendEmail({
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html || undefined,
      kind: "receipt_email",
    });
    if (res.status === "failed") return { ok: false, status: "failed", error: "Could not send receipt" };
    return { ok: true, status: res.status };
  });
