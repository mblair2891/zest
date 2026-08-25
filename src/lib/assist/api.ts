import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { ASSIST_DOMAINS, type AssistContext, type AssistDomain, type AssistMessage } from "./types";

function asDomain(v: unknown): AssistDomain {
  const s = String(v ?? "");
  return (ASSIST_DOMAINS as readonly string[]).includes(s)
    ? (s as AssistDomain)
    : "menu_item";
}

function asMessages(raw: unknown): AssistMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => {
      const row = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
      const role = row.role === "assistant" ? "assistant" : "user";
      const text = String(row.text ?? "").slice(0, 4000);
      return { role, text } as AssistMessage;
    })
    .filter((m) => m.text.trim())
    .slice(-12);
}

function asContext(raw: unknown): AssistContext {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const cats = Array.isArray(o.categories) ? o.categories : [];
  const ops = Array.isArray(o.operators) ? o.operators : [];
  const secs = Array.isArray(o.sections) ? o.sections : [];
  const mods = Array.isArray(o.existingModifiers) ? o.existingModifiers : [];
  const seed = o.seedItem && typeof o.seedItem === "object"
    ? (o.seedItem as Record<string, unknown>)
    : null;
  return {
    locationId: o.locationId ? String(o.locationId) : undefined,
    locationName: o.locationName ? String(o.locationName) : undefined,
    timezone: o.timezone ? String(o.timezone) : undefined,
    hostMultiOperator: Boolean(o.hostMultiOperator),
    cashDiscountEnabled: Boolean(o.cashDiscountEnabled),
    cashDiscountPercent: Number(o.cashDiscountPercent) || 0,
    cashRoundIncrement: Number(o.cashRoundIncrement) || 0.25,
    categories: cats.map((c) => {
      const r = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
      return {
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        station: String(r.station ?? "kitchen"),
      };
    }),
    operators: ops.map((c) => {
      const r = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
      return {
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        stationType: r.stationType ? String(r.stationType) : undefined,
      };
    }),
    sections: secs.map((c) => {
      const r = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
      return { id: String(r.id ?? ""), name: String(r.name ?? "") };
    }),
    scopedVendorId: o.scopedVendorId ? String(o.scopedVendorId) : undefined,
    scopedVendorName: o.scopedVendorName ? String(o.scopedVendorName) : undefined,
    existingModifiers: mods.map((c) => {
      const r = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
      const options = Array.isArray(r.options)
        ? r.options.map((x) => String(x ?? "")).filter(Boolean)
        : [];
      return { id: String(r.id ?? ""), name: String(r.name ?? ""), options };
    }),
    seedItem: seed
      ? {
          id: String(seed.id ?? ""),
          name: String(seed.name ?? ""),
          description: seed.description ? String(seed.description) : undefined,
          priceCents: Number(seed.priceCents) || 0,
          categoryId: String(seed.categoryId ?? ""),
          station: String(seed.station ?? "kitchen"),
          course: String(seed.course ?? "entree"),
          vendorId: seed.vendorId ? String(seed.vendorId) : undefined,
          modifierGroupIds: Array.isArray(seed.modifierGroupIds)
            ? seed.modifierGroupIds.map((x) => String(x ?? "")).filter(Boolean)
            : [],
        }
      : undefined,
  };
}

export const assistSetupTurnFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { domain: string; messages: unknown; context?: unknown }) => ({
    domain: asDomain(d.domain),
    messages: asMessages(d.messages),
    context: asContext(d.context),
  }))
  .handler(async ({ context, data }) => {
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    const key = `assist:${context.userId ?? "anon"}:${data.domain}`;
    if (rateLimit(key, 24, 60_000)) {
      throw new Error("Too many assist turns — wait a minute");
    }
    const { runAssistSetupTurn } = await import("./server");
    return runAssistSetupTurn({
      domain: data.domain,
      messages: data.messages,
      context: data.context,
    });
  });

export const assistAiStatusFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { assistUsesAi } = await import("./server");
    return { ai: assistUsesAi() };
  },
);
