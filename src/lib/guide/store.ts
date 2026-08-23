import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { EmployeeRole } from "@/lib/pos/types";
import { employeeToGuideRoles } from "./roles";
import { latestUpdateId, updatesForRoles } from "./updates";
import type { GuideRole, GuideUpdate } from "./types";

export type GuideUserKey = string;

interface GuideState {
  guideOpen: boolean;
  focusTopicId: string | null;
  /** @deprecated alias of guideOpen — POS shells still read this */
  manualOpen: boolean;
  /** @deprecated alias of focusTopicId */
  focusSectionId: string | null;

  silencedAfterByRole: Partial<Record<EmployeeRole, string>>;
  silencedAfterByGuideRole: Partial<Record<GuideRole, string>>;
  silencedAfterAnon: string | null;

  completedByUser: Record<GuideUserKey, string[]>;
  lastTopicByUser: Record<GuideUserKey, string>;

  dismissedThisSession: boolean;
  forceWhatsNew: boolean;

  openGuide: (topicId?: string) => void;
  closeGuide: () => void;
  setFocusTopic: (id: string | null) => void;
  /** Aliases used by existing POS chrome */
  openManual: (sectionId?: string) => void;
  closeManual: () => void;
  setFocusSection: (id: string | null) => void;

  notifyLogin: () => void;
  dismissWhatsNew: (opts: {
    role?: EmployeeRole | null;
    guideRoles?: GuideRole[];
    silenceUntilNext: boolean;
  }) => void;
  openWhatsNew: () => void;
  shouldShowWhatsNew: (roles: GuideRole[] | "all") => boolean;
  updatesFor: (roles: GuideRole[] | "all", limit?: number) => GuideUpdate[];

  markComplete: (userKey: GuideUserKey, topicId: string) => void;
  markIncomplete: (userKey: GuideUserKey, topicId: string) => void;
  toggleComplete: (userKey: GuideUserKey, topicId: string) => void;
  isComplete: (userKey: GuideUserKey, topicId: string) => boolean;
  rememberTopic: (userKey: GuideUserKey, topicId: string) => void;
  continueTopicId: (userKey: GuideUserKey) => string | null;
  completedCount: (userKey: GuideUserKey) => number;
}

function uniquePush(list: string[] | undefined, id: string): string[] {
  const next = list ? [...list] : [];
  if (!next.includes(id)) next.push(id);
  return next;
}

export const useGuideStore = create<GuideState>()(
  persist(
    (set, get) => ({
      guideOpen: false,
      focusTopicId: null,
      manualOpen: false,
      focusSectionId: null,
      silencedAfterByRole: {},
      silencedAfterByGuideRole: {},
      silencedAfterAnon: null,
      completedByUser: {},
      lastTopicByUser: {},
      dismissedThisSession: false,
      forceWhatsNew: false,

      openGuide: (topicId) =>
        set({
          guideOpen: true,
          manualOpen: true,
          focusTopicId: topicId ?? get().focusTopicId,
          focusSectionId: topicId ?? get().focusTopicId,
          forceWhatsNew: false,
        }),

      closeGuide: () => set({ guideOpen: false, manualOpen: false }),

      setFocusTopic: (id) => set({ focusTopicId: id, focusSectionId: id }),

      openManual: (sectionId) => get().openGuide(sectionId),
      closeManual: () => get().closeGuide(),
      setFocusSection: (id) => get().setFocusTopic(id),

      notifyLogin: () =>
        set({
          dismissedThisSession: false,
          forceWhatsNew: false,
        }),

      dismissWhatsNew: ({ role, guideRoles, silenceUntilNext }) => {
        const mark = latestUpdateId();
        const nextEmp = { ...get().silencedAfterByRole };
        const nextGuide = { ...get().silencedAfterByGuideRole };
        let silencedAfterAnon = get().silencedAfterAnon;
        if (silenceUntilNext) {
          if (role) nextEmp[role] = mark;
          for (const r of guideRoles ?? []) nextGuide[r] = mark;
          if (!role && (!guideRoles || guideRoles.length === 0)) {
            silencedAfterAnon = mark;
          }
        }
        set({
          silencedAfterByRole: nextEmp,
          silencedAfterByGuideRole: nextGuide,
          silencedAfterAnon,
          dismissedThisSession: true,
          forceWhatsNew: false,
        });
      },

      openWhatsNew: () => {
        /* What’s New is not surfaced in the Operators Guide. */
      },

      shouldShowWhatsNew: () => false,

      updatesFor: (roles, limit = 10) => updatesForRoles(roles, limit),

      markComplete: (userKey, topicId) =>
        set({
          completedByUser: {
            ...get().completedByUser,
            [userKey]: uniquePush(get().completedByUser[userKey], topicId),
          },
        }),

      markIncomplete: (userKey, topicId) =>
        set({
          completedByUser: {
            ...get().completedByUser,
            [userKey]: (get().completedByUser[userKey] ?? []).filter(
              (id) => id !== topicId,
            ),
          },
        }),

      toggleComplete: (userKey, topicId) => {
        const done = (get().completedByUser[userKey] ?? []).includes(topicId);
        if (done) get().markIncomplete(userKey, topicId);
        else get().markComplete(userKey, topicId);
      },

      isComplete: (userKey, topicId) =>
        (get().completedByUser[userKey] ?? []).includes(topicId),

      rememberTopic: (userKey, topicId) =>
        set({
          lastTopicByUser: {
            ...get().lastTopicByUser,
            [userKey]: topicId,
          },
        }),

      continueTopicId: (userKey) => {
        const last = get().lastTopicByUser[userKey];
        if (last && !(get().completedByUser[userKey] ?? []).includes(last)) {
          return last;
        }
        return last ?? null;
      },

      completedCount: (userKey) => get().completedByUser[userKey]?.length ?? 0,
    }),
    {
      name: "summex-guide-prefs-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        silencedAfterByRole: s.silencedAfterByRole,
        silencedAfterByGuideRole: s.silencedAfterByGuideRole,
        silencedAfterAnon: s.silencedAfterAnon,
        completedByUser: s.completedByUser,
        lastTopicByUser: s.lastTopicByUser,
      }),
    },
  ),
);

/** Back-compat export name used by POS store hydration lists. */
export const useManualStore = useGuideStore;

export function guideRolesFromEmployee(role: EmployeeRole | null): GuideRole[] {
  return employeeToGuideRoles(role);
}
