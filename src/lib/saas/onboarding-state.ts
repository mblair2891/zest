import { create } from "zustand";
import { saveLocationSettingsFn } from "@/lib/access/api";
import {
  applyProfileToLayer,
  parseLayeredOnboarding,
  seedLayeredOnboarding,
  type LayeredOnboarding,
} from "@/lib/saas/onboarding-checklist";

type Scope = { orgId: string; locationId: string };

type OnboardingState = {
  locationId: string;
  hydrated: boolean;
  layer: LayeredOnboarding | null;
  hydrate: (locationId: string, raw: unknown) => void;
  commit: (locationId: string, layer: LayeredOnboarding, orgId: string) => void;
};

let scope: Scope | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

async function writeLayer(layer: LayeredOnboarding) {
  if (!scope?.orgId || !scope.locationId) return;
  await saveLocationSettingsFn({
    data: {
      orgId: scope.orgId,
      locationId: scope.locationId,
      setup: { onboardingChecklist: layer } as never,
    },
  });
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  locationId: "",
  hydrated: false,
  layer: null,
  hydrate: (locationId, raw) => {
    const parsed = raw ? parseLayeredOnboarding(raw) : null;
    set({ locationId, hydrated: true, layer: parsed });
  },
  commit: (locationId, layer, orgId) => {
    scope = { orgId, locationId };
    set({ locationId, hydrated: true, layer });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void writeLayer(layer).catch(() => undefined);
    }, 250);
  },
}));

export function rememberChecklistScope(orgId: string, locationId: string) {
  scope = { orgId, locationId };
}

/** Profile save marks contact, address, and timezone together and writes the venue row. */
export async function saveLocationProfileChecklist(opts: {
  orgId: string;
  locationId: string;
  peer?: boolean;
  filled: { contact: boolean; address: boolean; timezone: boolean };
  contact?: { name?: string; email?: string; phone?: string };
}): Promise<LayeredOnboarding> {
  const cur = useOnboardingStore.getState();
  const base =
    cur.locationId === opts.locationId && cur.layer
      ? cur.layer
      : seedLayeredOnboarding({ peer: Boolean(opts.peer), entities: [] });
  const next = applyProfileToLayer(base, opts.filled, opts.contact);
  scope = { orgId: opts.orgId, locationId: opts.locationId };
  if (timer) clearTimeout(timer);
  useOnboardingStore.setState({ locationId: opts.locationId, hydrated: true, layer: next });
  await writeLayer(next);
  return next;
}

export function readChecklistLayer(): LayeredOnboarding | null {
  return useOnboardingStore.getState().layer;
}
