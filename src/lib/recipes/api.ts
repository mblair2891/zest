import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";

export const parseRecipeFn = createServerFn({ method: "POST" })
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
    const key = `recipe:${context.userId ?? "anon"}`;
    if (rateLimit(key, 16, 60_000)) {
      throw new Error("Too many recipe scans — wait a minute");
    }
    const { parseRecipeExtract } = await import("./server");
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
    return parseRecipeExtract({ ...data, locationId });
  });

export const recipeAiStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const { recipeAiEnabled } = await import("./server");
  return { ai: recipeAiEnabled() };
});
