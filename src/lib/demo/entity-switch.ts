/**
 * Demo-only “Operating as” entity switcher.
 * NEVER on live / training / onboarding subscriber venues.
 */
export function showDemoEntitySwitcher(opts: {
  isDemo?: boolean | null;
  demoIsolated?: boolean | null;
  lifecycleStatus?: string | null;
  entityCount: number;
}): boolean {
  if (!opts.isDemo && !opts.demoIsolated) return false;
  if (opts.entityCount < 2) return false;
  return true;
}

export function demoEntityMatches(
  scopeId: string | null | undefined,
  ownerId: string | null | undefined,
): boolean {
  if (!scopeId) return true;
  return String(ownerId ?? "") === scopeId;
}

export const DEMO_SCOPED_TABS = [
  "menu",
  "people",
  "staff",
  "reports",
  "labor",
  "costs",
  "schedule",
  "payments",
  "ledger",
] as const;

export function demoScopeRemountKey(
  tab: string,
  scopeId: string | null | undefined,
): string {
  const scoped = (DEMO_SCOPED_TABS as readonly string[]).includes(tab);
  return scoped ? `${tab}:${scopeId || "house"}` : `${tab}:venue`;
}
