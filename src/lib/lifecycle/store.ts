import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { usePosStore } from "@/lib/pos/store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { erasePracticeData } from "./erase";
import {
  DEFAULT_GO_LIVE_CHOICES,
  type GoLiveSchedule,
  type KeepEraseMap,
  type LifecycleAudit,
  type LocationLifecycle,
  type SessionModeId,
} from "./types";

type LifecycleState = {
  status: LocationLifecycle;
  trackInventoryInTraining: boolean;
  operatorStatus: Record<string, LocationLifecycle>;
  schedule: GoLiveSchedule | null;
  sessionMode: SessionModeId;
  splitEnabled: boolean;
  paneA: SessionModeId;
  paneB: SessionModeId;
  audits: LifecycleAudit[];

  hydrateFromSetup: (raw: {
    lifecycleStatus?: string;
    trainingTrackInventory?: boolean;
    operatorLifecycle?: Record<string, string>;
    goLiveAt?: string | null;
    goLiveChoices?: KeepEraseMap;
  }) => void;
  setStatus: (s: LocationLifecycle) => void;
  setTrackInventory: (on: boolean) => void;
  setOperatorStatus: (operatorId: string, s: LocationLifecycle) => void;
  setSessionMode: (m: SessionModeId) => void;
  setSplit: (on: boolean) => void;
  setPane: (which: "a" | "b", m: SessionModeId) => void;
  scheduleGoLive: (at: number, choices: KeepEraseMap) => { ok: boolean; error?: string };
  cancelSchedule: () => void;
  goLiveNow: (opts: {
    confirm: string;
    choices: KeepEraseMap;
    operatorId?: string;
  }) => { ok: boolean; error?: string; erased?: string[] };
  fireScheduleIfDue: (now?: number) => boolean;
};

function actor() {
  const pos = usePosStore.getState();
  const emp = pos.employees.find((e) => e.id === pos.currentEmployeeId);
  return { id: emp?.id ?? "staff", name: emp?.name ?? "Staff", role: emp?.role };
}

function canOwner(): boolean {
  const r = actor().role;
  return r === "owner";
}

function parseLife(v: unknown, fallback: LocationLifecycle): LocationLifecycle {
  const s = String(v ?? "");
  if (s === "onboarding" || s === "training" || s === "scheduled_live" || s === "live") {
    return s;
  }
  return fallback;
}

