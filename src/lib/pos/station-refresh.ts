/**
 * Station update prompt from heartbeat.
 * Outside the force window, never reload without a tap.
 * During the force window, idle stations apply after 60s if nobody taps.
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
import {
  FORCE_WINDOW_DURATION_MIN,
  forceWindowStarts,
  inForceUpdateWindow,
  missedEndedForceWindow,
  parseStationUpdates,
  stationFacingChangeBullets,
} from "@/lib/pos/station-updates";

const BUILD_KEY = "summex-station-app-build";
const CONFIG_KEY = "summex-station-config-version";
const SNOOZE_KEY = "summex-station-update-snooze-v1";
const LAST_SEEN_KEY = "summex-station-last-heartbeat";
const CATCH_UP_KEY = "summex-station-catch-up-v1";

export const UPDATE_READY_TITLE = "A system update is ready.";
export const UPDATE_REQUIRED_TITLE = "Update required";
export const CATCH_UP_TITLE = "An update was waiting while this station was offline.";
export const UPDATE_NOW_LABEL = "Update now";
export const REMIND_LATER_LABEL = "Remind me later";
export const FINISH_CHECK_TOAST = "Finish this check first";
export const SNOOZE_MS = 10 * 60 * 1000;
export const MAX_SNOOZES = 3;
export const FORCE_IDLE_MS = 60_000;

export type StationRefreshPending = "none" | "shell" | "config";
export type StationPromptSurface = "hidden" | "modal" | "bar" | "manager-chip" | "forced";

export type HeartbeatRefresh = {
  ok: boolean;
  appBuild?: string;
  configVersion?: number;
  snapshot?: StationPublishSetup | null;
  regNotices?: string[];
};

type RefreshState = {
  pending: StationRefreshPending;
  surface: StationPromptSurface;
  snoozeUntil: number;
  snoozeCount: number;
  idleSince: number | null;
  forced: boolean;
  catchUp: boolean;
  regNotices: string[];
  setSurface: (surface: StationPromptSurface) => void;
};

export const useStationRefreshStore = create<RefreshState>((set) => ({
  pending: "none",
  surface: "hidden",
  snoozeUntil: 0,
  snoozeCount: 0,
  idleSince: null,
  forced: false,
  catchUp: false,
  regNotices: [],
  setSurface: (surface) => set({ surface }),
}));

export function decideStationPrompt(input: {
  pending: StationRefreshPending;
  snoozed: boolean;
  snoozeCount: number;
  criticalBusy: boolean;
  isManager: boolean;
  forced?: boolean;
}): StationPromptSurface {
  if (input.pending === "none") return "hidden";
  if (input.forced) {
    if (input.criticalBusy) return "hidden";
    return "forced";
  }
  if (input.snoozed) return input.isManager ? "manager-chip" : "hidden";
  if (input.snoozeCount >= MAX_SNOOZES) return "bar";
  if (input.criticalBusy) return "hidden";
  return "modal";
}

export function readVenueUpdatePolicy(): {
  inWindow: boolean;
  catchUpMandatory: boolean;
  noSnooze: boolean;
  showChangeList: boolean;
  bullets: string[];
} {
  try {
    const settings = usePosStore.getState().settings;
    const cfg = parseStationUpdates(settings.stationUpdates);
    const inWindow = inForceUpdateWindow({
      atMs: Date.now(),
      timeZone: settings.timezone || "",
      windows: forceWindowStarts(cfg),
      durationMin: FORCE_WINDOW_DURATION_MIN,
    });
    const catchUp = Boolean(useStationRefreshStore.getState().catchUp);
    const catchUpMandatory = cfg.catchUpMandatory;
    return {
      inWindow,
      catchUpMandatory,
      noSnooze: inWindow || (catchUp && catchUpMandatory),
      showChangeList: cfg.showChangeList,
      bullets: stationFacingChangeBullets({
        show: cfg.showChangeList,
        extra: useStationRefreshStore.getState().regNotices,
      }),
    };
  } catch {
    return {
      inWindow: false,
      catchUpMandatory: true,
      noSnooze: false,
      showChangeList: true,
      bullets: stationFacingChangeBullets(),
    };
  }
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

export function stationBlocksUpdateNow(): boolean {
  if (stationCriticalBusy()) return true;
  try {
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

function currentIsManager(): boolean {
  try {
    const pos = usePosStore.getState();
    const emp = pos.employees.find((e) => e.id === pos.currentEmployeeId);
    return emp?.role === "owner" || emp?.role === "manager";
  } catch {
    return false;
  }
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
  const version = Math.max(1, pendingConfigVersion || currentConfigVersion());
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

type SnoozeRecord = {
  build: string;
  config: number;
  until: number;
  count: number;
};

function readSnooze(): SnoozeRecord | null {
  const raw = readStored(SNOOZE_KEY);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as SnoozeRecord;
    return {
      build: String(o.build ?? ""),
      config: Math.max(0, Number(o.config) || 0),
      until: Number(o.until) || 0,
      count: Math.max(0, Math.round(Number(o.count) || 0)),
    };
  } catch {
    return null;
  }
}

function writeSnooze(rec: SnoozeRecord): void {
  writeStored(SNOOZE_KEY, JSON.stringify(rec));
}

function readLastSeen(): number {
  return Math.max(0, Number(readStored(LAST_SEEN_KEY)) || 0);
}

function writeLastSeen(ms: number): void {
  writeStored(LAST_SEEN_KEY, String(ms));
}

function readCatchUpFlag(): { build: string; config: number } | null {
  const raw = readStored(CATCH_UP_KEY);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { build?: string; config?: number };
    return { build: String(o.build ?? ""), config: Math.max(0, Number(o.config) || 0) };
  } catch {
    return null;
  }
}

function writeCatchUpFlag(): void {
  writeStored(CATCH_UP_KEY, JSON.stringify({ build: pendingBuild, config: pendingConfigVersion }));
}

function clearCatchUpFlag(): void {
  writeStored(CATCH_UP_KEY, "");
}

function catchUpMatchesPending(): boolean {
  const rec = readCatchUpFlag();
  if (!rec) return false;
  const st = useStationRefreshStore.getState();
  if (st.pending === "shell") return Boolean(pendingBuild) && rec.build === pendingBuild;
  if (st.pending === "config") return rec.config === pendingConfigVersion;
  return false;
}

let pendingSnapshot: StationPublishSetup | null = null;
let pendingConfigVersion = 0;
let pendingBuild = "";

function snoozeMatchesPending(): boolean {
  const rec = readSnooze();
  if (!rec) return false;
  const st = useStationRefreshStore.getState();
  if (st.pending === "shell") return rec.build === pendingBuild;
  if (st.pending === "config") return rec.config === pendingConfigVersion;
  return false;
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

export function tickStationUpdatePrompt(): void {
  const st = useStationRefreshStore.getState();
  if (st.pending === "none") {
    if (st.surface !== "hidden" || st.forced || st.catchUp) {
      useStationRefreshStore.setState({
        surface: "hidden",
        forced: false,
        catchUp: false,
        idleSince: null,
      });
    }
    return;
  }
  const catchUp = st.catchUp || catchUpMatchesPending();
  if (catchUp && !st.catchUp) useStationRefreshStore.setState({ catchUp: true });
  const policy = readVenueUpdatePolicy();
  const noSnooze = policy.inWindow || (catchUp && policy.catchUpMandatory);
  if (policy.inWindow && !stationBlocksUpdateNow()) {
    const idleMs = touchIdleClock();
    if (stationIsIdleSurface() && idleMs >= FORCE_IDLE_MS) {
      applyStationUpdate();
      return;
    }
  } else if (st.idleSince != null && !policy.inWindow) {
    useStationRefreshStore.setState({ idleSince: null });
  }
  const rec = snoozeMatchesPending() ? readSnooze() : null;
  const count = rec?.count ?? st.snoozeCount;
  const until = rec?.until ?? st.snoozeUntil;
  const snoozed = !noSnooze && until > Date.now();
  const surface = decideStationPrompt({
    pending: st.pending,
    snoozed,
    snoozeCount: count,
    criticalBusy: stationCriticalBusy(),
    isManager: currentIsManager(),
    forced: noSnooze,
  });
  useStationRefreshStore.setState({
    surface,
    snoozeCount: count,
    snoozeUntil: snoozed ? until : 0,
    forced: noSnooze,
    catchUp,
  });
}

function markPending(kind: StationRefreshPending): void {
  const rec = readSnooze();
  const same =
    kind === "shell"
      ? rec?.build === pendingBuild
      : rec?.config === pendingConfigVersion;
  useStationRefreshStore.setState({
    pending: kind,
    snoozeCount: same ? rec?.count ?? 0 : 0,
    snoozeUntil: same ? rec?.until ?? 0 : 0,
  });
  tickStationUpdatePrompt();
}

/** Tap handler. Never called from heartbeat. */
export function applyStationUpdate(): { ok: boolean; reason?: "busy" | "none" } {
  const st = useStationRefreshStore.getState();
  if (st.pending === "none") return { ok: false, reason: "none" };
  if (stationBlocksUpdateNow()) return { ok: false, reason: "busy" };
  if (st.pending === "shell") {
    if (pendingBuild) writeStored(BUILD_KEY, pendingBuild);
    useStationRefreshStore.setState({
      pending: "none",
      surface: "hidden",
      snoozeUntil: 0,
      snoozeCount: 0,
      idleSince: null,
      forced: false,
      catchUp: false,
    });
    clearCatchUpFlag();
    reloadStationShell();
    return { ok: true };
  }
  if (!pendingSnapshot) {
    return { ok: false, reason: "none" };
  }
  applyConfigSnapshot(pendingSnapshot);
  if (pendingConfigVersion) writeStored(CONFIG_KEY, String(pendingConfigVersion));
  pendingSnapshot = null;
  pendingConfigVersion = 0;
  useStationRefreshStore.setState({
    pending: "none",
    surface: "hidden",
    snoozeUntil: 0,
    snoozeCount: 0,
    idleSince: null,
    forced: false,
    catchUp: false,
  });
  clearCatchUpFlag();
  return { ok: true };
}

