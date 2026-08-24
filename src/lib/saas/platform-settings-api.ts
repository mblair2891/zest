import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { PlatformTeamRole, PlatformTeamStatus, SaveableSection } from "./platform-settings";

export const loadPlatformSettingsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { loadSettingsBundle } = await import("./platform-settings.server");
    return loadSettingsBundle(context.userId);
  });

export const savePlatformSectionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { section: string; value: unknown }) => ({
    section: String(d.section ?? "") as SaveableSection,
    value: d.value,
  }))
  .handler(async ({ context, data }) => {
    const { saveSettingsSection } = await import("./platform-settings.server");
    const allowed: SaveableSection[] = [
      "general",
      "security",
      "crm",
      "onboarding",
      "payments",
      "communications",
      "flags",
      "compliance",
    ];
    if (!allowed.includes(data.section)) throw new Error("Unknown settings section");
    return saveSettingsSection(context.userId, data.section, data.value);
  });

export const savePlatformPlansFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { plans: unknown; billing: unknown }) => ({
    plans: d.plans,
    billing: d.billing,
  }))
  .handler(async ({ context, data }) => {
    const { savePlansAndBilling } = await import("./platform-settings.server");
    return savePlansAndBilling(context.userId, data);
  });

export const invitePlatformUserFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { email: string; role: string }) => ({
    email: String(d.email ?? "").trim(),
    role: String(d.role ?? "read_only") as PlatformTeamRole,
  }))
  .handler(async ({ context, data }) => {
    const { invitePlatformUser } = await import("./platform-settings.server");
    return invitePlatformUser(context.userId, data);
  });

export const updatePlatformUserFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; role?: string; status?: string }) => ({
    userId: String(d.userId ?? ""),
    role: d.role ? (String(d.role) as PlatformTeamRole) : undefined,
    status: d.status ? (String(d.status) as PlatformTeamStatus) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { updatePlatformUser } = await import("./platform-settings.server");
    return updatePlatformUser(context.userId, data);
  });
