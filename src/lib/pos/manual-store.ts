import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { EmployeeRole } from "./types";
import {
  hasUnseenUpdates,
  latestUpdateId,
  updatesForRole,
  type ProductUpdate,
} from "./manual-content";

interface ManualState {
  /** Full-screen interactive manual open */
  manualOpen: boolean;
  /** Section id to focus when opening */
  focusSectionId: string | null;
  /**
   * Per access level: silence What’s New until a newer update than this id.
   * Keyed by role so each persona has its own preference.
   */
  silencedAfterByRole: Partial<Record<EmployeeRole, string>>;
  /**
   * Session-only: after dismiss this login, don’t re-open until next login.
   * Not persisted.
   */
  dismissedThisSession: boolean;
  /** Force open What’s New (e.g. from manual) */
  forceWhatsNew: boolean;

  openManual: (sectionId?: string) => void;
  closeManual: () => void;
  setFocusSection: (id: string | null) => void;

  /** Call from POS login so popup can show again */
  notifyLogin: () => void;
  dismissWhatsNew: (opts: {
    role: EmployeeRole;
    silenceUntilNext: boolean;
  }) => void;
  openWhatsNew: () => void;

  shouldShowWhatsNew: (role: EmployeeRole) => boolean;
  updatesFor: (role: EmployeeRole, limit?: number) => ProductUpdate[];
}

export const useManualStore = create<ManualState>()(
  persist(
    (set, get) => ({
      manualOpen: false,
      focusSectionId: null,
      silencedAfterByRole: {},
      dismissedThisSession: false,
      forceWhatsNew: false,

      openManual: (sectionId) =>
        set({
          manualOpen: true,
          focusSectionId: sectionId ?? get().focusSectionId,
          forceWhatsNew: false,
        }),

      closeManual: () => set({ manualOpen: false }),

      setFocusSection: (id) => set({ focusSectionId: id }),

      notifyLogin: () =>
        set({
          dismissedThisSession: false,
          forceWhatsNew: false,
        }),

      dismissWhatsNew: ({ role, silenceUntilNext }) => {
        const next: Partial<Record<EmployeeRole, string>> = {
          ...get().silencedAfterByRole,
        };
        if (silenceUntilNext) {
          // Watermark = newest catalog id so only *future* updates re-open
          next[role] = latestUpdateId();
        }
        set({
          silencedAfterByRole: next,
          dismissedThisSession: true,
          forceWhatsNew: false,
        });
      },

      openWhatsNew: () =>
        set({
          forceWhatsNew: true,
          dismissedThisSession: false,
        }),

      shouldShowWhatsNew: (role) => {
        const s = get();
        if (s.forceWhatsNew) return true;
        if (s.dismissedThisSession) return false;
        const mark = s.silencedAfterByRole[role] ?? null;
        return hasUnseenUpdates(role, mark);
      },

      updatesFor: (role, limit = 10) => updatesForRole(role, limit),
    }),
    {
      name: "zest-manual-prefs-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        silencedAfterByRole: s.silencedAfterByRole,
        // do not persist session flags or open state across reloads as "still open"
      }),
    },
  ),
);
