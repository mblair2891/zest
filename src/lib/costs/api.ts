import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";

export const parseCostInvoiceFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { text?: string; fileName?: string; imageDataUrl?: string }) => ({
    text: String(d.text ?? "").slice(0, 8000),
    fileName: d.fileName ? String(d.fileName).slice(0, 180) : undefined,
    imageDataUrl: d.imageDataUrl
      ? String(d.imageDataUrl).slice(0, 1_600_000)
      : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    const key = `cost-inv:${context.userId ?? "anon"}`;
    if (rateLimit(key, 12, 60_000)) {
      throw new Error("Too many invoice scans — wait a minute");
    }
    const { parseInvoiceExtract } = await import("./invoice.server");
    let locationId: string | undefined;
    if (context.userId) {
      try {
        const { resolveActiveTenant } = await import("@/lib/saas/tenancy.server");
        const t = await resolveActiveTenant(context.userId);
        locationId = t?.locationId ?? undefined;
      } catch {
        /* */
      }
    }
    return parseInvoiceExtract({ ...data, locationId });
  });

export const costAiStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const { costAiEnabled } = await import("./invoice.server");
  return { ai: costAiEnabled() };
});

export const costPictureFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { prompt: string }) => ({
    prompt: String(d.prompt ?? "").slice(0, 4000),
  }))
  .handler(async ({ context, data }) => {
    const { narrativeCostPicture } = await import("./invoice.server");
    let locationId: string | undefined;
    if (context.userId) {
      try {
        const { resolveActiveTenant } = await import("@/lib/saas/tenancy.server");
        const t = await resolveActiveTenant(context.userId);
        locationId = t?.locationId ?? undefined;
      } catch {
        /* */
      }
    }
    const text = await narrativeCostPicture(data.prompt, locationId);
    return { text };
  });

export const sendCostPoEmailFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { to: string; subject: string; text: string; csv?: string }) => ({
    to: String(d.to ?? "").slice(0, 180),
    subject: String(d.subject ?? "").slice(0, 180),
    text: String(d.text ?? "").slice(0, 8000),
    csv: d.csv ? String(d.csv).slice(0, 20000) : undefined,
  }))
  .handler(async ({ data }) => {
    const { sendEmail } = await import("@/lib/saas/email.server");
    const body = data.csv
      ? `${data.text}\n\n--- CSV ---\n${data.csv}`
      : data.text;
    return sendEmail({
      to: data.to,
      subject: data.subject,
      text: body,
      kind: "cost_po",
    });
  });

/** Public OLCC liquor stores: name, address, and phone. Does not place an order. */
export const listOlccStoresFn = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    const key = `olcc-stores:${context.userId ?? "anon"}`;
    if (rateLimit(key, 8, 60_000)) {
      throw new Error("Too many store list reads — wait a minute");
    }
    const { fetchOlccStores } = await import("./olcc-stores");
    const stores = await fetchOlccStores();
    return { stores };
  });

/** Read one month of the public OLCC price list. Does not place an order. */
export const refreshOlccPricesFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { asOf?: string }) => ({
    asOf: String(d.asOf ?? "").slice(0, 10),
  }))
  .handler(async ({ context, data }) => {
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    const key = `olcc:${context.userId ?? "anon"}`;
    if (rateLimit(key, 8, 60_000)) {
      throw new Error("Too many price list reads — wait a minute");
    }
    const { fetchOlccMonth } = await import("./olcc");
    const prices = await fetchOlccMonth(data.asOf);
    return { prices };
  });

/** Read which stores have these bottles. Does not place an order. */
export const checkOlccHouseStockFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { houseStoreNumber?: string; lines?: { itemCode?: string }[] }) => ({
    houseStoreNumber: String(d.houseStoreNumber ?? "").replace(/\D/g, "").slice(0, 8),
    lines: (Array.isArray(d.lines) ? d.lines : [])
      .slice(0, 40)
      .map((line) => ({ itemCode: String(line?.itemCode ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 16) }))
      .filter((line) => line.itemCode),
  }))
  .handler(async ({ context, data }) => {
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    const key = `olcc-stock:${context.userId ?? "anon"}`;
    if (rateLimit(key, 6, 60_000)) {
      throw new Error("Too many stock checks — wait a minute");
    }
    if (!data.houseStoreNumber) throw new Error("Pick the house store first");
    const { fetchOlccOrderStock } = await import("./olcc-stock");
    const byItem = await fetchOlccOrderStock(data.lines, data.houseStoreNumber);
    let directory: { storeNumber: string; name: string; city: string; address: string; phone: string }[] = [];
    try {
      const { fetchOlccStores } = await import("./olcc-stores");
      directory = await fetchOlccStores();
    } catch {
      directory = [];
    }
    return { byItem, directory };
  });

export const sendVarianceAlertFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: { to: string; subject: string; text: string }) => ({
    to: String(d.to ?? "").slice(0, 180),
    subject: String(d.subject ?? "").slice(0, 180),
    text: String(d.text ?? "").slice(0, 8000),
  }))
  .handler(async ({ data }) => {
    const { sendEmail } = await import("@/lib/saas/email.server");
    return sendEmail({
      to: data.to,
      subject: data.subject,
      text: data.text,
      kind: "cost_variance",
    });
  });
