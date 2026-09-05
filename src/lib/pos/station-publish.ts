/**
 * Published location snapshot for paired station tablets.
 * Staff keep the last applied publish until PIN logout; PIN pad may refresh idle.
 */
import { usePosStore } from "@/lib/pos/store";
import { parseQrPolicy } from "@/lib/pos/qr-policy";
import { parseQrMode } from "@/lib/pos/qr-table";
import { tablesFromFloorPlan } from "@/lib/saas/location-catalog";
import { parseLocationDevices } from "@/lib/pos/location-devices";
import { parseLaborMap } from "@/lib/labor/rules";
import { useOpsStore } from "@/lib/pos/ops-store";

export const STATION_PUBLISH_STATE_KEY = "summex-station-publish-state-v1";

export type StationPublishSetup = {
  menuCatalog?: object;
  floorPlan?: object;
  locationDevices?: object[];
  qrMode?: string;
  qrPolicy?: object;
  cashHandling?: object;
  cashDiscountEnabled?: boolean;
  cashDiscountPercent?: number;
  cashRoundIncrement?: number;
  cashRoundMode?: string;
  sectionNames?: string[];
  laborByEntity?: object;
  sharedVenueCostsCents?: number;
};

export type StationPublishRecord = {
  version: number;
  publishedAt: number;
  publishedByName: string;
  setup: StationPublishSetup;
};

export type StationPublishState = {
  locationId: string;
  appliedVersion: number;
  pending: StationPublishRecord | null;
};

export function parseStationPublish(raw: unknown): StationPublishRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const version = Math.max(0, Math.round(Number(o.version) || 0));
  if (!version) return null;
  const setup =
    o.setup && typeof o.setup === "object" && !Array.isArray(o.setup)
      ? (o.setup as StationPublishSetup)
      : {};
  return {
    version,
    publishedAt: Number(o.publishedAt) || Date.now(),
    publishedByName: String(o.publishedByName ?? "Owner").trim() || "Owner",
    setup,
  };
}

export function readPublishState(): StationPublishState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATION_PUBLISH_STATE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as StationPublishState;
    if (!o?.locationId) return null;
    return {
      locationId: String(o.locationId),
      appliedVersion: Math.max(0, Number(o.appliedVersion) || 0),
      pending: parseStationPublish(o.pending),
    };
  } catch {
    return null;
  }
}

export function writePublishState(row: StationPublishState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATION_PUBLISH_STATE_KEY, JSON.stringify(row));
  } catch {
    /* private mode */
  }
}

export function staffSessionOpen(): boolean {
  try {
    return Boolean(usePosStore.getState().currentEmployeeId);
  } catch {
    return false;
  }
}

/** Never swap catalog while a check is being rung. */
export function isMidTicket(): boolean {
  try {
    const pos = usePosStore.getState();
    if (!pos.currentEmployeeId) return false;
    if (pos.activeOrderId) return true;
    return (pos.orders ?? []).some((o) => o.status === "open" && o.serverId === pos.currentEmployeeId);
  } catch {
    return true;
  }
}

export function applyStationPublish(record: StationPublishRecord): boolean {
  const setup = record.setup;
  try {
    const pos = usePosStore.getState();
    const catalog =
      setup.menuCatalog && typeof setup.menuCatalog === "object"
        ? (setup.menuCatalog as {
            items?: unknown[];
            categories?: unknown[];
            modifiers?: unknown[];
          })
        : {};
    const plan =
      setup.floorPlan && typeof setup.floorPlan === "object"
        ? (setup.floorPlan as { tables?: unknown[]; sections?: unknown[] })
        : {};
    const tables = Array.isArray(plan.tables) && plan.tables.length
      ? tablesFromFloorPlan(setup.floorPlan as never)
      : pos.tables;
    const patch: Record<string, unknown> = {};
    if (Array.isArray(catalog.items)) patch.menuItems = catalog.items;
    if (Array.isArray(catalog.categories)) patch.categories = catalog.categories;
    if (Array.isArray(catalog.modifiers)) patch.modifierGroups = catalog.modifiers;
    if (tables.length) patch.tables = tables;
    if (Array.isArray(plan.sections)) patch.floorSections = plan.sections;
    if (setup.locationDevices != null) {
      patch.locationDevices = parseLocationDevices(setup.locationDevices);
    }
    const settings = { ...pos.settings };
    if (typeof setup.qrMode === "string") settings.qrMode = parseQrMode(setup.qrMode);
    if (setup.qrPolicy != null) {
      settings.qrPolicy = parseQrPolicy(setup.qrPolicy, setup.qrMode ?? settings.qrMode);
    }
    if (setup.cashHandling && typeof setup.cashHandling === "object") {
      settings.cashHandling = setup.cashHandling as typeof settings.cashHandling;
    }
    if ("cashDiscountEnabled" in setup) {
      settings.cashDiscountEnabled = Boolean(setup.cashDiscountEnabled);
    }
    if (setup.cashDiscountPercent != null) {
      settings.cashDiscountPercent = Number(setup.cashDiscountPercent) || 0;
    }
    if (
      setup.cashRoundIncrement === 0.25 ||
      setup.cashRoundIncrement === 0.5 ||
      setup.cashRoundIncrement === 0.75 ||
      setup.cashRoundIncrement === 1
    ) {
      settings.cashRoundIncrement = setup.cashRoundIncrement;
    }
    if (setup.cashRoundMode === "up") settings.cashRoundMode = "up";
    patch.settings = settings;
    usePosStore.setState(patch as never);
    if (setup.laborByEntity) {
      try {
        const map = parseLaborMap(setup.laborByEntity);
        useOpsStore.setState({ laborByEntity: map });
      } catch {
        /* optional */
      }
    }
    const loc = pos.tenantLocationId || "";
    writePublishState({ locationId: loc, appliedVersion: record.version, pending: null });
    return true;
  } catch {
    return false;
  }
}

export function stashOrApplyPublish(record: StationPublishRecord): "applied" | "pending" | "skipped" {
  const loc = usePosStore.getState().tenantLocationId || "";
  const cur = readPublishState();
  if (cur?.appliedVersion && record.version <= cur.appliedVersion && !cur.pending) {
    return "skipped";
  }
  if (staffSessionOpen() || isMidTicket()) {
    writePublishState({
      locationId: loc || cur?.locationId || "",
      appliedVersion: cur?.appliedVersion ?? 0,
      pending: record,
    });
    return "pending";
  }
  applyStationPublish(record);
  return "applied";
}

export function applyPendingIfIdle(): boolean {
  if (staffSessionOpen() || isMidTicket()) return false;
  const cur = readPublishState();
  if (!cur?.pending) return false;
  return applyStationPublish(cur.pending);
}
