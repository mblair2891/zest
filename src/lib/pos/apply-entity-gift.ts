import { usePosStore } from "@/lib/pos/store";
import type { EntityGiftPolicy } from "@/lib/pos/gift-policy";

/** Same signed-in session: the floor reads this map on the next gift action. */
export function applyEntityGiftToStation(operatorId: string, policy: EntityGiftPolicy): void {
  const id = operatorId.trim();
  if (!id) return;
  const settings = usePosStore.getState().settings;
  usePosStore.getState().updateSettings({
    entityGiftPolicy: { ...(settings.entityGiftPolicy ?? {}), [id]: policy },
  });
}
