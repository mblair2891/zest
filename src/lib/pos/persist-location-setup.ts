import { CASH_DISCOUNT_CONFIRM } from "@/lib/pos/cash-discount";
import { saveLocationSettingsFn } from "@/lib/access/api";
import { useSaasStore } from "@/lib/pos/saas-store";
import { usePosStore } from "@/lib/pos/store";
import { useCostStore } from "@/lib/costs/store";
import { useOpsStore } from "@/lib/pos/ops-store";
import { isProspectDemo } from "@/lib/demo/session";
import { floorPlanFromPos } from "@/lib/saas/location-catalog";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { parseLaborRules } from "@/lib/labor/rules";
import { parsePaymentMethods } from "./payment-methods";
import { parseStationUpdates } from "./station-updates";
import { parseJurisdiction } from "./jurisdiction";

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function bumpConfigVersion(): number {
  const s = usePosStore.getState().settings;
  const n = (Number(s.configVersion) || 0) + 1;
  usePosStore.getState().updateSettings({ configVersion: n });
  return n;
}

function ids(): { orgId: string; locationId: string } | null {
  if (isProspectDemo()) return null;
  const orgId = useSaasStore.getState().org.id;
  const locationId = usePosStore.getState().tenantLocationId || "";
  if (!orgId || !locationId) return null;
  return { orgId, locationId };
}

export function persistPrinterAssignments(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("printer-assign");
  if (prev) clearTimeout(prev);
  timers.set(
    "printer-assign",
    setTimeout(() => {
      timers.delete("printer-assign");
      const devices = usePosStore.getState().locationDevices ?? [];
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: { locationDevices: devices, configVersion: bumpConfigVersion() },
        },
      }).catch(() => undefined);
    }, 400),
  );
}

export function persistVenueRouting(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("venue-routing");
  if (prev) clearTimeout(prev);
  timers.set(
    "venue-routing",
    setTimeout(() => {
      timers.delete("venue-routing");
      const settings = usePosStore.getState().settings;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: {
            separateCourseTickets: Boolean(settings.separateCourseTickets),
            configVersion: bumpConfigVersion(),
          },
        },
      }).catch(() => undefined);
    }, 400),
  );
}

export function persistHostStandPolicy(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("host-stand");
  if (prev) clearTimeout(prev);
  timers.set(
    "host-stand",
    setTimeout(() => {
      timers.delete("host-stand");
      const settings = usePosStore.getState().settings;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: {
            hostMayOpenBarTabs: Boolean(settings.hostMayOpenBarTabs),
            serversAtHostStand: Boolean(settings.serversAtHostStand),
            orderMayOpenBarTabs: settings.orderMayOpenBarTabs !== false,
          },
        },
      }).catch(() => undefined);
    }, 400),
  );
}

export function persistFloorStatus(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("floor-status");
  if (prev) clearTimeout(prev);
  timers.set(
    "floor-status",
    setTimeout(() => {
      timers.delete("floor-status");
      const settings = usePosStore.getState().settings;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: {
            floorStatusConfig: settings.floorStatusConfig,
            combineRequiresManager: Boolean(settings.combineRequiresManager),
          },
        },
      }).catch(() => undefined);
    }, 400),
  );
}

export function persistQrPolicy(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("qr");
  if (prev) clearTimeout(prev);
  timers.set(
    "qr",
    setTimeout(() => {
      timers.delete("qr");
      const settings = usePosStore.getState().settings;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: {
            qrMode: settings.qrMode,
            qrPolicy: settings.qrPolicy,
            configVersion: bumpConfigVersion(),
          },
        },
      }).catch(() => undefined);
    }, 700),
  );
}

/** Confirm that card prices will recompute. Caller then updates settings and persistCashDiscount. */
export function confirmCashDiscountRecalc(): boolean {
  if (typeof window !== "undefined" && !window.confirm(CASH_DISCOUNT_CONFIRM)) {
    return false;
  }
  return true;
}

export function persistEntityKyc(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("entity-kyc");
  if (prev) clearTimeout(prev);
  timers.set(
    "entity-kyc",
    setTimeout(() => {
      timers.delete("entity-kyc");
      const s = usePosStore.getState().settings;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: { entityKyc: s.entityKyc },
        },
      }).catch(() => undefined);
    }, 400),
  );
}

export function persistPaymentMethods(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("payment-methods");
  if (prev) clearTimeout(prev);
  timers.set(
    "payment-methods",
    setTimeout(() => {
      timers.delete("payment-methods");
      const s = usePosStore.getState().settings;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: { paymentMethods: parsePaymentMethods(s.paymentMethods) },
        },
      }).catch(() => undefined);
    }, 400),
  );
}

