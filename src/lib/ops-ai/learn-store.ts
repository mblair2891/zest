import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { demoPersistStorage, isProspectDemo } from "@/lib/demo/session";
import type { OpsDecisionAction, OpsDecisionEvent, OpsFeatureSnapshot, OpsRecType } from "./types";
import { recordOpsDecisionFn } from "./api";

type LearnState = {
  events: OpsDecisionEvent[];
  record: (input: Omit<OpsDecisionEvent, "id" | "at">) => OpsDecisionEvent;
};

export const useOpsLearnStore = create<LearnState>()(
  persist(
    (set, get) => ({
      events: [],
      record: (input) => {
        const ev: OpsDecisionEvent = {
          ...input,
          id: uid("dec"),
          at: Date.now(),
        };
        set({ events: [ev, ...get().events].slice(0, 400) });
        if (!isProspectDemo() && input.locationId) {
          void recordOpsDecisionFn({
            data: {
              locationId: input.locationId,
              operatorId: input.operatorId,
              recType: input.recType,
              recId: input.recId,
              action: input.action,
              features: input.features,
            },
          }).catch(() => undefined);
        }
        return ev;
      },
    }),
    {
      name: "summex-ops-ai-v1",
      storage: createJSONStorage(() => demoPersistStorage()),
      skipHydration: true,
      partialize: (s) => ({ events: s.events }),
    },
  ),
);

export function daypartOf(ms = Date.now()): string {
  const h = new Date(ms).getHours();
  if (h < 11) return "morning";
  if (h < 15) return "lunch";
  if (h < 17) return "afternoon";
  if (h < 22) return "dinner";
  return "late";
}

export function typeWeight(
  events: OpsDecisionEvent[],
  type: OpsRecType,
  features: OpsFeatureSnapshot,
  operatorId?: string | null,
): { weight: number; accepts: number; dismisses: number; basedOnPast: boolean } {
  const relevant = events.filter(
    (e) =>
      e.recType === type &&
      (!operatorId || e.operatorId === operatorId || !e.operatorId) &&
      e.features.daypart === features.daypart,
  );
  let score = 0;
  let accepts = 0;
  let dismisses = 0;
  for (const e of relevant.slice(0, 20)) {
    if (e.action === "accept") {
      score += 2;
      accepts += 1;
    } else if (e.action === "dismiss") {
      score -= 1.5;
      dismisses += 1;
    }
  }
  const weight = Math.max(0.3, Math.min(2.5, 1 + score * 0.15));
  return { weight, accepts, dismisses, basedOnPast: accepts > 0 || dismisses >= 2 };
}

export function recordDecision(input: {
  locationId: string;
  operatorId?: string | null;
  recId: string;
  recType: OpsRecType;
  action: OpsDecisionAction;
  features: OpsFeatureSnapshot;
  userId: string;
}): OpsDecisionEvent {
  return useOpsLearnStore.getState().record({
    locationId: input.locationId,
    operatorId: input.operatorId ?? null,
    recId: input.recId,
    recType: input.recType,
    action: input.action,
    features: input.features,
    userId: input.userId,
  });
}
