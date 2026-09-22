import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import type { IntakeSettings, MenuIntakeDraft } from "./intake";

function asSettings(raw: unknown): IntakeSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    cashDiscountEnabled: Boolean(o.cashDiscountEnabled),
    cashDiscountPercent: Number(o.cashDiscountPercent) || 0,
    cashRoundIncrement: Number(o.cashRoundIncrement) || 0.25,
  };
}

export const extractMenuIntakeFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator(
    (d: {
      entityId?: string;
      text?: string;
      fileName?: string;
      fileBase64?: string;
      locationId?: string;
      cashDiscountEnabled?: boolean;
      cashDiscountPercent?: number;
      cashRoundIncrement?: number;
    }) => ({
      entityId: String(d.entityId ?? "").trim().slice(0, 80),
      text: String(d.text ?? "").slice(0, 20_000),
      fileName: String(d.fileName ?? "").slice(0, 180),
      fileBase64: String(d.fileBase64 ?? "").slice(0, 2_100_000),
      locationId: d.locationId ? String(d.locationId).slice(0, 80) : undefined,
      settings: asSettings(d),
    }),
  )
  .handler(async ({ context, data }): Promise<MenuIntakeDraft> => {
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    const key = `menu-intake:${context.userId ?? "anon"}`;
    if (rateLimit(key, 12, 60_000)) {
      throw new Error("Too many menu reads — wait a minute");
    }
    const { extractMenuIntake } = await import("./intake.server");
    return extractMenuIntake(data);
  });