export const useLifecycleStore = create<LifecycleState>()(
  persist(
    (set, get) => ({
      status: "training",
      trackInventoryInTraining: false,
      operatorStatus: {},
      schedule: null,
      sessionMode: "floor_pos",
      splitEnabled: false,
      paneA: "floor_pos",
      paneB: "bar_kds",
      audits: [],

      hydrateFromSetup: (raw) => {
        const status = parseLife(raw.lifecycleStatus, get().status);
        const operatorStatus: Record<string, LocationLifecycle> = {
          ...get().operatorStatus,
        };
        if (raw.operatorLifecycle) {
          for (const [k, v] of Object.entries(raw.operatorLifecycle)) {
            operatorStatus[k] = parseLife(v, "training");
          }
        }
        let schedule = get().schedule;
        if (raw.goLiveAt) {
          const at = Date.parse(raw.goLiveAt);
          if (!Number.isNaN(at)) {
            schedule = {
              at,
              choices: raw.goLiveChoices ?? DEFAULT_GO_LIVE_CHOICES,
              createdAt: Date.now(),
              createdById: "setup",
              createdByName: "Setup",
            };
          }
        }
        set({
          status,
          trackInventoryInTraining: Boolean(raw.trainingTrackInventory),
          operatorStatus,
          schedule: status === "scheduled_live" ? schedule : get().schedule,
        });
      },

      setStatus: (status) => {
        set({ status });
        try {
          usePosStore.getState().updateSettings?.({ lifecycleStatus: status });
        } catch {
          /* */
        }
      },
      setTrackInventory: (on) => {
        set({ trackInventoryInTraining: on });
        try {
          usePosStore.getState().updateSettings?.({ trainingTrackInventory: on });
        } catch {
          /* */
        }
      },
      setOperatorStatus: (operatorId, s) =>
        set({
          operatorStatus: { ...get().operatorStatus, [operatorId]: s },
        }),
      setSessionMode: (sessionMode) => {
        set({ sessionMode });
      },
      setSplit: (splitEnabled) => {
        set({ splitEnabled });
      },
      setPane: (which, m) => {
        if (which === "a") set({ paneA: m });
        else set({ paneB: m });
      },

      scheduleGoLive: (at, choices) => {
        if (!canOwner()) return { ok: false, error: "Host owner only" };
        if (at < Date.now() + 30_000) {
          return { ok: false, error: "Pick a time at least 30 seconds ahead, or Go live now" };
        }
        const a = actor();
        const schedule: GoLiveSchedule = {
          at,
          choices,
          createdAt: Date.now(),
          createdById: a.id,
          createdByName: a.name,
        };
        const row: LifecycleAudit = {
          id: uid("lca"),
          at: Date.now(),
          actorId: a.id,
          actorName: a.name,
          action: "schedule_go_live",
          detail: `at ${new Date(at).toISOString()} · ${summarizeChoices(choices)}`,
        };
        set({
          status: "scheduled_live",
          schedule,
          audits: [row, ...get().audits].slice(0, 80),
        });
        return { ok: true };
      },

      cancelSchedule: () => {
        if (!canOwner()) return;
        const a = actor();
        set({
          status: get().status === "scheduled_live" ? "training" : get().status,
          schedule: null,
          audits: [
            {
              id: uid("lca"),
              at: Date.now(),
              actorId: a.id,
              actorName: a.name,
              action: "cancel_schedule",
              detail: "Returned to training",
            },
            ...get().audits,
          ],
        });
      },

      goLiveNow: (opts) => {
        if (!canOwner()) return { ok: false, error: "Host owner only" };
        if (opts.confirm.trim().toUpperCase() !== "GO LIVE NOW") {
          return { ok: false, error: "Type GO LIVE NOW to confirm" };
        }
        const a = actor();
        if (opts.operatorId) {
          set({
            operatorStatus: {
              ...get().operatorStatus,
              [opts.operatorId]: "live",
            },
            audits: [
              {
                id: uid("lca"),
                at: Date.now(),
                actorId: a.id,
                actorName: a.name,
                action: "operator_go_live",
                detail: opts.operatorId,
              },
              ...get().audits,
            ],
          });
          return { ok: true, erased: [] };
        }
        const erased = erasePracticeData(opts.choices);
        syncPosLife("live");
        set({
          status: "live",
          schedule: null,
          audits: [
            {
              id: uid("lca"),
              at: Date.now(),
              actorId: a.id,
              actorName: a.name,
              action: "go_live_now",
              detail: `erased ${erased.join(", ") || "none"} · ${summarizeChoices(opts.choices)}`,
            },
            ...get().audits,
          ],
        });
        try {
          usePosStore.getState().audit?.("lifecycle", `go live · ${erased.join(",")}`);
        } catch {
          /* */
        }
        return { ok: true, erased };
      },

      fireScheduleIfDue: (now = Date.now()) => {
        const sch = get().schedule;
        if (get().status !== "scheduled_live" || !sch) return false;
        if (now < sch.at) return false;
        const erased = erasePracticeData(sch.choices);
        syncPosLife("live");
        set({
          status: "live",
          schedule: null,
          audits: [
            {
              id: uid("lca"),
              at: now,
              actorId: "scheduler",
              actorName: "Scheduled go-live",
              action: "go_live_scheduled",
              detail: `erased ${erased.join(", ") || "none"}`,
            },
            ...get().audits,
          ],
        });
        return true;
      },
    }),
    {
      name: "summex-lifecycle-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

function syncPosLife(status: LocationLifecycle, track?: boolean) {
  try {
    usePosStore.getState().updateSettings?.({
      lifecycleStatus: status,
      ...(track != null ? { trainingTrackInventory: track } : {}),
    });
  } catch {
    /* */
  }
}

function summarizeChoices(c: KeepEraseMap): string {
  return Object.entries(c)
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
}

export function locationIsTraining(status = useLifecycleStore.getState().status): boolean {
  return status === "training" || status === "onboarding" || status === "scheduled_live";
}

export function operatorIsTraining(operatorId?: string | null): boolean {
  if (!operatorId || operatorId === HOST_SCOPE) {
    return locationIsTraining();
  }
  const s = useLifecycleStore.getState();
  if (locationIsTraining()) return true;
  const op = s.operatorStatus[operatorId];
  return op === "training" || op === "onboarding" || op === "scheduled_live";
}

/** Sandbox Quantum Payments unless this scope is live. */
export function captureIsSandbox(opts?: {
  operatorId?: string | null;
  vendorIds?: string[];
}): boolean {
  const s = useLifecycleStore.getState();
  if (s.status !== "live") return true;
  if (opts?.operatorId && operatorIsTraining(opts.operatorId)) return true;
  const vendors = (opts?.vendorIds ?? []).filter(Boolean);
  if (vendors.length && vendors.every((id) => operatorIsTraining(id))) return true;
  return false;
}

export function shouldTrackTrainingInventory(): boolean {
  const s = useLifecycleStore.getState();
  if (s.status === "live") return true;
  return s.trackInventoryInTraining;
}
