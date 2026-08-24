import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import type { OutboxKind } from "./types";

export type FlushItem = {
  clientMutationId: string;
  locationId: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  label: string;
};

export type FlushResult = {
  clientMutationId: string;
  status: "applied" | "duplicate" | "conflict" | "rejected";
  error?: string;
};

function clipKind(raw: unknown): OutboxKind {
  const s = String(raw ?? "");
  const ok: OutboxKind[] = [
    "card_capture",
    "cash_ledger",
    "order_upsert",
    "ticket_upsert",
    "ticket_bump",
    "table_seat",
    "waitlist_add",
    "waitlist_sms",
    "online_order_pull",
    "gift_cloud",
    "loyalty",
    "payout",
    "menu_publish",
    "receipt_email",
    "settings_patch",
  ];
  return (ok.includes(s as OutboxKind) ? s : "order_upsert") as OutboxKind;
}

export const flushOfflineMutationsFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { items: FlushItem[] }) => ({
    items: Array.isArray(d.items)
      ? d.items.slice(0, 40).map((it) => ({
          clientMutationId: String(it.clientMutationId ?? "").slice(0, 80),
          locationId: String(it.locationId ?? "").slice(0, 80),
          kind: clipKind(it.kind),
          payload:
            it.payload && typeof it.payload === "object"
              ? (it.payload as Record<string, unknown>)
              : {},
          label: String(it.label ?? "").slice(0, 160),
        }))
      : [],
  }))
  .handler(async ({ context, data }): Promise<{ results: FlushResult[] }> => {
    const userId = context.userId || "demo-offline";
    const { applyOfflineBatch } = await import("./apply.server");
    return applyOfflineBatch(userId, data.items);
  });

export const pingHealthFn = createServerFn({ method: "GET" }).handler(async () => {
  return { ok: true, t: Date.now() };
});
