/**
 * Paired station auto-refresh from heartbeat.
 * appBuild change → WebView reload. configVersion change → snapshot refetch.
 */
import { create } from "zustand";
import { usePosStore } from "@/lib/pos/store";
import {
  applyStationPublish,
  type StationPublishSetup,
} from "@/lib/pos/station-publish";
import {
  stationCriticalBusy,
  stationFloorSheetOpen,
} from "@/lib/pos/station-busy";

const BUILD_KEY = "summex-station-app-build";
const CONFIG_KEY = "summex-station-config-version";
export const UPDATE_READY_BANNER = "Update ready — will apply when you close this check";
export const IDLE_MS = 3_000;

export type StationRefreshPending = "none" | "shell" | "config";
export type StationRefreshDecision = "noop" | "banner" | "wait-idle" | "reload" | "apply-config";

export type HeartbeatRefresh = {
  ok: boolean;
  appBuild?: string;
  configVersion?: number;
  snapshot?: StationPublishSetup | null;
};

type RefreshState = {
  pending: StationRefreshPending;
  banner: boolean;
  lastAppBuild: string;
  lastConfigVersion: number;
  idleSince: number | null;
  forceWhenSafe: boolean;
  setPending: (p: StationRefreshPending) => void;
  setBanner: (v: boolean) => void;
};

export const useStationRefreshStore = create<RefreshState>((set) => ({
  pending: "none",
  banner: false,
  lastAppBuild: "",
  lastConfigVersion: 0,
  idleSince: null,
  forceWhenSafe: false,
  setPending: (pending) => set({ pending, banner: pending !== "none" && stationIsBusy() }),
  setBanner: (banner) => set({ banner }),
}));

/** Pure apply/reload gate. Never reload mid-send, mid-pay, or mid Print check. */
export function decideStationRefresh(input: {
  pending: StationRefreshPending;
  criticalBusy: boolean;
  busy: boolean;
  idleSurface: boolean;
  idleMs: number;
  forceWhenSafe?: boolean;
}): StationRefreshDecision {
  if (input.pending === "none") return "noop";
  if (input.criticalBusy) return "banner";
  if (input.pending === "shell") {
    if (input.forceWhenSafe) return "reload";
    if (input.idleSurface && input.idleMs >= IDLE_MS) return "reload";
    if (input.idleSurface) return "wait-idle";
    return "banner";
  }
  if (input.forceWhenSafe || !input.busy) return "apply-config";
  return "banner";
}

function readStored(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStored(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private */
  }
}

export function currentAppBuild(): string {
  return readStored(BUILD_KEY);
}

export function currentConfigVersion(): number {
  return Math.max(0, Number(readStored(CONFIG_KEY)) || 0);
}

/** PIN pad, or floor with no table sheet, and not mid-send/pay/print. */
export function stationIsIdleSurface(): boolean {
  try {
    if (stationCriticalBusy()) return false;
    const pos = usePosStore.getState();
    if (!pos.currentEmployeeId) return true;
    if (stationFloorSheetOpen()) return false;
    return pos.view === "floor";
  } catch {
    return false;
  }
}

export function stationIsBusy(): boolean {
  if (stationCriticalBusy()) return true;
  try {
    if (stationFloorSheetOpen()) return true;
    const pos = usePosStore.getState();
    if (pos.view === "order" && pos.activeOrderId) {
      const o = pos.orders.find((x) => x.id === pos.activeOrderId);
      if (o && o.status === "open") return true;
    }
  } catch {
    return true;
  }
  return false;
}

export function reloadStationShell(): void {
  if (typeof window === "undefined") return;
  try {
    window.location.reload();
  } catch {
    try {
      window.location.assign(String(window.location.href));
    } catch {
      /* WebView still valid; next heartbeat retries */
    }
  }
}

