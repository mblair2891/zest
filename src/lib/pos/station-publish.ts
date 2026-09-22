/**
 * Published location snapshot for paired station tablets.
 * Staff keep the last applied publish until PIN logout; PIN pad may refresh idle.
 * 86 / un-86 is not a publish — it overlays live on every station.
 */
import { usePosStore } from "@/lib/pos/store";
import { parseQrPolicy } from "@/lib/pos/qr-policy";
import { parseQrMode } from "@/lib/pos/qr-table";
import { tablesFromFloorPlan } from "@/lib/saas/location-catalog";
import { readFloorDraft, resolveLiveFloor, setFloorDraftBanner } from "@/lib/pos/live-floor";
import { parseLocationDevices } from "@/lib/pos/location-devices";
import { parseLaborMap } from "@/lib/labor/rules";
import { useOpsStore } from "@/lib/pos/ops-store";
import { parsePaymentMethods } from "./payment-methods";
import { parseTaxRates } from "./tax-rates";
import { parseStationUpdates } from "./station-updates";
import { parseBrandLogoMap } from "@/lib/brand/logos";

export const STATION_PUBLISH_STATE_KEY = "summex-station-publish-state-v1";

export type StationPublishSetup = {
  menuCatalog?: object;
  floorPlan?: object;
  locationDevices?: object[];
  qrMode?: string;
  qrPolicy?: object;
  cashHandling?: object;
  paymentMethods?: object;
  cashDiscountEnabled?: boolean;
  cashDiscountPercent?: number;
  cashRoundIncrement?: number;
  cashRoundMode?: string;
  hostMayOpenBarTabs?: boolean;
  serversAtHostStand?: boolean;
  orderMayOpenBarTabs?: boolean;
  separateCourseTickets?: boolean;
  timezone?: string;
  stationUpdates?: object;
  taxRates?: object[];
  entityTaxRates?: Record<string, object[]>;
  taxRate?: number;
  taxMode?: string;
  brandLogos?: object;
  combineRequiresManager?: boolean;
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

export function applyStationPublish(
  record: StationPublishRecord,
  opts?: { locationId?: string; locationName?: string; skipPublishStamp?: boolean },
): boolean {
  const setup = record.setup;
  try {
    const pos = usePosStore.getState();
    const locationId = (opts?.locationId || pos.tenantLocationId || "").trim();
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
    const publishedTables = Array.isArray(plan.tables)
      ? plan.tables.length
        ? tablesFromFloorPlan(setup.floorPlan as never)
        : []
      : null;
    const draft = readFloorDraft(locationId);
    const resolved = resolveLiveFloor({
      publishedTables,
      draftTables: draft?.tables ?? [],
      currentTables: pos.tables,
    });
    const tables = resolved.tables;
    const patch: Record<string, unknown> = {};
    if (Array.isArray(catalog.items)) {
      const live: Record<string, boolean> = {};
      for (const m of pos.menuItems) live[m.id] = m.available;
      patch.menuItems = catalog.items.map((raw) => {
        const item = raw as { id?: string; available?: boolean };
        const id = String(item.id ?? "");
        if (id && Object.prototype.hasOwnProperty.call(live, id)) {
          return { ...(raw as object), available: live[id] };
        }
        return raw;
      });
    }
    if (Array.isArray(catalog.categories)) patch.categories = catalog.categories;
    if (Array.isArray(catalog.modifiers)) patch.modifierGroups = catalog.modifiers;
    if (tables.length) patch.tables = tables;
    if (resolved.fromDraft && draft?.sections?.length) patch.floorSections = draft.sections;
    else if (Array.isArray(plan.sections)) patch.floorSections = plan.sections;
    if (resolved.fromDraft) setFloorDraftBanner(true);
    else if (publishedTables && publishedTables.length) setFloorDraftBanner(false);
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
    if (setup.paymentMethods && typeof setup.paymentMethods === "object") {
      settings.paymentMethods = parsePaymentMethods(setup.paymentMethods);
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
    if ("hostMayOpenBarTabs" in setup) {
      settings.hostMayOpenBarTabs = Boolean(setup.hostMayOpenBarTabs);
    }
    if ("serversAtHostStand" in setup) {
      settings.serversAtHostStand = Boolean(setup.serversAtHostStand);
    }
    if ("orderMayOpenBarTabs" in setup) {
      settings.orderMayOpenBarTabs = setup.orderMayOpenBarTabs !== false;
    }
    if ("separateCourseTickets" in setup) {
      settings.separateCourseTickets = Boolean(setup.separateCourseTickets);
    }
    if (typeof setup.timezone === "string" && setup.timezone.trim()) {
      settings.timezone = setup.timezone.trim();
    }
    if (setup.stationUpdates != null) {
      settings.stationUpdates = parseStationUpdates(setup.stationUpdates);
    }
    if (setup.taxRates != null) {
      settings.taxRates = parseTaxRates(setup.taxRates) ?? [];
    }
    if (setup.entityTaxRates && typeof setup.entityTaxRates === "object") {
      const next: NonNullable<typeof settings.entityTaxRates> = {};
      for (const [id, rates] of Object.entries(setup.entityTaxRates)) {
        next[id] = parseTaxRates(rates) ?? [];
      }
      settings.entityTaxRates = next;
    }
    if (typeof setup.taxRate === "number" && Number.isFinite(setup.taxRate)) {
      settings.taxRate = setup.taxRate;
    }
    if (setup.taxMode === "per_entity" || setup.taxMode === "venue_shared") {
      settings.taxMode = setup.taxMode;
    }
    if (setup.brandLogos != null) {
      settings.brandLogos = parseBrandLogoMap(setup.brandLogos);
    }
    if ("combineRequiresManager" in setup) {
      settings.combineRequiresManager = Boolean(setup.combineRequiresManager);
    }
    if (opts?.locationName) settings.name = opts.locationName;
    patch.settings = settings;
    if (locationId) patch.tenantLocationId = locationId;
    usePosStore.setState(patch as never);
    if (setup.laborByEntity) {
      try {
        const map = parseLaborMap(setup.laborByEntity);
        useOpsStore.setState({ laborByEntity: map });
      } catch {
        /* optional */
      }
    }
    if (!opts?.skipPublishStamp) {
      writePublishState({
        locationId: locationId || pos.tenantLocationId || "",
        appliedVersion: record.version,
        pending: null,
      });
    }
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
