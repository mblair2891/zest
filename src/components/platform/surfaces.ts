export const PLATFORM_SURFACES = [
  "home",
  "crm",
  "pipeline",
  "tenants",
  "onboarding",
  "billing",
  "support",
  "bulletins",
  "reports",
  "settings",
] as const;

export type PlatformSurface = (typeof PLATFORM_SURFACES)[number];

export const PLATFORM_SURFACE_LABEL: Record<PlatformSurface, string> = {
  home: "Dashboard",
  crm: "CRM",
  pipeline: "Pipeline",
  tenants: "Tenants",
  onboarding: "Onboarding",
  billing: "Billing",
  support: "Support",
  bulletins: "Reg bulletins",
  reports: "Reports",
  settings: "Settings",
};

export function parsePlatformSurface(raw: unknown): PlatformSurface | null {
  return (PLATFORM_SURFACES as readonly string[]).includes(String(raw))
    ? (raw as PlatformSurface)
    : null;
}
