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

export const uploadMenuFileFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator(
    (d: {
      orgId?: string;
      locationId?: string;
      entityId?: string;
      fileName?: string;
      mime?: string;
      bodyBase64?: string;
    }) => ({
      orgId: String(d.orgId ?? "").slice(0, 80),
      locationId: String(d.locationId ?? "").trim().slice(0, 80),
      entityId: String(d.entityId ?? "").trim().slice(0, 80),
      fileName: String(d.fileName ?? "").trim().slice(0, 180),
      mime: String(d.mime ?? "").slice(0, 80),
      bodyBase64: String(d.bodyBase64 ?? "").slice(0, 8_000_000),
    }),
  )
  .handler(async ({ context, data }) => {
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    const key = `menu-upload:${context.userId ?? "anon"}`;
    if (rateLimit(key, 20, 60_000)) throw new Error("Too many uploads — wait a minute");
    const { saveMenuUpload } = await import("./menu-file.server");
    return saveMenuUpload(data);
  });

export const extractMenuIntakeFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator(
    (d: {
      entityId?: string;
      text?: string;
      fileId?: string;
      locationId?: string;
      cashDiscountEnabled?: boolean;
      cashDiscountPercent?: number;
      cashRoundIncrement?: number;
    }) => ({
      entityId: String(d.entityId ?? "").trim().slice(0, 80),
      text: String(d.text ?? "").slice(0, 20_000),
      fileId: String(d.fileId ?? "").trim().slice(0, 80),
      locationId: d.locationId ? String(d.locationId).slice(0, 80) : undefined,
      settings: asSettings(d),
    }),
  )
  .handler(async ({ context, data }): Promise<MenuIntakeDraft> => {
    const { menuAnalyzeSource } = await import("./intake");
    const source = menuAnalyzeSource({ text: data.text, fileId: data.fileId });
    if (source.kind === "refuse") throw new Error(source.error);
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    const key = `menu-intake:${context.userId ?? "anon"}`;
    if (rateLimit(key, 12, 60_000)) {
      throw new Error("Too many menu reads — wait a minute");
    }
    const { extractMenuIntake } = await import("./intake.server");
    if (source.kind === "text") {
      return extractMenuIntake({
        entityId: data.entityId,
        text: source.text,
        locationId: data.locationId,
        settings: data.settings,
      });
    }
    if (!data.locationId) throw new Error("Upload a menu first");
    const { loadMenuUpload } = await import("./menu-file.server");
    const stored = await loadMenuUpload({
      id: source.fileId,
      locationId: data.locationId,
      entityId: data.entityId,
    });
    if (!stored || !stored.bodyBase64 || stored.byteSize < 1) {
      throw new Error("Upload a menu first");
    }
    return extractMenuIntake({
      entityId: data.entityId,
      text: data.text,
      fileName: stored.fileName,
      fileBase64: stored.bodyBase64,
      storedFileId: stored.id,
      locationId: data.locationId,
      settings: data.settings,
    });
  });
