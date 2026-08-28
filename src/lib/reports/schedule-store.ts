import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LocationInsights, RangeKey } from "./types";

export type AiReportRecord = {
  id: string;
  at: number;
  range: RangeKey;
  from: number;
  to: number;
  locationId: string;
  locationName: string;
  operatorId: string | null;
  insights: LocationInsights;
  delivered: "inbox" | "email" | "outbox";
};

type ScheduleState = {
  inbox: AiReportRecord[];
  lastFiredKey: string | null;
  push: (row: AiReportRecord) => void;
  markFired: (key: string) => void;
};

export const useAiReportStore = create<ScheduleState>()(
  persist(
    (set) => ({
      inbox: [],
      lastFiredKey: null,
      push: (row) =>
        set((s) => ({ inbox: [row, ...s.inbox].slice(0, 40) })),
      markFired: (key) => set({ lastFiredKey: key }),
    }),
    { name: "summex-ai-reports-v1" },
  ),
);

export function scheduleFireKey(kind: "daily" | "weekly", at = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  if (kind === "daily") return `${y}-${m}-${d}`;
  const onejan = new Date(at.getFullYear(), 0, 1);
  const week = Math.ceil(((at.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}
