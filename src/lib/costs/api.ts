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
    return parseInvoiceExtract(data);
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
  .handler(async ({ data }) => {
    const { narrativeCostPicture } = await import("./invoice.server");
    const text = await narrativeCostPicture(data.prompt);
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
