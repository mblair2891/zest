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

export const listPaxReadersFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string }) => ({ locationId: loc(d.locationId) }))
  .handler(async ({ context, data }) => {
    const { listPaxReaders } = await import("./pax-d135.server");
    return { readers: await listPaxReaders(context.userId, data.locationId) };
  });

export const registerPaxReaderFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; name: string; serial: string; entityId: string; entityName?: string }) => ({
    locationId: loc(d.locationId),
    name: String(d.name ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
    serial: String(d.serial ?? "").replace(/\s+/g, "").slice(0, 40),
    entityId: String(d.entityId ?? "").trim().slice(0, 80),
    entityName: String(d.entityName ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { registerPaxReader } = await import("./pax-d135.server");
    return registerPaxReader(context.userId, data);
  });

export const renamePaxReaderFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; id: string; name: string }) => ({
    locationId: loc(d.locationId),
    id: String(d.id ?? "").trim().slice(0, 80),
    name: String(d.name ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
  }))
  .handler(async ({ context, data }) => {
    const { renamePaxReaderRecord } = await import("./pax-d135.server");
    return renamePaxReaderRecord(context.userId, data);
  });

export const paxReaderSessionFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; serial: string; entityId: string }) => ({
    locationId: loc(d.locationId),
    serial: String(d.serial ?? "").replace(/\s+/g, "").slice(0, 40),
    entityId: String(d.entityId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { paxReaderSession } = await import("./pax-d135.server");
    return paxReaderSession(context.userId, data);
  });

export const recordPaxSaleFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    orgId: string;
    checkId: string;
    transferId: string;
    last4?: string | null;
    amountCents: number;
    readerId: string;
    merchantId: string;
  }) => ({
    locationId: loc(d.locationId),
    orgId: String(d.orgId ?? "").trim().slice(0, 80),
    checkId: String(d.checkId ?? "").trim().slice(0, 80),
    transferId: String(d.transferId ?? "").trim().slice(0, 80),
    last4: d.last4 ? String(d.last4).replace(/\D/g, "").slice(-4) : null,
    amountCents: Math.max(0, Math.round(Number(d.amountCents) || 0)),
    readerId: String(d.readerId ?? "").trim().slice(0, 80),
    merchantId: String(d.merchantId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { recordPaxSale } = await import("./pax-d135.server");
    return recordPaxSale(context.userId, data);
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

export const createSquareDeviceCodeFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; deviceRowId: string }) => ({
    locationId: loc(d.locationId),
    deviceRowId: String(d.deviceRowId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { createSquareDeviceCode } = await import("./square-terminal.server");
    return createSquareDeviceCode({ userId: context.userId, ...data });
  });

export const refreshSquareDeviceCodeFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; deviceRowId: string }) => ({
    locationId: loc(d.locationId),
    deviceRowId: String(d.deviceRowId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { refreshSquareDeviceCode } = await import("./square-terminal.server");
    return refreshSquareDeviceCode({ userId: context.userId, ...data });
  });

export const squareTestPingFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; deviceRowId: string; managerConfirm?: boolean }) => ({
    locationId: loc(d.locationId),
    deviceRowId: String(d.deviceRowId ?? "").trim().slice(0, 80),
    managerConfirm: d.managerConfirm === true,
  }))
  .handler(async ({ context, data }) => {
    const { squareTestPing } = await import("./square-terminal.server");
    return squareTestPing({ userId: context.userId, ...data });
  });

export const startSquareCheckoutFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    amountCents: number;
    checkId?: string;
    referenceId?: string;
    note?: string;
    deviceId?: string;
    clientMutationId?: string;
  }) => ({
    locationId: loc(d.locationId),
    amountCents: Math.max(0, Math.round(Number(d.amountCents) || 0)),
    checkId: d.checkId ? String(d.checkId).slice(0, 80) : undefined,
    referenceId: d.referenceId ? String(d.referenceId).slice(0, 40) : undefined,
    note: d.note ? String(d.note).slice(0, 500) : undefined,
    deviceId: d.deviceId ? String(d.deviceId).slice(0, 80) : undefined,
    clientMutationId: d.clientMutationId ? String(d.clientMutationId).slice(0, 80) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { startSquareCheckout } = await import("./square-terminal.server");
    return startSquareCheckout({ userId: context.userId, ...data });
  });

export const squareCheckoutStatusFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; checkoutId: string }) => ({
    locationId: loc(d.locationId),
    checkoutId: String(d.checkoutId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { squareCheckoutStatus } = await import("./square-terminal.server");
    return squareCheckoutStatus({ userId: context.userId, ...data });
  });

export const cancelSquareCheckoutFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; checkoutId: string }) => ({
    locationId: loc(d.locationId),
    checkoutId: String(d.checkoutId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { cancelSquareCheckout } = await import("./square-terminal.server");
    return cancelSquareCheckout({ userId: context.userId, ...data });
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
    if (res.status === "sent") return { ok: true, status: "sent" };
    if (res.status === "logged_only") {
      return {
        ok: false,
        status: "logged_only",
        error: "Email is down. Print the receipt instead.",
      };
    }
    return { ok: false, status: "failed", error: "Email is down. Print the receipt instead." };
  });

export const sendGuestReceiptSmsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; to: string; text: string }) => ({
    locationId: loc(d.locationId),
    to: String(d.to ?? "").replace(/[^\d+]/g, "").slice(0, 20),
    text: String(d.text || "").slice(0, 1400),
  }))
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string }> => {
    if (data.locationId) {
      const { bindTenant } = await import("@/lib/saas/assert-tenant.server");
      await bindTenant(context.userId, { locationId: data.locationId });
    }
    if (data.to.replace(/\D/g, "").length < 10) {
      return { ok: false, error: "Enter a valid mobile number" };
    }
    const { sendSms } = await import("@/lib/front/messaging.server");
    const res = await sendSms({
      to: data.to,
      body: data.text,
      kind: "receipt_sms",
      locationId: data.locationId,
    });
    if (res.ok) return { ok: true };
    if ("blocked" in res && res.blocked) {
      return { ok: false, error: res.reason || "SMS is not available." };
    }
    return { ok: false, error: "SMS is down. Email or print the receipt instead." };
  });
