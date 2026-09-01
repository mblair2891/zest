import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type { CloseoutStatus, ServerCloseout } from "./closeout";

type CloseoutState = {
  locationId: string;
  records: ServerCloseout[];
  ensureLocation: (locationId: string) => void;
  submit: (row: Omit<ServerCloseout, "id" | "at"> & { id?: string }) => ServerCloseout;
  reopen: (id: string) => { ok: boolean; error?: string };
  latestFor: (employeeId: string) => ServerCloseout | undefined;
  pendingFor: (employeeId: string) => ServerCloseout | undefined;
};

export const useCloseoutStore = create<CloseoutState>()(
  persist(
    (set, get) => ({
      locationId: "",
      records: [],

      ensureLocation: (locationId) => {
        const id = locationId || "loc";
        if (get().locationId === id) return;
        set({ locationId: id, records: [] });
      },

      submit: (row) => {
        const rec: ServerCloseout = {
          ...row,
          id: row.id || uid("clo"),
          at: Date.now(),
        };
        set({
          records: [rec, ...get().records.filter((r) => r.id !== rec.id)].slice(0, 200),
        });
        return rec;
      },

      reopen: (id) => {
        const rec = get().records.find((r) => r.id === id);
        if (!rec) return { ok: false, error: "Closeout not found" };
        set({
          records: get().records.map((r) =>
            r.id === id ? { ...r, status: "pending" as CloseoutStatus, pendingReason: "Reopened" } : r,
          ),
        });
        return { ok: true };
      },

      latestFor: (employeeId) => get().records.find((r) => r.employeeId === employeeId),

      pendingFor: (employeeId) =>
        get().records.find((r) => r.employeeId === employeeId && r.status === "pending"),
    }),
    {
      name: "summex-closeout-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ locationId: s.locationId, records: s.records }),
    },
  ),
);

export function hasCompletedCloseoutToday(employeeId: string, now = Date.now()): boolean {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const rec = useCloseoutStore
    .getState()
    .records.find(
      (r) =>
        r.employeeId === employeeId &&
        r.at >= start.getTime() &&
        (r.status === "closed" || r.status === "over_short"),
    );
  return Boolean(rec);
}
