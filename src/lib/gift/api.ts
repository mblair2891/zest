import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import type { GiftCardStatus } from "@/lib/pos/types";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

export const listGiftCardsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string }) => ({ locationId: loc(d.locationId) }))
  .handler(async ({ context, data }) => {
    const { listGiftCards } = await import("./gift.server");
    return listGiftCards(context.userId, data.locationId);
  });

export const lookupGiftCardFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; code: string }) => ({
    locationId: loc(d.locationId),
    code: String(d.code ?? "").slice(0, 40),
  }))
  .handler(async ({ context, data }) => {
    const { lookupGiftCard } = await import("./gift.server");
    return lookupGiftCard(context.userId, data.locationId, data.code);
  });

export const issueGiftCardFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    amountCents: number;
    code?: string;
    issuerId: string;
    issuerKind: "house" | "operator";
    issuerName: string;
    issuedToName?: string;
    tender?: "cash" | "card";
    soldByEmployeeId?: string;
    soldByOperatorId?: string;
    expiresAt?: number | null;
  }) => ({
    locationId: loc(d.locationId),
    amountCents: Math.max(0, Math.round(Number(d.amountCents) || 0)),
    code: d.code ? String(d.code).slice(0, 40) : undefined,
    issuerId: String(d.issuerId ?? "").slice(0, 80),
    issuerKind: d.issuerKind === "operator" ? "operator" as const : "house" as const,
    issuerName: String(d.issuerName ?? "House").slice(0, 80),
    issuedToName: d.issuedToName ? String(d.issuedToName).slice(0, 80) : undefined,
    tender: d.tender === "cash" ? "cash" as const : "card" as const,
    soldByEmployeeId: d.soldByEmployeeId ? String(d.soldByEmployeeId).slice(0, 80) : undefined,
    soldByOperatorId: d.soldByOperatorId ? String(d.soldByOperatorId).slice(0, 80) : undefined,
    expiresAt: d.expiresAt == null ? null : Number(d.expiresAt) || null,
  }))
  .handler(async ({ context, data }) => {
    const { issueGiftCard } = await import("./gift.server");
    return issueGiftCard(context.userId, data);
  });

export const redeemGiftCardFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    code: string;
    amountCents: number;
    fulfillerId: string;
    fulfillerKind: "house" | "operator";
    checkId?: string;
  }) => ({
    locationId: loc(d.locationId),
    code: String(d.code ?? "").slice(0, 40),
    amountCents: Math.max(0, Math.round(Number(d.amountCents) || 0)),
    fulfillerId: String(d.fulfillerId ?? "").slice(0, 80),
    fulfillerKind: d.fulfillerKind === "operator" ? "operator" as const : "house" as const,
    checkId: d.checkId ? String(d.checkId).slice(0, 80) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { redeemGiftCard } = await import("./gift.server");
    return redeemGiftCard(context.userId, data);
  });

export const setGiftStatusFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; code?: string; cardId?: string; status: GiftCardStatus }) => ({
    locationId: loc(d.locationId),
    code: d.code ? String(d.code).slice(0, 40) : undefined,
    cardId: d.cardId ? String(d.cardId).slice(0, 80) : undefined,
    status: ((): GiftCardStatus => {
      const s = String(d.status ?? "");
      if (s === "frozen" || s === "void" || s === "active" || s === "zeroed") return s;
      return "active";
    })(),
  }))
  .handler(async ({ context, data }) => {
    const { setGiftStatus } = await import("./gift.server");
    return setGiftStatus(context.userId, data);
  });

export const reloadGiftCardFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; code?: string; cardId?: string; amountCents: number }) => ({
    locationId: loc(d.locationId),
    code: d.code ? String(d.code).slice(0, 40) : undefined,
    cardId: d.cardId ? String(d.cardId).slice(0, 80) : undefined,
    amountCents: Math.max(0, Math.round(Number(d.amountCents) || 0)),
  }))
  .handler(async ({ context, data }) => {
    const { reloadGiftCard } = await import("./gift.server");
    return reloadGiftCard(context.userId, data);
  });

export const importGiftCardsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    source: string;
    overwrite?: boolean;
    issuerId?: string;
    issuerKind?: "house" | "operator";
    issuerName?: string;
    rows: {
      code: string;
      balanceCents: number;
      originalBalanceCents?: number;
      status?: string;
      issuedToName?: string;
      issuedToEmail?: string;
      notes?: string;
    }[];
  }) => ({
    locationId: loc(d.locationId),
    source: String(d.source ?? "import_generic").slice(0, 40),
    overwrite: Boolean(d.overwrite),
    issuerId: d.issuerId ? String(d.issuerId).slice(0, 80) : undefined,
    issuerKind: d.issuerKind === "operator" ? "operator" as const : "house" as const,
    issuerName: d.issuerName ? String(d.issuerName).slice(0, 80) : undefined,
    rows: Array.isArray(d.rows) ? d.rows.slice(0, 2000) : [],
  }))
  .handler(async ({ context, data }) => {
    const { importGiftCards } = await import("./gift.server");
    return importGiftCards(context.userId, data);
  });

export const processGiftTermFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; splitBps?: number }) => ({
    locationId: loc(d.locationId),
    splitBps: Math.round(Number(d.splitBps) || 5000),
  }))
  .handler(async ({ context, data }) => {
    const { processGiftTerm } = await import("./gift.server");
    return processGiftTerm(context.userId, data.locationId, data.splitBps);
  });

export const giftLiabilityReportFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string }) => ({ locationId: loc(d.locationId) }))
  .handler(async ({ context, data }) => {
    const { giftLiabilityReport } = await import("./gift.server");
    return giftLiabilityReport(context.userId, data.locationId);
  });
