import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface OnboardingState {
  /** userKey → completed walkthrough keys (role or device). */
  walkthroughCompleted: Record<string, string[]>;
  /** Keys offered during this tab session (not persisted). */
  offeredThisSession: string[];

  markWalkthroughComplete: (userKey: string, key: string) => void;
  isWalkthroughComplete: (userKey: string, key: string) => boolean;
  markOffered: (key: string) => void;
  wasOffered: (key: string) => boolean;
  resetSession: () => void;
}

function uniquePush(list: string[] | undefined, id: string): string[] {
  const next = list ? [...list] : [];
  if (!next.includes(id)) next.push(id);
  return next;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      walkthroughCompleted: {},
      offeredThisSession: [],

      markWalkthroughComplete: (userKey, key) =>
        set({
          walkthroughCompleted: {
            ...get().walkthroughCompleted,
            [userKey]: uniquePush(get().walkthroughCompleted[userKey], key),
          },
        }),

      isWalkthroughComplete: (userKey, key) =>
        (get().walkthroughCompleted[userKey] ?? []).includes(key),

      markOffered: (key) => {
        if (get().offeredThisSession.includes(key)) return;
        set({ offeredThisSession: [...get().offeredThisSession, key] });
      },

      wasOffered: (key) => get().offeredThisSession.includes(key),

      resetSession: () => set({ offeredThisSession: [] }),
    }),
    {
      name: "summex-onboarding-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        walkthroughCompleted: s.walkthroughCompleted,
      }),
    },
  ),
);