export function applyConfigSnapshot(setup: StationPublishSetup | null | undefined): boolean {
  if (!setup || typeof setup !== "object") return false;
  const loc = usePosStore.getState().tenantLocationId || "";
  const version = Math.max(1, currentConfigVersion());
  return applyStationPublish(
    {
      version,
      publishedAt: Date.now(),
      publishedByName: "sync",
      setup,
    },
    { locationId: loc, skipPublishStamp: true },
  );
}

function markPending(kind: StationRefreshPending): void {
  const busy = stationIsBusy();
  useStationRefreshStore.setState({
    pending: kind,
    banner: busy,
  });
}

function touchIdleClock(): number {
  const idle = stationIsIdleSurface();
  const st = useStationRefreshStore.getState();
  if (!idle) {
    if (st.idleSince != null) useStationRefreshStore.setState({ idleSince: null });
    return 0;
  }
  const since = st.idleSince ?? Date.now();
  if (!st.idleSince) useStationRefreshStore.setState({ idleSince: since });
  return Date.now() - since;
}

export function tryApplyStationRefresh(): void {
  const idleMs = touchIdleClock();
  const st = useStationRefreshStore.getState();
  const decision = decideStationRefresh({
    pending: st.pending,
    criticalBusy: stationCriticalBusy(),
    busy: stationIsBusy(),
    idleSurface: stationIsIdleSurface(),
    idleMs,
    forceWhenSafe: st.forceWhenSafe,
  });
  if (decision === "noop") {
    if (st.banner || st.forceWhenSafe) {
      useStationRefreshStore.setState({ banner: false, forceWhenSafe: false });
    }
    return;
  }
  if (decision === "banner") {
    useStationRefreshStore.setState({ banner: true });
    return;
  }
  if (decision === "wait-idle") {
    useStationRefreshStore.setState({ banner: false });
    return;
  }
  if (decision === "reload") {
    useStationRefreshStore.setState({
      pending: "none",
      banner: false,
      idleSince: null,
      forceWhenSafe: false,
    });
    reloadStationShell();
    return;
  }
  if (decision === "apply-config") {
    if (!pendingSnapshot) {
      useStationRefreshStore.setState({ banner: stationIsBusy() });
      return;
    }
    applyConfigSnapshot(pendingSnapshot);
    if (pendingConfigVersion) writeStored(CONFIG_KEY, String(pendingConfigVersion));
    pendingSnapshot = null;
    pendingConfigVersion = 0;
    useStationRefreshStore.setState({
      pending: "none",
      banner: false,
      forceWhenSafe: false,
    });
  }
}

let pendingSnapshot: StationPublishSetup | null = null;
let pendingConfigVersion = 0;

export function ingestHeartbeat(res: HeartbeatRefresh | null | undefined): void {
  if (!res?.ok) return;
  const build = String(res.appBuild ?? "").trim();
  const config = Math.max(0, Number(res.configVersion) || 0);
  const prevBuild = currentAppBuild();
  const prevConfig = currentConfigVersion();

  if (build && !prevBuild) writeStored(BUILD_KEY, build);
  if (config && !prevConfig) writeStored(CONFIG_KEY, String(config));

  const knownBuild = currentAppBuild();

  if (build && knownBuild && build !== knownBuild) {
    writeStored(BUILD_KEY, build);
    markPending("shell");
    tryApplyStationRefresh();
    return;
  }
  if (config && prevConfig && config > prevConfig) {
    if (res.snapshot) pendingSnapshot = res.snapshot;
    pendingConfigVersion = config;
    const cur = useStationRefreshStore.getState().pending;
    if (cur !== "shell") markPending("config");
    tryApplyStationRefresh();
  }
}

export function noteStationBecameIdle(): void {
  tryApplyStationRefresh();
}

export function noteCheckClosed(): void {
  if (useStationRefreshStore.getState().pending === "none") return;
  useStationRefreshStore.setState({ forceWhenSafe: true });
  tryApplyStationRefresh();
}

export function noteSwitchedUser(): void {
  if (useStationRefreshStore.getState().pending === "none") return;
  useStationRefreshStore.setState({ forceWhenSafe: true });
  tryApplyStationRefresh();
}
