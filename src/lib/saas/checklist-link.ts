import { create } from "zustand";
import type { VenueDashTabId } from "@/lib/saas/venue-dashboard-tabs";

/** One open checklist task. Status flips to done only after a matching save. */
export type ChecklistLink = {
  scope: "location" | "entity";
  entityId?: string;
  itemId: string;
  label: string;
  tab: VenueDashTabId;
  focus?: string;
  readOnly: boolean;
  blocker?: string;
  saved: boolean;
};

type ChecklistLinkState = {
  link: ChecklistLink | null;
  applySerial: number;
  applied: ChecklistLink | null;
  open: (next: Omit<ChecklistLink, "saved">) => void;
  noteSave: (match: { tab: VenueDashTabId; focus?: string }) => void;
  back: () => void;
  done: () => void;
  clearApplied: () => void;
};

export const useChecklistLink = create<ChecklistLinkState>((set, get) => ({
  link: null,
  applySerial: 0,
  applied: null,
  open: (next) => set({ link: { ...next, saved: false } }),
  noteSave: (match) => {
    const link = get().link;
    if (!link || link.readOnly || link.saved) return;
    if (link.tab !== match.tab) return;
    if (match.focus && link.focus && match.focus !== link.focus) return;
    set({ link: { ...link, saved: true } });
  },
  back: () => set({ link: null }),
  done: () => {
    const link = get().link;
    const apply = link && link.saved && !link.readOnly ? link : null;
    set({
      link: null,
      applied: apply,
      applySerial: apply ? get().applySerial + 1 : get().applySerial,
    });
  },
  clearApplied: () => set({ applied: null }),
}));

/** Call after a destination save succeeds. Does nothing for a blocked (read-only) task. */
export function noteChecklistSave(match: { tab: VenueDashTabId; focus?: string }) {
  useChecklistLink.getState().noteSave(match);
}