export function snoozeStationUpdate(): void {
  const st = useStationRefreshStore.getState();
  if (st.pending === "none") return;
  const policy = readVenueUpdatePolicy();
  if (policy.noSnooze) return;
  const count = st.snoozeCount + 1;
  const until = Date.now() + SNOOZE_MS;
  const rec: SnoozeRecord = {
    build: pendingBuild,
    config: pendingConfigVersion,
    until,
    count,
  };
  writeSnooze(rec);
  useStationRefreshStore.setState({ snoozeCount: count, snoozeUntil: until });
  tickStationUpdatePrompt();
}

function noteMissedForceWindowIfNeeded(): void {
  try {
    const lastSeen = readLastSeen();
    const settings = usePosStore.getState().settings;
    const cfg = parseStationUpdates(settings.stationUpdates);
    if (
      missedEndedForceWindow({
        lastSeenMs: lastSeen,
        nowMs: Date.now(),
        timeZone: settings.timezone || "",
        windows: forceWindowStarts(cfg),
        durationMin: FORCE_WINDOW_DURATION_MIN,
      })
    ) {
      writeCatchUpFlag();
      useStationRefreshStore.setState({ catchUp: true });
    }
  } catch {
    /* optional */
  }
}

export function ingestHeartbeat(res: HeartbeatRefresh | null | undefined): void {
  if (!res?.ok) return;
  if (Array.isArray(res.regNotices)) {
    useStationRefreshStore.setState({
      regNotices: res.regNotices.map((n) => String(n).trim()).filter(Boolean).slice(0, 5),
    });
  }
  const build = String(res.appBuild ?? "").trim();
  const config = Math.max(0, Number(res.configVersion) || 0);
  const prevBuild = currentAppBuild();
  const prevConfig = currentConfigVersion();

  if (build && !prevBuild) writeStored(BUILD_KEY, build);
  if (config && !prevConfig) writeStored(CONFIG_KEY, String(config));

  const knownBuild = currentAppBuild();
  let behind = false;

  if (build && knownBuild && build !== knownBuild) {
    pendingBuild = build;
    behind = true;
    noteMissedForceWindowIfNeeded();
    markPending("shell");
    writeLastSeen(Date.now());
    return;
  }
  if (config && prevConfig && config > prevConfig) {
    if (res.snapshot) pendingSnapshot = res.snapshot;
    pendingConfigVersion = config;
    behind = true;
    const cur = useStationRefreshStore.getState().pending;
    if (cur !== "shell") {
      noteMissedForceWindowIfNeeded();
      markPending("config");
    } else tickStationUpdatePrompt();
  }
  if (!behind && catchUpMatchesPending()) {
    useStationRefreshStore.setState({ catchUp: true });
    tickStationUpdatePrompt();
  }
  writeLastSeen(Date.now());
}

export function noteStationBecameIdle(): void {
  tickStationUpdatePrompt();
}

export function noteCheckClosed(): void {
  tickStationUpdatePrompt();
}

export function noteSwitchedUser(): void {
  tickStationUpdatePrompt();
}
