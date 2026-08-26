import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import type { SessionModeId } from "@/lib/lifecycle/types";

export type StationAssignment = {
  kind: SessionModeId;
  operatorId: string;
};

export type SplitRatio = "50" | "70";

export type StationSaved = {
  assignment: StationAssignment;
  splitEnabled: boolean;
  splitRatio: SplitRatio;
  paneA: StationAssignment;
  paneB: StationAssignment;
  focusedPane: "a" | "b" | null;
};

type StationSessionState = StationSaved & {
  locationId: string;
  byLocation: Record<string, StationSaved>;
  ensureLocation: (locationId: string) => void;
  setAssignment: (next: Partial<StationAssignment>) => void;
  setSplit: (on: boolean) => void;
  setSplitRatio: (ratio: SplitRatio) => void;
  setPane: (which: "a" | "b", next: Partial<StationAssignment>) => void;
  setFocusedPane: (pane: "a" | "b" | null) => void;
  seedSplitDefaults: (paneA: StationAssignment, paneB: StationAssignment) => void;
};

const DEFAULT_ASSIGNMENT: StationAssignment = {
  kind: "floor_pos",
  operatorId: HOST_SCOPE,
};

const DEFAULT_SAVED: StationSaved = {
  assignment: DEFAULT_ASSIGNMENT,
  splitEnabled: false,
  splitRatio: "50",
  paneA: { kind: "kitchen_kds", operatorId: HOST_SCOPE },
  paneB: { kind: "bar_kds", operatorId: HOST_SCOPE },
  focusedPane: null,
};

function snapshot(s: StationSaved): StationSaved {
  return {
    assignment: { ...s.assignment },
    splitEnabled: s.splitEnabled,
    splitRatio: s.splitRatio,
    paneA: { ...s.paneA },
    paneB: { ...s.paneB },
    focusedPane: s.focusedPane,
  };
}

function remember(get: () => StationSessionState, patch: Partial<StationSaved>) {
  const loc = get().locationId || "loc";
  const merged: StationSaved = {
    assignment: patch.assignment ?? get().assignment,
    splitEnabled: patch.splitEnabled ?? get().splitEnabled,
    splitRatio: patch.splitRatio ?? get().splitRatio,
    paneA: patch.paneA ?? get().paneA,
    paneB: patch.paneB ?? get().paneB,
    focusedPane: patch.focusedPane === undefined ? get().focusedPane : patch.focusedPane,
  };
  return {
    ...patch,
    byLocation: { ...get().byLocation, [loc]: snapshot(merged) },
  };
}

export const useStationSessionStore = create<StationSessionState>()(
  persist(
    (set, get) => ({
      locationId: "",
      byLocation: {},
      ...DEFAULT_SAVED,

      ensureLocation: (locationId) => {
        const id = locationId || "loc";
        if (get().locationId === id) return;
        const saved = get().byLocation[id];
        if (saved) {
          set({ locationId: id, ...snapshot(saved) });
          return;
        }
        const seeded = snapshot({
          assignment: get().assignment,
          splitEnabled: false,
          splitRatio: get().splitRatio,
          paneA: get().paneA,
          paneB: get().paneB,
          focusedPane: null,
        });
        set({
          locationId: id,
          ...seeded,
          byLocation: { ...get().byLocation, [id]: seeded },
        });
      },

      setAssignment: (next) => {
        const assignment = { ...get().assignment, ...next };
        set(remember(get, { assignment }));
      },

      setSplit: (splitEnabled) => {
        set(
          remember(get, {
            splitEnabled,
            focusedPane: splitEnabled ? get().focusedPane : null,
          }),
        );
      },

      setSplitRatio: (splitRatio) => set(remember(get, { splitRatio })),

      setPane: (which, next) => {
        if (which === "a") {
          const paneA = { ...get().paneA, ...next };
          set(remember(get, { paneA }));
        } else {
          const paneB = { ...get().paneB, ...next };
          set(remember(get, { paneB }));
        }
      },

      setFocusedPane: (focusedPane) => set(remember(get, { focusedPane })),

      seedSplitDefaults: (paneA, paneB) => {
        if (get().splitEnabled) return;
        set(remember(get, { paneA, paneB, splitEnabled: true, focusedPane: null }));
      },
    }),
    {
      name: "summex-station-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        locationId: s.locationId,
        byLocation: s.byLocation,
        assignment: s.assignment,
        splitEnabled: s.splitEnabled,
        splitRatio: s.splitRatio,
        paneA: s.paneA,
        paneB: s.paneB,
        focusedPane: s.focusedPane,
      }),
    },
  ),
);
