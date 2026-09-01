import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DaypartBaseline, JobCadence, OpsJobReport } from "./types";

type OpsJobsState = {
  inbox: OpsJobReport[];
  lastFired: Partial<Record<JobCadence, string>>;
  baselines: DaypartBaseline[];
  push: (row: OpsJobReport) => void;
  markFired: (cadence: JobCadence, key: string) => void;
  setBaselines: (rows: DaypartBaseline[]) => void;
  markRead?: never;
};

export const useOpsJobsStore = create<OpsJobsState>()(
  persist(
    (set) => ({
      inbox: [],
      lastFired: {},
      baselines: [],
      push: (row) =>
        set((s) => ({ inbox: [row, ...s.inbox].slice(0, 80) })),
      markFired: (cadence, key) =>
        set((s) => ({ lastFired: { ...s.lastFired, [cadence]: key } })),
      setBaselines: (rows) => set({ baselines: rows.slice(0, 12) }),
    }),
    { name: "summex-ops-jobs-v1" },
  ),
);

export function baseline30mFor(daypart: string): number {
  const hit = useOpsJobsStore.getState().baselines.find((b) => b.daypart === daypart);
  return hit?.sales30mCents ?? 0;
}
