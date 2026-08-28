import { saveLocationSettingsFn } from "@/lib/access/api";
import { useSaasStore } from "@/lib/pos/saas-store";
import { usePosStore } from "@/lib/pos/store";
import { useCostStore } from "@/lib/costs/store";
import { isProspectDemo } from "@/lib/demo/session";
import { floorPlanFromPos } from "@/lib/saas/location-catalog";

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function ids(): { orgId: string; locationId: string } | null {
  if (isProspectDemo()) return null;
  const orgId = useSaasStore.getState().org.id;
  const locationId = usePosStore.getState().tenantLocationId || "";
  if (!orgId || !locationId) return null;
  return { orgId, locationId };
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
        recipes: cost.recipes,
        costPack: {
          skus: cost.skus,
          suppliers: cost.suppliers,
          invoices: cost.invoices.map((i) => ({ ...i, parseNote: i.parseNote?.slice(0, 400) })),
          maps: cost.maps,
          exceptions: cost.exceptions,
          settings: cost.settings,
        },
      },
    },
  });
}
