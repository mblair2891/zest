import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { EmployeeRole, VenueEntityId } from "@/lib/pos/types";
import { employeeToGuideRoles } from "./roles";
import {
  hasUnseenUpdates,
  latestMatchingUpdateId,
  updatesForContext,
  type WhatsNewContext,
} from "./updates";
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
  /** `${userKey}:${role}` → last seen update id when they chose silence. */
  silencedAfterByUser: Record<string, string>;

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
    userKey?: string;
    role?: EmployeeRole | null;
    guideRoles?: GuideRole[];
    silenceUntilNext: boolean;
    lastSeenId?: string;
  }) => void;
  openWhatsNew: () => void;
  shouldShowWhatsNew: (
    roles: GuideRole[] | "all",
    opts?: {
      userKey?: string;
      employeeRole?: EmployeeRole | null;
      entityType?: VenueEntityId | null;
      includePlatform?: boolean;
      isDemo?: boolean;
    },
  ) => boolean;
  updatesFor: (roles: GuideRole[] | "all", limit?: number) => GuideUpdate[];
  updatesForCtx: (ctx: WhatsNewContext, limit?: number) => GuideUpdate[];

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
      silencedAfterByUser: {},
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

      dismissWhatsNew: ({
        userKey,
        role,
        guideRoles,
        silenceUntilNext,
        lastSeenId,
      }) => {
        const mark =
          lastSeenId ??
          latestMatchingUpdateId({
            roles: guideRoles && guideRoles.length ? guideRoles : "all",
          });
        const nextEmp = { ...get().silencedAfterByRole };
        const nextGuide = { ...get().silencedAfterByGuideRole };
        const nextUser = { ...get().silencedAfterByUser };
        let silencedAfterAnon = get().silencedAfterAnon;
        if (silenceUntilNext) {
          if (role) nextEmp[role] = mark;
          for (const r of guideRoles ?? []) nextGuide[r] = mark;
          if (userKey) {
            nextUser[userKey] = mark;
            if (role) nextUser[`${userKey}:${role}`] = mark;
          }
          if (!userKey && !role && (!guideRoles || guideRoles.length === 0)) {
            silencedAfterAnon = mark;
          }
        }
        set({
          silencedAfterByRole: nextEmp,
          silencedAfterByGuideRole: nextGuide,
          silencedAfterByUser: nextUser,
          silencedAfterAnon,
          dismissedThisSession: true,
          forceWhatsNew: false,
        });
      },

      openWhatsNew: () =>
        set({
          forceWhatsNew: true,
          dismissedThisSession: false,
          guideOpen: false,
          manualOpen: false,
        }),

      shouldShowWhatsNew: (roles, opts) => {
        const s = get();
        if (s.forceWhatsNew) return true;
        if (s.dismissedThisSession) return false;
        const userKey = opts?.userKey;
        const empRole = opts?.employeeRole;
        const byUser = s.silencedAfterByUser ?? {};
        const watermark =
          (userKey && empRole && byUser[`${userKey}:${empRole}`]) ||
          (userKey && byUser[userKey]) ||
          (empRole && s.silencedAfterByRole[empRole]) ||
          (Array.isArray(roles)
            ? roles.map((r) => s.silencedAfterByGuideRole[r]).find(Boolean)
            : undefined) ||
          s.silencedAfterAnon ||
          null;
        return hasUnseenUpdates(roles, watermark ?? null, {
          entityType: opts?.entityType,
          includePlatform: opts?.includePlatform,
          isDemo: opts?.isDemo,
        });
      },

      updatesFor: (roles, limit = 10) =>
        updatesForContext({ roles }, limit),

      updatesForCtx: (ctx, limit = 10) => updatesForContext(ctx, limit),

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
        silencedAfterByUser: s.silencedAfterByUser,
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
