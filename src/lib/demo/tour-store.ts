import { create } from "zustand";
import { getTour, type TourDefinition, type TourStep } from "./tour-scripts";
import { cancelSpeech } from "./speech";
import { exitDemoSession } from "./session";

type StartOpts = { autoPlay?: boolean };

type TourState = {
  tour: TourDefinition | null;
  index: number;
  playing: boolean;
  scripts: Record<string, string>;
  error: string | null;
  startTour: (id: string, opts?: StartOpts) => boolean;
  applyScripts: (scripts: Record<string, string>) => void;
  next: () => void;
  back: () => void;
  play: () => void;
  pause: () => void;
  exit: () => void;
  setError: (msg: string | null) => void;
};

export const useTourStore = create<TourState>((set, get) => ({
  tour: null,
  index: 0,
  playing: false,
  scripts: {},
  error: null,

  startTour: (id, opts) => {
    const def = getTour(id);
    if (!def) {
      console.error("[summex] Tour not available:", id);
      set({ error: "Tour not available", tour: null, playing: false });
      return false;
    }
    cancelSpeech();
    if (def.kind !== "walkthrough") {
      console.error("[summex] Catalog demo tours are retired:", id);
      set({ error: "Tour not available", tour: null, playing: false });
      return false;
    }
    set({
      tour: def,
      index: 0,
      playing: Boolean(opts?.autoPlay),
      scripts: {},
      error: null,
    });
    return true;
  },

  applyScripts: (scripts) => set({ scripts: { ...get().scripts, ...scripts } }),

  next: () => {
    const { tour, index } = get();
    if (!tour) return;
    if (index >= tour.steps.length - 1) {
      cancelSpeech();
      set({ tour: null, playing: false, index: 0 });
      return;
    }
    set({ index: index + 1 });
  },

  back: () => {
    const { index } = get();
    if (index <= 0) return;
    cancelSpeech();
    set({ index: index - 1, playing: false });
  },

  play: () => set({ playing: true }),
  pause: () => {
    cancelSpeech();
    set({ playing: false });
  },

  exit: () => {
    const leaving = get().tour;
    cancelSpeech();
    set({ tour: null, playing: false, index: 0, error: null });
    if (typeof window === "undefined") return;
    if (leaving?.kind === "walkthrough") return;
    const path = window.location.pathname;
    const keepVenue = /^\/demo\/(?!tour)[^/]+/.test(path);
    if (!keepVenue) exitDemoSession();
  },

  setError: (msg) => set({ error: msg }),
}));

/** Start a tour. Returns false when the id is unknown. */
export function startTour(id: string, opts?: StartOpts): boolean {
  return useTourStore.getState().startTour(id, opts);
}

export function currentStep(): TourStep | null {
  const { tour, index } = useTourStore.getState();
  if (!tour) return null;
  return tour.steps[index] ?? null;
}

export function stepScript(step: TourStep): string {
  const override = useTourStore.getState().scripts[step.id];
  return (override || step.script).trim();
}
