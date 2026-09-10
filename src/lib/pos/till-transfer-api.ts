import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { isProspectDemo } from "@/lib/demo/session";
import { useSaasStore } from "@/lib/pos/saas-store";
import { usePosStore } from "@/lib/pos/store";
import type { TillTransfer, TillTransferAudit } from "./till-transfer";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

function ids(): { orgId: string; locationId: string } | null {
  if (typeof window === "undefined") return null;
  if (isProspectDemo()) return null;
  const orgId = useSaasStore.getState().org.id;
  const locationId = usePosStore.getState().tenantLocationId || "";
  if (!orgId || !locationId) return null;
  return { orgId, locationId };
}

export const persistTillTransferFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; orgId?: string; row: TillTransfer; events?: TillTransferAudit[] }) => ({
    locationId: loc(d.locationId),
    orgId: String(d.orgId ?? "").slice(0, 80),
    row: d.row,
    events: Array.isArray(d.events) ? d.events.slice(0, 8) : [],
  }))
  .handler(async (opts) => {
    const { context, data } = opts;
    const request = (opts as { request?: Request }).request;
    const ip =
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request?.headers.get("x-real-ip") ||
      undefined;
    const { upsertTillTransferServer } = await import("./till-transfer.server");
    const orgId = context.organizationId || data.orgId || "";
    await upsertTillTransferServer({
      orgId,
      locationId: data.locationId,
      row: data.row,
      events: data.events,
      ip,
    });
    return { ok: true as const };
  });

export const listTillTransfersFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; sinceMs?: number }) => ({
    locationId: loc(d.locationId),
    sinceMs: typeof d.sinceMs === "number" ? d.sinceMs : undefined,
  }))
  .handler(async ({ data }) => {
    const { listTillTransfersServer } = await import("./till-transfer.server");
    const rows = await listTillTransfersServer(data.locationId, data.sinceMs);
    return { ok: true as const, rows };
  });

export function persistTillTransfer(row: TillTransfer, events: TillTransferAudit[] = []): void {
  const ctx = ids();
  if (!ctx) return;
  try {
    void persistTillTransferFn({
      data: { locationId: ctx.locationId, orgId: ctx.orgId, row, events },
    }).catch(() => undefined);
  } catch {
    /* offline — local record is the floor copy */
  }
}

export async function pullTillTransfers(locationId: string, sinceMs?: number): Promise<TillTransfer[]> {
  if (!locationId || isProspectDemo()) return [];
  try {
    const res = await listTillTransfersFn({ data: { locationId, sinceMs } });
    return res.rows ?? [];
  } catch {
    return [];
  }
}