export function persistTaxRates(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("tax-rates");
  if (prev) clearTimeout(prev);
  timers.set(
    "tax-rates",
    setTimeout(() => {
      timers.delete("tax-rates");
      const s = usePosStore.getState().settings;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: {
            taxRates: s.taxRates ?? [],
            entityTaxRates: s.entityTaxRates ?? {},
            taxRate: s.taxRate,
            taxMode: s.taxMode,
            timezone: s.timezone,
            configVersion: bumpConfigVersion(),
          },
        },
      }).catch(() => undefined);
    }, 400),
  );
}

export function persistJurisdiction(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("jurisdiction");
  if (prev) clearTimeout(prev);
  timers.set(
    "jurisdiction",
    setTimeout(() => {
      timers.delete("jurisdiction");
      const s = usePosStore.getState().settings;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: {
            jurisdiction: parseJurisdiction(s.jurisdiction),
            configVersion: bumpConfigVersion(),
          },
        },
      }).catch(() => undefined);
    }, 400),
  );
}

export function persistStationUpdates(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("station-updates");
  if (prev) clearTimeout(prev);
  timers.set(
    "station-updates",
    setTimeout(() => {
      timers.delete("station-updates");
      const s = usePosStore.getState().settings;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: {
            stationUpdates: parseStationUpdates(s.stationUpdates),
            timezone: s.timezone,
            configVersion: bumpConfigVersion(),
          },
        },
      }).catch(() => undefined);
    }, 400),
  );
}

export function persistCashDiscount(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("cash-discount");
  if (prev) clearTimeout(prev);
  timers.set(
    "cash-discount",
    setTimeout(() => {
      timers.delete("cash-discount");
      const s = usePosStore.getState().settings;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: {
            cashDiscountEnabled: s.cashDiscountEnabled,
            cashDiscountPercent: s.cashDiscountPercent,
            cashRoundIncrement: s.cashRoundIncrement,
            cashRoundMode: s.cashRoundMode,
          },
        },
      }).catch(() => undefined);
    }, 400),
  );
}

export function persistCashHandling(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("cash");
  if (prev) clearTimeout(prev);
  timers.set(
    "cash",
    setTimeout(() => {
      timers.delete("cash");
      const cashHandling = usePosStore.getState().settings.cashHandling;
      if (!cashHandling) return;
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: { cashHandling },
        },
      }).catch(() => undefined);
    }, 700),
  );
}

export function persistLaborMap(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("labor-map");
  if (prev) clearTimeout(prev);
  timers.set(
    "labor-map",
    setTimeout(() => {
      timers.delete("labor-map");
      const map = useOpsStore.getState().laborByEntity ?? {};
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: { laborByEntity: map },
        },
      }).catch(() => undefined);
    }, 700),
  );
}

export function persistLaborRules(): void {
  const ctx = ids();
  if (!ctx) return;
  const prev = timers.get("labor");
  if (prev) clearTimeout(prev);
  timers.set(
    "labor",
    setTimeout(() => {
      timers.delete("labor");
      const emp = usePosStore.getState().employees.find((e) => e.id === usePosStore.getState().currentEmployeeId);
      const employerId = emp?.operatorId || HOST_SCOPE;
      const labor = parseLaborRules(useOpsStore.getState().labor);
      void saveLocationSettingsFn({
        data: {
          orgId: ctx.orgId,
          locationId: ctx.locationId,
          setup: {
            laborByEntity: { [employerId]: labor },
          },
        },
      }).catch(() => undefined);
    }, 700),
  );
}

export function persistLocationCatalog(kind: "floor" | "menu" | "recipes" | "costs"): void {
  const key = kind;
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void flushLocationCatalog(kind);
    }, 700),
  );
}

export async function flushLocationCatalog(
  _kind: "floor" | "menu" | "recipes" | "costs",
): Promise<void> {
  const ctx = ids();
  if (!ctx) return;
  const pos = usePosStore.getState();
  const plan = floorPlanFromPos(pos.tables, pos.floorSections);
  const cost = useCostStore.getState();
  await saveLocationSettingsFn({
    data: {
      orgId: ctx.orgId,
      locationId: ctx.locationId,
      setup: {
        floorPlan: plan,
        tableCount: plan.tables.length,
        sectionNames: plan.sections.map((s) => s.name),
        floorLater: plan.tables.length === 0,
        menuCatalog: {
          categories: pos.categories,
          items: pos.menuItems,
          modifiers: pos.modifierGroups,
        },
        configVersion: bumpConfigVersion(),
        recipes: cost.recipes,
        costPack: {
          skus: cost.skus,
          suppliers: cost.suppliers,
          invoices: cost.invoices.map((i) => ({ ...i, parseNote: i.parseNote?.slice(0, 400) })),
          maps: cost.maps,
          exceptions: cost.exceptions,
          settings: cost.settings,
          pos: cost.pos,
        },
      },
    },
  });
}
