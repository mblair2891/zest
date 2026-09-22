import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";

function logoInput(d: {
  locationId?: string;
  operatorId?: string;
  mime?: string;
  originalBase64?: string;
  screenUrl?: string;
  receipt?: { width?: number; height?: number; rowsBase64?: string } | null;
}) {
  const receipt = d.receipt;
  return {
    locationId: String(d.locationId ?? "").trim(),
    operatorId: String(d.operatorId ?? "").trim().slice(0, 80),
    mime: String(d.mime ?? "").slice(0, 40),
    originalBase64: String(d.originalBase64 ?? "").slice(0, 2_900_000),
    screenUrl: String(d.screenUrl ?? "").slice(0, 200_000),
    receipt:
      receipt && typeof receipt === "object"
        ? {
            width: Math.round(Number(receipt.width) || 0),
            height: Math.round(Number(receipt.height) || 0),
            rowsBase64: String(receipt.rowsBase64 ?? "").slice(0, 80_000),
          }
        : null,
  };
}

export const saveBrandLogoFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator(logoInput)
  .handler(async ({ context, data }) => {
    const { saveBrandLogo } = await import("./logos.server");
    return saveBrandLogo(context.userId, data);
  });

export const clearBrandLogoFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId?: string; operatorId?: string }) => ({
    locationId: String(d.locationId ?? "").trim(),
    operatorId: String(d.operatorId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { clearBrandLogo } = await import("./logos.server");
    return clearBrandLogo(context.userId, data);
  });
