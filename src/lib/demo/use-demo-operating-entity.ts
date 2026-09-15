import { usePosStore } from "@/lib/pos/store";

/** Null = House (all entities). Live subscribers always null. */
export function useDemoOperatingEntityId(): string | null {
  return usePosStore((s) =>
    s.settings.isDemo || s.settings.demoIsolated ? s.demoOperatingEntityId : null,
  );
}
